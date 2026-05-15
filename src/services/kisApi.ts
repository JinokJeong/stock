// KIS Open API REST 클라이언트 — 현재가/재무/업종/투자자/20일평균
import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { StockData, StockFinancial, StockScreenData } from '../types/stock';
import { getStockName, KOSPI200 } from '../constants/stockUniverse';
import { fetchCashFlowData } from './dartApi'; // enrichWithDart에서 사용

const KIS_BASE = 'https://openapi.koreainvestment.com:9443';
const TOKEN_CACHE_KEY  = 'KIS_ACCESS_TOKEN';
const TOKEN_EXP_KEY    = 'KIS_TOKEN_EXPIRES_AT';
const FIN_CACHE_PFX    = 'KIS_FIN5_';
const DAILY_CACHE_PFX  = 'KIS_DAILY_';

export interface OrderBookLevel {
  price: number;
  qty: number;
}

export interface OrderBook {
  asks: OrderBookLevel[];  // high→low (index 0 = highest ask)
  bids: OrderBookLevel[];  // high→low (index 0 = best bid)
  totalAskQty: number;
  totalBidQty: number;
}

export interface CandleData {
  date: string;   // MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
}

const KOSPI200_SET = new Set(KOSPI200);

// 세션 캐시 (앱 재시작 시 초기화)
let kisClient: AxiosInstance | null = null;
let kisClientPromise: Promise<AxiosInstance> | null = null; // 동시 생성 방지
let sectorCache: Record<string, { changeRate: number; change5day: number }> = {};
let kospiChangeCache: number | null = null;

// ─── Access Token ────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const expAt = await AsyncStorage.getItem(TOKEN_EXP_KEY);
  if (expAt && Date.now() < parseInt(expAt, 10)) {
    const cached = await AsyncStorage.getItem(TOKEN_CACHE_KEY);
    if (cached) return cached;
  }
  const appKey    = await SecureStore.getItemAsync('KIS_APP_KEY');
  const appSecret = await SecureStore.getItemAsync('KIS_APP_SECRET');
  if (!appKey || !appSecret) throw new Error('KIS API 키가 설정되지 않았습니다.\n설정 화면에서 App Key / App Secret을 입력하세요.');

  const res = await axios.post(`${KIS_BASE}/oauth2/tokenP`, {
    grant_type: 'client_credentials',
    appkey: appKey,
    appsecret: appSecret,
  });
  const token     = res.data.access_token as string;
  const expiresIn = ((res.data.expires_in as number) || 21600) * 1000;
  await AsyncStorage.setItem(TOKEN_CACHE_KEY, token);
  await AsyncStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + expiresIn));
  return token;
}

async function getClient(): Promise<AxiosInstance> {
  if (kisClient) return kisClient;
  // 동시에 여러 호출이 들어와도 토큰 요청은 1번만
  if (kisClientPromise) return kisClientPromise;
  kisClientPromise = (async () => {
    const token     = await getAccessToken();
    const appKey    = await SecureStore.getItemAsync('KIS_APP_KEY');
    const appSecret = await SecureStore.getItemAsync('KIS_APP_SECRET');
    kisClient = axios.create({
      baseURL: KIS_BASE,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        Authorization:  `Bearer ${token}`,
        appkey:         appKey ?? '',
        appsecret:      appSecret ?? '',
        custtype:       'P',
      },
      timeout: 10000,
    });
    kisClientPromise = null;
    return kisClient;
  })();
  return kisClientPromise;
}

export function resetClient() {
  kisClient        = null;
  kisClientPromise = null;
}

// ─── 전역 Rate Limiter — 모든 GET 요청을 큐로 직렬화 ─────────────────────────
// 600ms 간격 = 초당 최대 1.6건. rate limit 에러 시 1.5초 대기 후 1회 재시도.
const RATE_MS   = 200;
const RETRY_MS  = 1500;
let _rateTail: Promise<void> = Promise.resolve();

function isRateLimitErr(e: any) {
  const msg: string = e?.response?.data?.msg1 ?? '';
  return msg.includes('초당') || e?.response?.data?.rt_cd === '1';
}

function rateGet<T>(fn: () => Promise<T>): Promise<T> {
  const exec = async (): Promise<T> => {
    try {
      return await fn();
    } catch (e: any) {
      if (isRateLimitErr(e)) {
        await new Promise<void>((r) => setTimeout(r, RETRY_MS));
        return fn(); // 1회 재시도
      }
      throw e;
    }
  };
  const slot = _rateTail.then(exec);
  _rateTail  = slot.then(
    () => new Promise<void>((r) => setTimeout(r, RATE_MS)),
    () => new Promise<void>((r) => setTimeout(r, RATE_MS)),
  );
  return slot;
}

// ─── 현재가 (FHKST01010100) ──────────────────────────────────────────────────

async function fetchPrice(code: string, client: AxiosInstance) {
  const mktCode = KOSPI200_SET.has(code) ? 'J' : 'Q';
  const res = await rateGet(() => client.get('/uapi/domestic-stock/v1/quotations/inquire-price', {
    headers: { tr_id: 'FHKST01010100' },
    params: { FID_COND_MRKT_DIV_CODE: mktCode, FID_INPUT_ISCD: code },
  }));
  if (res.data.rt_cd !== '0') throw new Error(res.data.msg1 ?? '현재가 조회 실패');
  const d = res.data.output ?? {};
  const ahPrice  = parseInt(d.ovtm_untp, 10)           || 0;
  const ahChange = parseInt(d.ovtm_untp_prdy_vrss, 10) || 0;
  const ahRate   = parseFloat(d.ovtm_untp_prdy_ctrt)   || 0;
  const pmPrice  = parseInt(d.antc_cnpr, 10)            || 0;
  const pmChange = parseInt(d.antc_cntg_vrss, 10)       || 0;
  const pmRate   = parseFloat(d.antc_cntg_prdy_ctrt)    || 0;
  return {
    code,
    name: (d.hts_kor_isnm as string)?.trim() || getStockName(code),
    price:         parseInt(d.stck_prpr, 10)  || 0,
    change:        parseInt(d.prdy_vrss, 10)  || 0,
    changeRate:    parseFloat(d.prdy_ctrt)    || 0,
    volume:        parseInt(d.acml_vol, 10)   || 0,
    prevVolume:    parseInt(d.prdy_vol, 10)   || 0,
    volTurnover:   parseFloat(d.vol_tnrt)     || 0,
    netBuyCount:   0,
    sectorCode:    (d.bstp_cls_code as string) || '',
    sectorName:    (d.bstp_kor_isnm as string)?.trim() || '',
    market: KOSPI200_SET.has(code) ? ('KOSPI' as const) : ('KOSDAQ' as const),
    afterHoursPrice:      ahPrice > 0 ? ahPrice  : undefined,
    afterHoursChange:     ahPrice > 0 ? ahChange : undefined,
    afterHoursChangeRate: ahPrice > 0 ? ahRate   : undefined,
    preMarketPrice:      pmPrice > 0 ? pmPrice  : undefined,
    preMarketChange:     pmPrice > 0 ? pmChange : undefined,
    preMarketChangeRate: pmPrice > 0 ? pmRate   : undefined,
    perFromApi:  parseFloat(d.per)  || undefined,
    pbrFromApi:  parseFloat(d.pbr)  || undefined,
    lstnStcn:    parseInt(d.lstn_stcn, 10) || 0,
  };
}

// ─── 한국 시장 시간대 판단 ────────────────────────────────────────────────────
export function isKoreanMarketOpen(): boolean {
  const kst = new Date(Date.now() + 9 * 3_600_000);
  const day = kst.getUTCDay();
  if (day === 0 || day === 6) return false;
  const min = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return min >= 9 * 60 && min < 15 * 60 + 30;
}

// 장전 예상체결 시간 (08:00 ~ 09:00 KST)
export function isPreMarket(): boolean {
  const kst = new Date(Date.now() + 9 * 3_600_000);
  const day = kst.getUTCDay();
  if (day === 0 || day === 6) return false;
  const min = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return min >= 8 * 60 && min < 9 * 60;
}

// ─── 투자자별 매매 (FHKST01010900 역사 + FHKST03010100 당일 가집계) ───────────

// FHKST03010100: 주식 현재가 투자자 — 당일 누적 거래대금 (장 중 가집계)
async function fetchTodayInvestorAmounts(code: string, client: AxiosInstance): Promise<{
  foreignNetAmount: number; institutionNetAmount: number; retailNetAmount: number;
  foreignNetQty: number; institutionNetQty: number; retailNetQty: number;
} | null> {
  const mktCode = KOSPI200_SET.has(code) ? 'J' : 'Q';
  try {
    const res = await rateGet(() => client.get('/uapi/domestic-stock/v1/quotations/inquire-investor', {
      headers: { tr_id: 'FHKST03010100' },
      params: { FID_COND_MRKT_DIV_CODE: mktCode, FID_INPUT_ISCD: code },
    }));
    if (res.data.rt_cd !== '0') return null;
    const raw = res.data.output1 ?? res.data.output;
    const d = Array.isArray(raw) ? raw[0] : raw;
    if (!d) return null;
    const fAmt = parseInt(d.frgn_ntby_tr_pbmn, 10) || 0;
    const iAmt = parseInt(d.orgn_ntby_tr_pbmn, 10) || 0;
    const rAmt = parseInt(d.prsn_ntby_tr_pbmn, 10) || 0;
    const fQty = parseInt(d.frgn_ntby_qty, 10) || 0;
    const iQty = parseInt(d.orgn_ntby_qty, 10) || 0;
    const rQty = parseInt(d.prsn_ntby_qty, 10) || 0;
    if (fAmt === 0 && iAmt === 0 && rAmt === 0 && fQty === 0 && iQty === 0 && rQty === 0) return null;
    return {
      foreignNetAmount: fAmt, institutionNetAmount: iAmt, retailNetAmount: rAmt,
      foreignNetQty: fQty, institutionNetQty: iQty, retailNetQty: rQty,
    };
  } catch {
    return null;
  }
}

async function fetchInvestor(code: string, client: AxiosInstance) {
  const mktCode = KOSPI200_SET.has(code) ? 'J' : 'Q';
  const res = await rateGet(() => client.get('/uapi/domestic-stock/v1/quotations/inquire-investor', {
    headers: { tr_id: 'FHKST01010900' },
    params: { FID_COND_MRKT_DIV_CODE: mktCode, FID_INPUT_ISCD: code },
  }));
  if (res.data.rt_cd !== '0') throw new Error(res.data.msg1 ?? '투자자 조회 실패');
  const rows: any[] = res.data.output ?? [];

  const histRow0  = rows[0] ?? {};
  const histRow1  = rows[1] ?? {};
  const fNet0 = parseInt(histRow0.frgn_ntby_qty, 10) || 0;
  const fNet1 = parseInt(histRow1.frgn_ntby_qty, 10) || 0;

  // 전일 확정 금액: 역사 데이터 첫 번째 유효 행
  const hasAmounts = (r: any) =>
    (r.frgn_ntby_tr_pbmn !== '' && r.frgn_ntby_tr_pbmn != null) ||
    (r.orgn_ntby_tr_pbmn !== '' && r.orgn_ntby_tr_pbmn != null) ||
    (r.prsn_ntby_tr_pbmn !== '' && r.prsn_ntby_tr_pbmn != null);
  const prevRow    = rows.find(hasAmounts) ?? {};
  const prevDate   = prevRow.stck_bsop_date ?? '';

  // 장 중이면 FHKST03010100으로 오늘 가집계 조회
  const kstNow  = new Date(Date.now() + 9 * 3_600_000);
  const hh      = String(kstNow.getUTCHours()).padStart(2, '0');
  const mm      = String(kstNow.getUTCMinutes()).padStart(2, '0');
  const todayDate = kstNow.toISOString().slice(0, 10).replace(/-/g, '');

  const marketOpen = isKoreanMarketOpen();
  const todayData  = marketOpen ? await fetchTodayInvestorAmounts(code, client) : null;

  // 연속 순매수일 계산 — 오늘 방향은 todayData 우선, 이후 역사 행으로 카운트
  const rowSign = (row: any, qtyKey: string, amtKey: string) => {
    const qty = parseInt(row[qtyKey], 10);
    if (qty !== 0) return Math.sign(qty);
    const amt = parseInt(row[amtKey], 10);
    return Math.sign(amt);
  };
  // 오늘 외국인/기관 방향 (todayData 우선, 없으면 histRow0)
  const todayFSign = todayData
    ? Math.sign(todayData.foreignNetAmount || todayData.foreignNetQty || 0)
    : rowSign(histRow0, 'frgn_ntby_qty', 'frgn_ntby_tr_pbmn');
  const todayISign = todayData
    ? Math.sign(todayData.institutionNetAmount || todayData.institutionNetQty || 0)
    : rowSign(histRow0, 'orgn_ntby_qty', 'orgn_ntby_tr_pbmn');

  // 역사 행 중 오늘 행 제외한 나머지로 스트릭 카운트
  const histPast = histRow0.stck_bsop_date === todayDate ? rows.slice(1) : rows;

  const calcStreak = (todaySign: number, pastRows: any[], qtyKey: string, amtKey: string) => {
    if (todaySign === 0) return 0;
    let count = 1;  // 오늘 포함
    for (const row of pastRows) {
      if (rowSign(row, qtyKey, amtKey) === todaySign) count++;
      else break;
    }
    return todaySign > 0 ? count : -count;
  };

  const foreignConsecutiveDays     = calcStreak(todayFSign, histPast, 'frgn_ntby_qty', 'frgn_ntby_tr_pbmn');
  const institutionConsecutiveDays  = calcStreak(todayISign, histPast, 'orgn_ntby_qty', 'orgn_ntby_tr_pbmn');

  // 당일 데이터 우선 — 없으면 역사 데이터 사용
  if (todayData) {
    const hasAmt = todayData.foreignNetAmount !== 0 || todayData.institutionNetAmount !== 0 || todayData.retailNetAmount !== 0;
    const investorIsEstimated = !hasAmt;  // 금액 미제공이면 qty×price 추정 예정
    return {
      foreignNetAmount:       todayData.foreignNetAmount,
      institutionNetAmount:   todayData.institutionNetAmount,
      retailNetAmount:        todayData.retailNetAmount,
      foreignBuyAmount:       0,
      foreignSellAmount:      0,
      institutionBuyAmount:   0,
      institutionSellAmount:  0,
      foreignConsecutiveDays,
      institutionConsecutiveDays,
      foreignTurnedPositive: fNet0 > 0 && fNet1 <= 0,
      investorUpdatedAt: hasAmt ? `${hh}:${mm}` : `${hh}:${mm} (추정)`,
      foreignNetQty:       todayData.foreignNetQty,
      institutionNetQty:   todayData.institutionNetQty,
      retailNetQty:        todayData.retailNetQty,
      investorIsEstimated,
      prevForeignNetAmount:      parseInt(prevRow.frgn_ntby_tr_pbmn, 10) || 0,
      prevInstitutionNetAmount:  parseInt(prevRow.orgn_ntby_tr_pbmn, 10) || 0,
      prevRetailNetAmount:       parseInt(prevRow.prsn_ntby_tr_pbmn, 10) || 0,
      prevInvestorDate: prevDate,
    };
  }

  // 역사 데이터 — 오늘 행이 있고 금액도 있으면 사용, 아니면 전일 확정 행 사용
  const histHasToday = histRow0.stck_bsop_date === todayDate;
  const todayHasHistAmounts = histHasToday && hasAmounts(histRow0);
  const baseRow  = todayHasHistAmounts ? histRow0 : prevRow;
  const baseDate = todayHasHistAmounts ? todayDate : prevDate;

  const foreignNetQty     = parseInt(histRow0.frgn_ntby_qty, 10) || 0;
  const institutionNetQty = parseInt(histRow0.orgn_ntby_qty, 10) || 0;
  const retailNetQty      = parseInt(histRow0.prsn_ntby_qty, 10) || 0;
  const todayHasQty       = foreignNetQty !== 0 || institutionNetQty !== 0 || retailNetQty !== 0;

  let investorUpdatedAt: string;
  if (histHasToday && hasAmounts(histRow0)) {
    investorUpdatedAt = `${hh}:${mm}`;
  } else if (histHasToday && todayHasQty) {
    investorUpdatedAt = `${hh}:${mm} (추정)`;
  } else if (baseDate) {
    investorUpdatedAt = `${baseDate.slice(4, 6)}/${baseDate.slice(6, 8)} 전일`;
  } else {
    investorUpdatedAt = `${hh}:${mm}`;
  }

  return {
    foreignNetAmount:      parseInt(baseRow.frgn_ntby_tr_pbmn,  10) || 0,
    institutionNetAmount:  parseInt(baseRow.orgn_ntby_tr_pbmn,  10) || 0,
    retailNetAmount:       parseInt(baseRow.prsn_ntby_tr_pbmn,  10) || 0,
    foreignBuyAmount:      parseInt(baseRow.frgn_shnu_tr_pbmn,  10) || 0,
    foreignSellAmount:     parseInt(baseRow.frgn_seln_tr_pbmn,  10) || 0,
    institutionBuyAmount:  parseInt(baseRow.orgn_shnu_tr_pbmn,  10) || 0,
    institutionSellAmount: parseInt(baseRow.orgn_seln_tr_pbmn,  10) || 0,
    foreignConsecutiveDays,
    institutionConsecutiveDays,
    foreignTurnedPositive: fNet0 > 0 && fNet1 <= 0,
    investorUpdatedAt,
    foreignNetQty,
    institutionNetQty,
    retailNetQty,
    investorIsEstimated: histHasToday && todayHasQty && !hasAmounts(histRow0),
    prevForeignNetAmount:      parseInt(prevRow.frgn_ntby_tr_pbmn, 10) || 0,
    prevInstitutionNetAmount:  parseInt(prevRow.orgn_ntby_tr_pbmn, 10) || 0,
    prevRetailNetAmount:       parseInt(prevRow.prsn_ntby_tr_pbmn, 10) || 0,
    prevInvestorDate: prevDate,
  };
}

// ─── 수익성비율 (FHKST66430200) — CPS(주당현금흐름) 포함, 일 1회 캐시 ────────────

const PROF_CACHE_PFX = 'KIS_PROF3_';

async function fetchProfitabilityRatios(
  code: string, client: AxiosInstance,
): Promise<{ cps?: number; thtrNtin?: number }> {
  const today    = new Date().toISOString().slice(0, 10);
  const cacheKey = `${PROF_CACHE_PFX}${code}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const p = JSON.parse(cached);
      if (p.updatedAt === today) return p;
    }
  } catch {}

  const mktCode = KOSPI200_SET.has(code) ? 'J' : 'Q';
  try {
    const res = await rateGet(() => client.get('/uapi/domestic-stock/v1/finance/financial-ratio', {
      headers: { tr_id: 'FHKST66430200' },
      params: { FID_DIV_CLS_CODE: '1', FID_COND_MRKT_DIV_CODE: mktCode, FID_INPUT_ISCD: code },
    }));
    if (res.data.rt_cd !== '0') return {};
    const d = res.data.output?.[0] ?? {};
    const cps = parseFloat(d.cps) || parseFloat(d.cash_ps) || undefined;
    // thtr_ntin: 당기순이익 (억원) — CPS 직접 데이터 없을 때 PCR 추정에 사용
    const rawNtin = parseFloat(d.thtr_ntin);
    const thtrNtin = rawNtin > 0 && rawNtin < 999999 ? rawNtin : undefined;
    const result = { cps, thtrNtin, updatedAt: today };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
  } catch {
    return {};
  }
}

// ─── 재무비율 (FHKST66430300) — 일 1회 캐시 ─────────────────────────────────

async function fetchFinancial(code: string, client: AxiosInstance): Promise<Partial<StockFinancial>> {
  const today    = new Date().toISOString().slice(0, 10);
  const cacheKey = `${FIN_CACHE_PFX}${code}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const p = JSON.parse(cached);
      if (p.updatedAt === today) return p;
    }
  } catch {}

  const mktCode = KOSPI200_SET.has(code) ? 'J' : 'Q';
  const res = await rateGet(() => client.get('/uapi/domestic-stock/v1/finance/financial-ratio', {
    headers: { tr_id: 'FHKST66430300' },
    params: { FID_DIV_CLS_CODE: '1', FID_COND_MRKT_DIV_CODE: mktCode, FID_INPUT_ISCD: code },
  }));
  if (res.data.rt_cd !== '0') return { code, updatedAt: today };
  const d = res.data.output?.[0] ?? {};
  const per  = parseFloat(d.per)  || undefined;
  const pcr  = parseFloat(d.pcr)  || undefined;
  // KIS API: pfcr 필드명이 버전마다 다를 수 있음 — 여러 이름 시도
  const pfcrRaw = parseFloat(d.pfcr) || parseFloat(d.pfcf) || parseFloat(d.pfcf_ratio) || undefined;
  const fcfPs   = parseFloat(d.fcf_ps) || parseFloat(d.fcfps) || undefined;
  const fin: Partial<StockFinancial> = {
    code,
    per,
    pbr:          parseFloat(d.pbr)    || undefined,
    pcr,
    pfcr:         pfcrRaw,
    eps:          parseFloat(d.eps)    || undefined,
    bps:          parseFloat(d.bps)    || undefined,
    fcfPerShare:  fcfPs,
    updatedAt: today,
  };
  await AsyncStorage.setItem(cacheKey, JSON.stringify(fin));
  return fin;
}

// ─── 일별 시세 (FHKST01010400) — 캔들 + 20일 평균거래량, 일 1회 캐시 ──────────

async function fetchDailyData(
  code: string, client: AxiosInstance,
): Promise<{ avgVol20: number; prevVol: number; candles: CandleData[] }> {
  const today    = new Date().toISOString().slice(0, 10);
  const cacheKey = `${DAILY_CACHE_PFX}${code}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const p = JSON.parse(cached);
      if (p.date === today && p.prevVol != null) return { avgVol20: p.avgVol20, prevVol: p.prevVol, candles: p.candles };
    }
  } catch {}

  const toDate   = today.replace(/-/g, '');
  const fromDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  })();

  const mktCode = KOSPI200_SET.has(code) ? 'J' : 'Q';
  const res = await rateGet(() => client.get('/uapi/domestic-stock/v1/quotations/inquire-daily-price', {
    headers: { tr_id: 'FHKST01010400' },
    params: {
      FID_COND_MRKT_DIV_CODE: mktCode,
      FID_INPUT_ISCD: code,
      FID_INPUT_DATE_1: fromDate,
      FID_INPUT_DATE_2: toDate,
      FID_PERIOD_DIV_CODE: 'D',
      FID_ORG_ADJ_PRC: '1',
    },
  }));
  if (res.data.rt_cd !== '0') return { avgVol20: 0, prevVol: 0, candles: [] };

  const rows: any[] = res.data.output ?? [];
  const candles: CandleData[] = rows.slice(0, 30).reverse().map((r: any) => ({
    date:  `${r.stck_bsop_date?.slice(4, 6)}-${r.stck_bsop_date?.slice(6, 8)}`,
    open:  parseInt(r.stck_oprc, 10) || 0,
    high:  parseInt(r.stck_hgpr, 10) || 0,
    low:   parseInt(r.stck_lwpr, 10) || 0,
    close: parseInt(r.stck_clpr, 10) || 0,
  })).filter((c) => c.close > 0);

  const pastRows = rows[0]?.stck_bsop_date === toDate ? rows.slice(1) : rows;
  const vols = pastRows.slice(0, 20).map((r: any) => parseInt(r.acml_vol, 10) || 0).filter(Boolean);
  const avgVol20 = vols.length > 0 ? Math.round(vols.reduce((a, b) => a + b, 0) / vols.length) : 0;
  const prevVol  = parseInt(pastRows[0]?.acml_vol, 10) || 0;

  await AsyncStorage.setItem(cacheKey, JSON.stringify({ date: today, avgVol20, prevVol, candles }));
  return { avgVol20, prevVol, candles };
}

// ─── 지수 (KOSPI + 업종) — 세션 캐시 ────────────────────────────────────────

async function fetchKospiChange(client: AxiosInstance): Promise<number> {
  if (kospiChangeCache !== null) return kospiChangeCache;
  const res = await rateGet(() => client.get('/uapi/domestic-stock/v1/quotations/inquire-index-price', {
    headers: { tr_id: 'FHPUP02100000' },
    params: { FID_COND_MRKT_DIV_CODE: 'U', FID_INPUT_ISCD: '0001' },
  }));
  const d = res.data.output ?? {};
  kospiChangeCache = parseFloat(d.bstp_nmix_prdy_ctrt) || 0;
  return kospiChangeCache;
}

const SECTOR_NAME_TO_CODE: Array<[string, string]> = [
  ['전기전자', '0014'], ['전기·전자', '0014'],
  ['운수장비', '0016'], ['운송장비', '0016'],
  ['화학',     '0009'],
  ['의약품',   '0010'], ['제약',     '0010'], ['바이오', '0010'],
  ['철강금속', '0012'], ['철강',     '0012'],
  ['기계',     '0013'],
  ['음식료',   '0006'],
  ['섬유의복', '0007'],
  ['종이목재', '0008'],
  ['비금속',   '0011'],
  ['의료정밀', '0015'],
  ['유통업',   '0017'], ['유통',     '0017'],
  ['전기가스', '0018'],
  ['건설',     '0019'],
  ['운수창고', '0020'],
  ['통신',     '0021'],
  ['금융',     '0022'],
  ['은행',     '0023'],
  ['증권',     '0024'],
  ['보험',     '0025'],
  ['서비스',   '0026'],
];

function sectorNameToCode(name: string): string {
  for (const [key, code] of SECTOR_NAME_TO_CODE) {
    if (name.includes(key)) return code;
  }
  return '';
}

async function fetchSectorChange(sectorCode: string, sectorName: string, client: AxiosInstance): Promise<{ changeRate: number; change5day: number }> {
  const code = sectorCode || sectorNameToCode(sectorName);
  if (!code) return { changeRate: 0, change5day: 0 };
  if (sectorCache[code]) return sectorCache[code];
  try {
    const res = await rateGet(() => client.get('/uapi/domestic-stock/v1/quotations/inquire-index-price', {
      headers: { tr_id: 'FHPUP02100000' },
      params: { FID_COND_MRKT_DIV_CODE: 'U', FID_INPUT_ISCD: code },
    }));
    const d = res.data.output ?? {};
    const result = {
      changeRate: parseFloat(d.bstp_nmix_prdy_ctrt)  || 0,
      change5day: parseFloat(d.bstp_nmix_wghn_avrg)  || 0,
    };
    sectorCache[code] = result;
    return result;
  } catch {
    return { changeRate: 0, change5day: 0 };
  }
}

// ─── 섹터 평균 PER/PBR (정적 기본값) ─────────────────────────────────────────

const SECTOR_DEFAULTS: Record<string, { perSector: number; pbrSector: number; pcrSector: number; pfcrSector: number; roeSector: number }> = {
  default:    { perSector: 12,  pbrSector: 1.2,  pcrSector: 9,   pfcrSector: 12, roeSector: 8  },
  전기전자:   { perSector: 18,  pbrSector: 1.8,  pcrSector: 11,  pfcrSector: 15, roeSector: 12 },
  반도체:     { perSector: 22,  pbrSector: 2.5,  pcrSector: 13,  pfcrSector: 18, roeSector: 15 },
  금융:       { perSector: 8,   pbrSector: 0.6,  pcrSector: 7,   pfcrSector: 8,  roeSector: 8  },
  은행:       { perSector: 7,   pbrSector: 0.5,  pcrSector: 6,   pfcrSector: 7,  roeSector: 6  },
  제약바이오: { perSector: 40,  pbrSector: 3.0,  pcrSector: 22,  pfcrSector: 30, roeSector: 5  },
  자동차:     { perSector: 10,  pbrSector: 0.8,  pcrSector: 7,   pfcrSector: 10, roeSector: 8  },
  화학:       { perSector: 11,  pbrSector: 1.0,  pcrSector: 8,   pfcrSector: 11, roeSector: 7  },
  철강:       { perSector: 9,   pbrSector: 0.7,  pcrSector: 6,   pfcrSector: 9,  roeSector: 6  },
  건설:       { perSector: 10,  pbrSector: 0.9,  pcrSector: 7,   pfcrSector: 10, roeSector: 7  },
  통신:       { perSector: 14,  pbrSector: 1.1,  pcrSector: 10,  pfcrSector: 12, roeSector: 9  },
  유통:       { perSector: 15,  pbrSector: 1.3,  pcrSector: 11,  pfcrSector: 13, roeSector: 7  },
  엔터:       { perSector: 25,  pbrSector: 2.5,  pcrSector: 15,  pfcrSector: 20, roeSector: 10 },
};

function getSectorAvg(sectorName: string) {
  for (const key of Object.keys(SECTOR_DEFAULTS)) {
    if (sectorName.includes(key)) return SECTOR_DEFAULTS[key];
  }
  return SECTOR_DEFAULTS.default;
}

// ─── 공개 API ────────────────────────────────────────────────────────────────

export async function getStockPrice(code: string): Promise<Partial<StockData>> {
  const client = await getClient();
  return fetchPrice(code, client);
}

export async function getScreenerData(code: string, lean = false): Promise<StockScreenData> {
  const client = await getClient();

  const wrap = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    try { return await fn(); } catch (e: any) {
      const status = e?.response?.status;
      const msg    = e?.response?.data?.msg1 ?? e?.response?.data?.message ?? e?.message ?? '';
      throw new Error(`[${label}] ${status ? `HTTP ${status}: ` : ''}${msg}`);
    }
  };

  // lean=true(스크리너용): FHKST66430200(CPS) 생략 — fetchFinancial.pcr로 폴백
  const [priceData, investorData, financialData, profData, dailyData, kospiChg] = await Promise.all([
    wrap('현재가', () => fetchPrice(code, client)),
    wrap('투자자', () => fetchInvestor(code, client)),
    wrap('재무',   () => fetchFinancial(code, client)),
    lean ? Promise.resolve({} as { cps?: number; thtrNtin?: number }) : fetchProfitabilityRatios(code, client),
    wrap('거래량', () => fetchDailyData(code, client)),
    wrap('지수',   () => fetchKospiChange(client)),
  ]);

  const sectorIdx = await fetchSectorChange(priceData.sectorCode, priceData.sectorName, client);
  const sectorAvg = getSectorAvg(priceData.sectorName);

  const price    = priceData.price ?? 0;
  const eps      = financialData.eps;
  const bps      = financialData.bps;
  const lstnStcn = priceData.lstnStcn ?? 0;

  // PER/PBR: KIS 현재가 API 직접값 우선 → eps/bps 역산 폴백
  const per = priceData.perFromApi
    ?? financialData.per
    ?? (eps && eps > 0 && price > 0 ? parseFloat((price / eps).toFixed(2)) : undefined);
  const pbr = priceData.pbrFromApi
    ?? financialData.pbr
    ?? (bps && bps > 0 && price > 0 ? parseFloat((price / bps).toFixed(2)) : undefined);

  // ROE = EPS / BPS × 100 (%)
  const roe = (eps && eps > 0 && bps && bps > 0)
    ? parseFloat((eps / bps * 100).toFixed(1))
    : undefined;

  // PCR: ① KIS CPS → ② DART OCF → ③ KIS pcr 필드 → ④ 당기순이익 × 업종 OCF배수 추정
  // PFCR: ① DART (OCF-CapEx)/주 → ② KIS pfcr 필드
  let pcr: number | undefined;
  let pfcr: number | undefined;
  let pcrEstimated = false;
  let pfcrEstimated = false;

  // ① KIS FHKST66430200: cps(주당현금흐름, 원/주)
  const kissCps = profData.cps;
  if (kissCps && kissCps > 0 && price > 0) {
    pcr = parseFloat((price / kissCps).toFixed(1));
  }

  // ②는 enrichWithDart()가 백그라운드에서 처리

  // ③ KIS FHKST66430300 pcr/pfcr 필드 폴백
  if (!pcr) {
    const pcrApi = financialData.pcr;
    const fcfPs  = financialData.fcfPerShare;
    pcr  = pcrApi;
    pfcr = pfcr ?? financialData.pfcr
      ?? (fcfPs && fcfPs > 0 && price > 0 ? parseFloat((price / fcfPs).toFixed(2)) : undefined);
    if (!pfcr && pcrApi && pcrApi > 0) {
      pfcr = parseFloat((pcrApi * 1.35).toFixed(1));
      pfcrEstimated = true;
    }
  }

  // ④ 당기순이익(억원) × 업종별 OCF/NI 배수로 PCR 추정 (최후 수단)
  // 업종별 OCF/NI 배수: D&A 규모 차이 반영
  if (!pcr && profData.thtrNtin && lstnStcn > 0 && price > 0) {
    const niWon = profData.thtrNtin * 1e8;  // 억원 → 원
    const niPerShare = niWon / lstnStcn;
    if (niPerShare > 0) {
      const OCF_MULT_MAP: [string, number][] = [
        ['반도체', 1.5], ['전기전자', 1.8], ['통신', 2.0], ['자동차', 1.6],
        ['화학', 1.5], ['철강', 1.4], ['건설', 0.9], ['금융', 0.8], ['은행', 0.8],
        ['제약', 1.3], ['바이오', 1.3], ['유통', 1.2], ['엔터', 1.1],
      ];
      const sn = priceData.sectorName ?? '';
      const ocfMult = OCF_MULT_MAP.find(([k]) => sn.includes(k))?.[1] ?? 1.5;
      const cpsEst = niPerShare * ocfMult;
      pcr = parseFloat((price / cpsEst).toFixed(1));
      pcrEstimated = true;
    }
  }

  // 장 중 투자자 금액 미제공 시 수량 × 현재가로 추정 (단위: 백만원)
  let { foreignNetAmount, institutionNetAmount, retailNetAmount } = investorData;
  if (investorData.investorIsEstimated && price > 0) {
    // qty(주) × price(원) / 1,000,000 = 백만원
    foreignNetAmount     = Math.round((investorData.foreignNetQty     ?? 0) * price / 1_000_000);
    institutionNetAmount = Math.round((investorData.institutionNetQty ?? 0) * price / 1_000_000);
    retailNetAmount      = Math.round((investorData.retailNetQty      ?? 0) * price / 1_000_000);
  }

  return {
    ...priceData,
    ...investorData,
    foreignNetAmount,
    institutionNetAmount,
    retailNetAmount,
    lstnStcn,
    per,
    pbr,
    pcr,
    pfcr,
    pcrEstimated,
    pfcrEstimated,
    eps,
    bps,
    roe,
    fcfPerShare: financialData.fcfPerShare,
    ...sectorAvg,
    avgVolume20:       dailyData.avgVol20,
    prevVolume:        dailyData.prevVol,
    sectorChangeRate:  sectorIdx.changeRate,
    sectorChange:      sectorIdx.changeRate,
    sector5dayChange:  sectorIdx.change5day,
    kospiChange:       kospiChg,
    updatedAt:         new Date().toISOString().slice(0, 10),
  } as StockScreenData;
}

export async function getCandles(code: string): Promise<CandleData[]> {
  const client = await getClient();
  const { candles } = await fetchDailyData(code, client);
  return candles;
}

// ─── 차트용 기간별 캔들 ───────────────────────────────────────────────────────

export type ChartPeriod = '30m' | 'D' | 'W' | 'M' | 'Y';

export interface ChartCandle {
  time: string | number;  // 'YYYY-MM-DD' (D/W/M/Y) | unix_ts_seconds (30m)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchPeriodCandles(
  code: string,
  period: 'D' | 'W' | 'M',
  client: AxiosInstance,
): Promise<ChartCandle[]> {
  const today    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const daysBack = period === 'D' ? 200 : period === 'W' ? 1100 : 3650;
  const from     = new Date(Date.now() - daysBack * 86400000)
    .toISOString().slice(0, 10).replace(/-/g, '');

  const mktCode = KOSPI200_SET.has(code) ? 'J' : 'Q';
  const res = await rateGet(() => client.get('/uapi/domestic-stock/v1/quotations/inquire-daily-price', {
    headers: { tr_id: 'FHKST01010400' },
    params: {
      FID_COND_MRKT_DIV_CODE: mktCode,
      FID_INPUT_ISCD:         code,
      FID_INPUT_DATE_1:       from,
      FID_INPUT_DATE_2:       today,
      FID_PERIOD_DIV_CODE:    period,
      FID_ORG_ADJ_PRC:        '1',
    },
  }));
  if (res.data.rt_cd !== '0') return [];
  const rows: any[] = res.data.output ?? [];
  return rows.reverse().map((r: any) => {
    const d = r.stck_bsop_date as string;
    return {
      time:   `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`,
      open:   parseInt(r.stck_oprc, 10) || 0,
      high:   parseInt(r.stck_hgpr, 10) || 0,
      low:    parseInt(r.stck_lwpr, 10) || 0,
      close:  parseInt(r.stck_clpr, 10) || 0,
      volume: parseInt(r.acml_vol,  10) || 0,
    };
  }).filter(c => c.close > 0);
}

async function fetchMinuteCandles(code: string, client: AxiosInstance): Promise<ChartCandle[]> {
  const mktCode = KOSPI200_SET.has(code) ? 'J' : 'Q';
  const allRows: any[] = [];

  // 당일 전체 분봉: 16:00→ 역순으로 5페이지 (페이지당 30건, 약 150분)
  for (const hour of ['160000', '143000', '120000', '103000', '090000']) {
    try {
      const res = await rateGet(() => client.get('/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice', {
        headers: { tr_id: 'FHKST03010200' },
        params: {
          FID_ETC_CLS_CODE:       '',
          FID_COND_MRKT_DIV_CODE: mktCode,
          FID_INPUT_ISCD:         code,
          FID_INPUT_HOUR_1:       hour,
          FID_PW_DATA_INCU_YN:    'N',
        },
      }));
      if (res.data.rt_cd !== '0') continue;
      allRows.push(...(res.data.output2 ?? []));
    } catch { /* skip failed page */ }
  }

  // 중복 제거 + 정렬
  const seen = new Set<string>();
  const sorted = allRows
    .filter((r: any) => {
      const key = `${r.stck_bsop_date}${r.stck_cntg_hour}`;
      if (seen.has(key) || !(parseInt(r.stck_prpr, 10) > 0)) return false;
      seen.add(key);
      return true;
    })
    .sort((a: any, b: any) =>
      `${a.stck_bsop_date}${a.stck_cntg_hour}`.localeCompare(`${b.stck_bsop_date}${b.stck_cntg_hour}`)
    );

  // 30분 버킷 집계
  const buckets = new Map<number, ChartCandle>();
  for (const r of sorted) {
    const ds  = r.stck_bsop_date as string;
    const ts  = r.stck_cntg_hour as string;
    const hh  = parseInt(ts.slice(0, 2), 10);
    const mm  = parseInt(ts.slice(2, 4), 10);
    const b30 = Math.floor(mm / 30) * 30;
    // KST 시각을 UTC로 표기 (차트에서 KST 시각 그대로 보이도록 9시간 더함)
    const unixTs = Math.floor(Date.UTC(
      parseInt(ds.slice(0,4),10), parseInt(ds.slice(4,6),10)-1, parseInt(ds.slice(6,8),10),
      hh, b30,
    ) / 1000) + 9 * 3600;

    const close = parseInt(r.stck_prpr, 10) || 0;
    const high  = parseInt(r.stck_hgpr, 10) || 0;
    const low   = parseInt(r.stck_lwpr, 10) || 0;
    const open  = parseInt(r.stck_oprc, 10) || 0;
    const vol   = parseInt(r.cntg_vol,  10) || 0;

    if (!buckets.has(unixTs)) {
      buckets.set(unixTs, { time: unixTs, open, high, low, close, volume: vol });
    } else {
      const b = buckets.get(unixTs)!;
      b.high   = Math.max(b.high, high);
      b.low    = Math.min(b.low, low);
      b.close  = close;
      b.volume += vol;
    }
  }
  return [...buckets.values()].sort((a, b) => (a.time as number) - (b.time as number));
}

export async function getCandlesForChart(code: string, period: ChartPeriod): Promise<ChartCandle[]> {
  const client = await getClient();
  if (period === '30m') return fetchMinuteCandles(code, client);
  const p = period === 'Y' ? 'M' : (period as 'D' | 'W' | 'M');
  return fetchPeriodCandles(code, p, client);
}

async function fetchOrderBook(code: string, client: AxiosInstance): Promise<OrderBook> {
  const mktCode = KOSPI200_SET.has(code) ? 'J' : 'Q';
  try {
    const res = await rateGet(() => client.get('/uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn', {
      headers: { tr_id: 'FHKST01010200' },
      params: { FID_COND_MRKT_DIV_CODE: mktCode, FID_INPUT_ISCD: code },
    }));
    if (res.data.rt_cd !== '0') return { asks: [], bids: [], totalAskQty: 0, totalBidQty: 0 };
    // output1 is a single object with askp1~askp10 / bidp1~bidp10
    const raw1 = res.data.output1;
    const raw2 = res.data.output2;
    const d = (Array.isArray(raw1) ? raw1[0] : raw1)
           ?? (Array.isArray(raw2) ? raw2[0] : raw2)
           ?? {};
    const asks: OrderBookLevel[] = [];
    const bids: OrderBookLevel[] = [];
    for (let i = 5; i >= 1; i--) {
      const p = parseInt(d[`askp${i}`], 10);
      const q = parseInt(d[`askp_rsqn${i}`], 10);
      if (p > 0) asks.push({ price: p, qty: q || 0 });
    }
    for (let i = 1; i <= 5; i++) {
      const p = parseInt(d[`bidp${i}`], 10);
      const q = parseInt(d[`bidp_rsqn${i}`], 10);
      if (p > 0) bids.push({ price: p, qty: q || 0 });
    }
    return {
      asks,
      bids,
      totalAskQty: parseInt(d.total_askp_rsqn, 10) || 0,
      totalBidQty: parseInt(d.total_bidp_rsqn, 10) || 0,
    };
  } catch {
    return { asks: [], bids: [], totalAskQty: 0, totalBidQty: 0 };
  }
}

async function refreshInvestorEstimate(code: string, currentPrice: number) {
  const client = await getClient();
  const inv = await fetchInvestor(code, client);
  let { foreignNetAmount, institutionNetAmount, retailNetAmount } = inv;
  if (inv.investorIsEstimated && currentPrice > 0) {
    foreignNetAmount     = Math.round((inv.foreignNetQty     ?? 0) * currentPrice / 1_000_000);
    institutionNetAmount = Math.round((inv.institutionNetQty ?? 0) * currentPrice / 1_000_000);
    retailNetAmount      = Math.round((inv.retailNetQty      ?? 0) * currentPrice / 1_000_000);
  }
  return {
    foreignNetAmount,
    institutionNetAmount,
    retailNetAmount,
    investorUpdatedAt:      inv.investorUpdatedAt,
    investorIsEstimated:    inv.investorIsEstimated,
    prevForeignNetAmount:   inv.prevForeignNetAmount,
    prevInstitutionNetAmount: inv.prevInstitutionNetAmount,
    prevRetailNetAmount:    inv.prevRetailNetAmount,
    prevInvestorDate:       inv.prevInvestorDate,
    foreignConsecutiveDays: inv.foreignConsecutiveDays,
    institutionConsecutiveDays: inv.institutionConsecutiveDays,
    foreignTurnedPositive:  inv.foreignTurnedPositive,
  };
}

// ─── DART 보강 (백그라운드) — OCF 기반 PCR/PFCR ──────────────────────────────

export async function enrichWithDart(
  code: string,
  price: number,
  lstnStcn: number,
): Promise<Partial<StockData>> {
  if (price <= 0 || lstnStcn <= 0) return {};
  try {
    const cfData = await fetchCashFlowData(code);
    if (!cfData || cfData.ocf <= 0) return {};
    const cpsWon   = cfData.ocf / lstnStcn;
    if (cpsWon <= 0) return {};
    const fcfPerSh = (cfData.ocf - cfData.capex) / lstnStcn;
    return {
      pcr:           parseFloat((price / cpsWon).toFixed(1)),
      pfcr:          fcfPerSh > 0 ? parseFloat((price / fcfPerSh).toFixed(1)) : undefined,
      pcrEstimated:  false,
      pfcrEstimated: false,
    };
  } catch {
    return {};
  }
}

export const kisApi = {
  getStockPrice,
  getScreenerData,
  getScreenerDataFast: (code: string) => getScreenerData(code, true),
  getCandles,
  getCandlesForChart,
  getOrderBook: async (code: string) => {
    const client = await getClient();
    return fetchOrderBook(code, client);
  },
  refreshInvestorEstimate,
  resetClient,
};
