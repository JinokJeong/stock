// KIS Open API REST 클라이언트 — 현재가/재무/업종/투자자/20일평균
import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { StockData, StockFinancial, StockScreenData } from '../types/stock';
import { getStockName, KOSPI200 } from '../constants/stockUniverse';

const KIS_BASE = 'https://openapi.koreainvestment.com:9443';
const TOKEN_CACHE_KEY = 'KIS_ACCESS_TOKEN';
const TOKEN_EXP_KEY   = 'KIS_TOKEN_EXPIRES_AT';
const FIN_CACHE_PFX   = 'KIS_FIN_';
const VOL_CACHE_PFX   = 'KIS_VOL_';

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
const RATE_MS   = 600;
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
  const d = res.data.output;
  return {
    code,
    name: (d.hts_kor_isnm as string)?.trim() || getStockName(code),
    price:         parseInt(d.stck_prpr, 10)  || 0,
    change:        parseInt(d.prdy_vrss, 10)  || 0,
    changeRate:    parseFloat(d.prdy_ctrt)    || 0,
    volume:        parseInt(d.acml_vol, 10)   || 0,
    prevVolume:    parseInt(d.prdy_vol, 10)   || 0,
    tradeStrength: parseFloat(d.cntr_str)     || 100,
    sectorCode:    (d.bstp_cls_code as string) || '',
    sectorName:    (d.bstp_kor_isnm as string)?.trim() || '',
    market: KOSPI200_SET.has(code) ? ('KOSPI' as const) : ('KOSDAQ' as const),
  };
}

// ─── 투자자별 매매 (FHKST01010900) ───────────────────────────────────────────

async function fetchInvestor(code: string, client: AxiosInstance) {
  const mktCode = KOSPI200_SET.has(code) ? 'J' : 'Q';
  const res = await rateGet(() => client.get('/uapi/domestic-stock/v1/quotations/inquire-investor', {
    headers: { tr_id: 'FHKST01010900' },
    params: { FID_COND_MRKT_DIV_CODE: mktCode, FID_INPUT_ISCD: code },
  }));
  const rows: any[] = res.data.output ?? [];

  // 외국인 연속 순매수일 계산 (최신 → 과거 순)
  let foreignConsecutiveDays = 0;
  let institutionConsecutiveDays = 0;
  for (const row of rows) {
    if (parseInt(row.frgn_ntby_qty, 10) > 0) foreignConsecutiveDays++;
    else break;
  }
  for (const row of rows) {
    if (parseInt(row.orgn_ntby_qty, 10) > 0) institutionConsecutiveDays++;
    else break;
  }
  // 음수 = 연속 순매도
  let foreignSellDays = 0;
  for (const row of rows) {
    if (parseInt(row.frgn_ntby_qty, 10) < 0) foreignSellDays++;
    else break;
  }
  if (foreignSellDays > 0) foreignConsecutiveDays = -foreignSellDays;

  const today     = rows[0] ?? {};
  const yesterday = rows[1] ?? {};
  const fNet0 = parseInt(today.frgn_ntby_qty, 10) || 0;
  const fNet1 = parseInt(yesterday.frgn_ntby_qty, 10) || 0;

  const fBuyVol  = parseInt(today.frgn_buyv_vol, 10) || 0;
  const fSellVol = parseInt(today.frgn_seln_vol, 10) || 0;
  const oBuyVol  = parseInt(today.orgn_buyv_vol, 10) || 0;
  const oSellVol = parseInt(today.orgn_seln_vol, 10) || 0;

  return {
    foreignNetAmount:          parseInt(today.frgn_ntby_tr_pbmn, 10) || 0,
    institutionNetAmount:      parseInt(today.orgn_ntby_tr_pbmn, 10) || 0,
    retailNetAmount:           parseInt(today.indv_ntby_tr_pbmn, 10) || 0,
    foreignBuyAmount:          fBuyVol,
    foreignSellAmount:         fSellVol,
    institutionBuyAmount:      oBuyVol,
    institutionSellAmount:     oSellVol,
    foreignConsecutiveDays,
    institutionConsecutiveDays,
    foreignTurnedPositive: fNet0 > 0 && fNet1 <= 0,
  };
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
    params: { FID_COND_MRKT_DIV_CODE: mktCode, FID_INPUT_ISCD: code, FID_PERIOD_DIV_CODE: 'Y' },
  }));
  const d = res.data.output?.[0] ?? {};
  const fin: Partial<StockFinancial> = {
    code,
    per:       parseFloat(d.per)  || undefined,
    pbr:       parseFloat(d.pbr)  || undefined,
    eps:       parseFloat(d.eps)  || undefined,
    bps:       parseFloat(d.bps)  || undefined,
    updatedAt: today,
  };
  await AsyncStorage.setItem(cacheKey, JSON.stringify(fin));
  return fin;
}

// ─── 20일 평균 거래량 (FHKST01010400) — 일 1회 캐시 ─────────────────────────

async function fetchAvgVolume20(code: string, client: AxiosInstance): Promise<number> {
  const today    = new Date().toISOString().slice(0, 10);
  const cacheKey = `${VOL_CACHE_PFX}${code}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const p = JSON.parse(cached);
      if (p.date === today) return p.avgVol;
    }
  } catch {}

  const toDate   = today.replace(/-/g, '');
  const fromDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  })();

  const mktCode2 = KOSPI200_SET.has(code) ? 'J' : 'Q';
  const res = await rateGet(() => client.get('/uapi/domestic-stock/v1/quotations/inquire-daily-price', {
    headers: { tr_id: 'FHKST01010400' },
    params: {
      FID_COND_MRKT_DIV_CODE: mktCode2,
      FID_INPUT_ISCD: code,
      FID_INPUT_DATE_1: fromDate,
      FID_INPUT_DATE_2: toDate,
      FID_PERIOD_DIV_CODE: 'D',
      FID_ORG_ADJ_PRC: '1',
    },
  }));
  const rows: any[] = res.data.output ?? [];
  const vols = rows.slice(0, 20).map((r: any) => parseInt(r.acml_vol, 10) || 0).filter(Boolean);
  const avgVol = vols.length > 0 ? Math.round(vols.reduce((a, b) => a + b, 0) / vols.length) : 0;
  await AsyncStorage.setItem(cacheKey, JSON.stringify({ date: today, avgVol }));
  return avgVol;
}

// ─── 지수 (KOSPI + 업종) — 세션 캐시 ────────────────────────────────────────

async function fetchKospiChange(client: AxiosInstance): Promise<number> {
  if (kospiChangeCache !== null) return kospiChangeCache;
  const res = await rateGet(() => client.get('/uapi/domestic-stock/v1/quotations/inquire-index-price', {
    headers: { tr_id: 'FHPUP02100000' },
    params: { FID_COND_MRKT_DIV_CODE: 'U', FID_INPUT_ISCD: '0001' },
  }));
  const d = res.data.output;
  kospiChangeCache = parseFloat(d.bstp_nmix_prdy_ctrt) || 0;
  return kospiChangeCache;
}

async function fetchSectorChange(sectorCode: string, client: AxiosInstance): Promise<{ changeRate: number; change5day: number }> {
  if (sectorCache[sectorCode]) return sectorCache[sectorCode];
  if (!sectorCode) return { changeRate: 0, change5day: 0 };
  try {
    const res = await rateGet(() => client.get('/uapi/domestic-stock/v1/quotations/inquire-index-price', {
      headers: { tr_id: 'FHPUP02100000' },
      params: { FID_COND_MRKT_DIV_CODE: 'U', FID_INPUT_ISCD: sectorCode },
    }));
    const d = res.data.output;
    const result = {
      changeRate: parseFloat(d.bstp_nmix_prdy_ctrt)  || 0,
      change5day: parseFloat(d.bstp_nmix_wghn_avrg)  || 0,
    };
    sectorCache[sectorCode] = result;
    return result;
  } catch {
    return { changeRate: 0, change5day: 0 };
  }
}

// ─── 섹터 평균 PER/PBR (정적 기본값) ─────────────────────────────────────────

const SECTOR_DEFAULTS: Record<string, { perSector: number; pbrSector: number; pfcrSector: number }> = {
  default:    { perSector: 12,  pbrSector: 1.2,  pfcrSector: 12 },
  전기전자:   { perSector: 18,  pbrSector: 1.8,  pfcrSector: 15 },
  반도체:     { perSector: 22,  pbrSector: 2.5,  pfcrSector: 18 },
  금융:       { perSector: 8,   pbrSector: 0.6,  pfcrSector: 8  },
  은행:       { perSector: 7,   pbrSector: 0.5,  pfcrSector: 7  },
  제약바이오: { perSector: 40,  pbrSector: 3.0,  pfcrSector: 30 },
  자동차:     { perSector: 10,  pbrSector: 0.8,  pfcrSector: 10 },
  화학:       { perSector: 11,  pbrSector: 1.0,  pfcrSector: 11 },
  철강:       { perSector: 9,   pbrSector: 0.7,  pfcrSector: 9  },
  건설:       { perSector: 10,  pbrSector: 0.9,  pfcrSector: 10 },
  통신:       { perSector: 14,  pbrSector: 1.1,  pfcrSector: 12 },
  유통:       { perSector: 15,  pbrSector: 1.3,  pfcrSector: 13 },
  엔터:       { perSector: 25,  pbrSector: 2.5,  pfcrSector: 20 },
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

export async function getScreenerData(code: string): Promise<StockScreenData> {
  const client = await getClient();

  const wrap = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    try { return await fn(); } catch (e: any) {
      const status = e?.response?.status;
      const msg    = e?.response?.data?.msg1 ?? e?.response?.data?.message ?? e?.message ?? '';
      throw new Error(`[${label}] ${status ? `HTTP ${status}: ` : ''}${msg}`);
    }
  };

  // rateGet이 전역 큐로 속도 제한 — 여기서는 순서 보장만
  const [priceData, investorData, financialData, avgVol20, kospiChg] = await Promise.all([
    wrap('현재가', () => fetchPrice(code, client)),
    wrap('투자자', () => fetchInvestor(code, client)),
    wrap('재무',   () => fetchFinancial(code, client)),
    wrap('거래량', () => fetchAvgVolume20(code, client)),
    wrap('지수',   () => fetchKospiChange(client)),
  ]);

  const sectorIdx = await fetchSectorChange(priceData.sectorCode, client);
  const sectorAvg = getSectorAvg(priceData.sectorName);

  return {
    ...priceData,
    ...investorData,
    per:        financialData.per,
    pbr:        financialData.pbr,
    eps:        financialData.eps,
    bps:        financialData.bps,
    pfcr:       undefined,
    fcfPerShare: undefined,
    ...sectorAvg,
    avgVolume20:       avgVol20,
    sectorChangeRate:  sectorIdx.changeRate,
    sectorChange:      sectorIdx.changeRate,
    sector5dayChange:  sectorIdx.change5day,
    kospiChange:       kospiChg,
    updatedAt:         new Date().toISOString().slice(0, 10),
  } as StockScreenData;
}

export const kisApi = {
  getStockPrice,
  getScreenerData,
  resetClient,
};
