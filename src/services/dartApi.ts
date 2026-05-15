// DART Open API — 공시/뉴스 수집 + 현금흐름표
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { unzipSync } from 'fflate';
import { NewsItem } from '../types/theme';

const DART_BASE     = 'https://opendart.fss.or.kr/api';
const CF_CACHE_PFX    = 'DART_CF4_';   // 버전 올려서 낡은 캐시 무력화
const CORP_MAP_KEY    = 'DART_CORP_MAP6';
const STOCK_LIST_KEY  = 'DART_STOCK_LIST_V1';
const CORP_MAP_TTL    = 7 * 24 * 3600 * 1000; // 7일

export interface StockEntry { code: string; name: string; }

export async function loadStockList(): Promise<StockEntry[] | null> {
  try {
    const raw = await AsyncStorage.getItem(STOCK_LIST_KEY);
    if (!raw) return null;
    const { expiry, list } = JSON.parse(raw);
    if (Date.now() >= expiry || !list?.length) return null;
    return list as StockEntry[];
  } catch { return null; }
}

function parseKrw(s: string | undefined): number {
  if (!s) return 0;
  return parseInt(s.replace(/,/g, ''), 10) || 0;
}

// ─── corp_code 맵 (stock_code → corp_code) ────────────────────────────────────
// corpCode.xml (ZIP) 다운로드 → fflate 압축해제 → XML 파싱 · 7일 캐시

async function loadCorpMap(): Promise<Record<string, string> | null> {
  try {
    const raw = await AsyncStorage.getItem(CORP_MAP_KEY);
    if (!raw) return null;
    const { expiry, map } = JSON.parse(raw);
    if (Date.now() >= expiry || Object.keys(map).length === 0) return null;
    return map;
  } catch { return null; }
}

// 동시에 여러 종목이 buildCorpMap 호출 시 다운로드 1회만 실행되도록 dedup
let _corpMapPromise: Promise<Record<string, string>> | null = null;

function buildCorpMap(apiKey: string): Promise<Record<string, string>> {
  if (_corpMapPromise) return _corpMapPromise;
  _corpMapPromise = _doBuildCorpMap(apiKey).finally(() => { _corpMapPromise = null; });
  return _corpMapPromise;
}

async function _doBuildCorpMap(apiKey: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const stockList: StockEntry[] = [];

  try {
    const url = `${DART_BASE}/corpCode.xml?crtfc_key=${apiKey}`;
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30_000 });
    const bytes = new Uint8Array(res.data as ArrayBuffer);

    if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
      const files = unzipSync(bytes);
      const xmlBytes = files['CORPCODE.xml'];
      if (xmlBytes) {
        // ASCII 태그를 바이트로 직접 스캔 (TextDecoder 29MB 디코딩 회피)
        const findTag = (tag: string, from: number): number => {
          const tl = tag.length;
          outer: for (let i = from; i <= xmlBytes.length - tl; i++) {
            for (let j = 0; j < tl; j++) {
              if (xmlBytes[i + j] !== tag.charCodeAt(j)) continue outer;
            }
            return i;
          }
          return -1;
        };
        const dec = new TextDecoder('utf-8');
        const digits = (start: number, end: number): string => {
          let s = '';
          for (let i = start; i < end; i++) {
            const b = xmlBytes[i];
            if (b >= 48 && b <= 57) s += String.fromCharCode(b);
          }
          return s;
        };

        let pos = 0;
        while (true) {
          const ls = findTag('<list>', pos);           if (ls === -1) break;
          const le = findTag('</list>', ls + 6);      if (le === -1) break;
          const ccS = findTag('<corp_code>', ls);
          const ccE = findTag('</corp_code>', ls);
          const scS = findTag('<stock_code>', ls);
          const scE = findTag('</stock_code>', ls);
          const cnS = findTag('<corp_name>', ls);
          const cnE = findTag('</corp_name>', ls);
          if (ccS !== -1 && ccE !== -1 && scS !== -1 && scE !== -1) {
            const cc = digits(ccS + 11, ccE);
            const sc = digits(scS + 12, scE);
            if (sc && cc) {
              map[sc] = cc;
              if (cnS !== -1 && cnE !== -1) {
                const name = dec.decode(xmlBytes.slice(cnS + 11, cnE));
                if (name) stockList.push({ code: sc, name });
              }
            }
          }
          pos = le + 7;
        }
      } else {
        console.log('[DART] CORPCODE.xml not found in ZIP');
      }
    } else {
      const errText = new TextDecoder().decode(bytes.slice(0, 300));
      console.log('[DART] corpCode.xml 응답 오류:', errText);
    }
  } catch (e) {
    console.log('[DART_CORPCODE_ERR]', String(e));
  }

  const count = Object.keys(map).length;
  if (count > 0) {
    const expiry = Date.now() + CORP_MAP_TTL;
    try {
      await AsyncStorage.setItem(CORP_MAP_KEY, JSON.stringify({ expiry, map }));
    } catch {}
    if (stockList.length > 0) {
      try {
        await AsyncStorage.setItem(STOCK_LIST_KEY, JSON.stringify({ expiry, list: stockList }));
      } catch {}
    }
  }
  return map;
}

// ─── 현금흐름표 조회 ──────────────────────────────────────────────────────────

export async function fetchCashFlowData(stockCode: string): Promise<{
  ocf: number; capex: number;
} | null> {
  const rawKey = await SecureStore.getItemAsync('DART_API_KEY');
  const apiKey = rawKey?.trim() || null;
  if (!apiKey) return null;

  const today  = new Date().toISOString().slice(0, 10);
  const cfKey  = `${CF_CACHE_PFX}${stockCode}`;
  try {
    const cached = await AsyncStorage.getItem(cfKey);
    if (cached) {
      const p = JSON.parse(cached);
      if (p.date === today && p.data !== null) return p.data;
    }
  } catch {}

  const save = async (data: { ocf: number; capex: number } | null) => {
    if (data !== null) {
      try { await AsyncStorage.setItem(cfKey, JSON.stringify({ date: today, data })); } catch {}
    }
    return data;
  };

  try {
    // 1) stock_code → corp_code: 캐시된 맵 사용, 없으면 빌드
    let corpMap = await loadCorpMap();
    if (!corpMap) corpMap = await buildCorpMap(apiKey);
    const corpCode = corpMap[stockCode] ?? null;
    if (!corpCode) {
      console.log('[DART] corp_code 없음:', stockCode);
      return null;  // 맵에 없으면 캐시하지 않고 다음 번에 재시도
    }

    // 2) 사업보고서 현금흐름표 — fnlttSinglAcntAll(전체) 우선, 없으면 fnlttSinglAcnt(주요)
    const year = new Date().getFullYear();
    let list: any[] | null = null;
    for (const bsnsYear of [`${year - 1}`, `${year - 2}`]) {
      for (const endpoint of ['fnlttSinglAcntAll.json', 'fnlttSinglAcnt.json']) {
        const r = await axios.get(`${DART_BASE}/${endpoint}`, {
          params: {
            crtfc_key: apiKey, corp_code: corpCode,
            bsns_year: bsnsYear, reprt_code: '11011', fs_div: 'CFS',
          },
          timeout: 10000,
        });
        if (r.data.status === '000' && r.data.list?.length > 0) {
          list = r.data.list;
          break;
        }
      }
      if (list) break;
    }
    if (!list) return save(null);

    // sj_div==='CF' 먼저, 없으면 전체 항목에서 account_nm/account_id로 탐색
    const cfItems = list.filter((i: any) => i.sj_div === 'CF');
    const pool = cfItems.length > 0 ? cfItems : list;
    const ocfItem = pool.find((i: any) =>
      (i.account_id ?? '').includes('OperatingActivities') ||
      (i.account_nm ?? '').match(/영업활동.*(현금흐름|현금)/));
    const capexItem = pool.find((i: any) =>
      (i.account_id ?? '').includes('PurchaseOfProperty') ||
      (i.account_nm ?? '').match(/유형자산.*취득|설비투자|자본적\s*지출/));

    if (!ocfItem) return save(null);
    const ocf   = parseKrw(ocfItem.thstrm_amount);
    const capex = Math.abs(parseKrw(capexItem?.thstrm_amount));
    if (ocf === 0) return save(null);
    return save({ ocf, capex });
  } catch (e) {
    console.log('[DART] fetchCashFlow error:', stockCode, String(e));
    return null;
  }
}

// ─── 공시/뉴스 목록 ───────────────────────────────────────────────────────────

export async function fetchRecentNews(
  corpCode?: string,
  count = 20
): Promise<NewsItem[]> {
  const apiKey = await SecureStore.getItemAsync('DART_API_KEY');
  if (!apiKey) return [];

  const params: Record<string, any> = {
    crtfc_key: apiKey,
    sort: 'date',
    sort_mth: 'desc',
    page_no: 1,
    page_count: count,
  };
  if (corpCode) params.corp_code = corpCode;

  const res = await axios.get(`${DART_BASE}/search.json`, { params, timeout: 10000 });
  return (res.data.list ?? []).map((d: any) => ({
    id:          d.rcept_no as string,
    title:       d.report_nm as string,
    url:         `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcept_no}`,
    publishedAt: d.rcept_dt as string,
    corpCode:    d.corp_code as string,
    corpName:    d.corp_name as string,
  }));
}
