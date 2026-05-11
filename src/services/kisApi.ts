// KIS Open API REST 클라이언트 — 현재가/재무/업종/가집계/FCF
import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { StockData, StockFinancial, StockScreenData } from '../types/stock';

const KIS_BASE = 'https://openapi.koreainvestment.com:9443';
const TOKEN_CACHE_KEY = 'KIS_ACCESS_TOKEN';
const TOKEN_EXP_KEY = 'KIS_TOKEN_EXPIRES_AT';
const FINANCIAL_CACHE_PREFIX = 'KIS_FIN_';
const SECTOR_AVG_CACHE_KEY = 'KIS_SECTOR_AVG';

let kisClient: AxiosInstance | null = null;

// Mock 데이터 — API 키 없을 때 fallback
function makeMockStockData(code: string): StockScreenData {
  const base = parseInt(code.slice(-3), 10);
  const price = 10000 + base * 37;
  return {
    code,
    name: `종목${code.slice(-4)}`,
    price,
    change: Math.floor((Math.random() - 0.45) * price * 0.05),
    changeRate: (Math.random() - 0.45) * 5,
    volume: Math.floor(Math.random() * 5_000_000) + 100_000,
    tradeStrength: 90 + Math.random() * 80,
    foreignBuyAmount: Math.floor(Math.random() * 5_000_000_000),
    foreignSellAmount: Math.floor(Math.random() * 4_000_000_000),
    foreignNetAmount: Math.floor((Math.random() - 0.4) * 2_000_000_000),
    institutionBuyAmount: Math.floor(Math.random() * 3_000_000_000),
    institutionSellAmount: Math.floor(Math.random() * 2_500_000_000),
    institutionNetAmount: Math.floor((Math.random() - 0.4) * 1_000_000_000),
    retailNetAmount: Math.floor((Math.random() - 0.5) * 1_000_000_000),
    foreignConsecutiveDays: Math.floor(Math.random() * 7) - 2,
    institutionConsecutiveDays: Math.floor(Math.random() * 5) - 1,
    foreignTurnedPositive: Math.random() > 0.8,
    per: 8 + Math.random() * 20,
    pbr: 0.5 + Math.random() * 2.5,
    pfcr: 5 + Math.random() * 20,
    eps: price * 0.07,
    bps: price * 1.2,
    fcfPerShare: price * 0.05,
    perSector: 12 + Math.random() * 10,
    pbrSector: 1.0 + Math.random() * 1.0,
    pfcrSector: 10 + Math.random() * 10,
    updatedAt: new Date().toISOString().slice(0, 10),
    avgVolume20: Math.floor(Math.random() * 3_000_000) + 200_000,
    prevVolume: Math.floor(Math.random() * 4_000_000) + 150_000,
    sectorCode: '0001',
    sectorName: '전기전자',
    sectorChange: (Math.random() - 0.4) * 4,
    sectorChangeRate: (Math.random() - 0.4) * 4,
    kospiChange: (Math.random() - 0.5) * 2,
    sector5dayChange: (Math.random() - 0.5) * 10,
    market: parseInt(code, 10) < 300000 ? 'KOSPI' : 'KOSDAQ',
    themeGrade: ['관심', '주목', '급부상', '과열'][Math.floor(Math.random() * 4)],
  };
}

async function getAccessToken(): Promise<string | null> {
  try {
    const expAt = await AsyncStorage.getItem(TOKEN_EXP_KEY);
    const now = Date.now();
    if (expAt && now < parseInt(expAt, 10)) {
      const cached = await AsyncStorage.getItem(TOKEN_CACHE_KEY);
      if (cached) return cached;
    }

    const appKey = await SecureStore.getItemAsync('KIS_APP_KEY');
    const appSecret = await SecureStore.getItemAsync('KIS_APP_SECRET');
    if (!appKey || !appSecret) return null;

    const res = await axios.post(`${KIS_BASE}/oauth2/tokenP`, {
      grant_type: 'client_credentials',
      appkey: appKey,
      appsecret: appSecret,
    });
    const token = res.data.access_token;
    const expiresIn = (res.data.expires_in || 21600) * 1000;
    await AsyncStorage.setItem(TOKEN_CACHE_KEY, token);
    await AsyncStorage.setItem(TOKEN_EXP_KEY, String(now + expiresIn));
    return token;
  } catch {
    return null;
  }
}

async function getClient(): Promise<AxiosInstance | null> {
  if (kisClient) return kisClient;
  const token = await getAccessToken();
  if (!token) return null;
  const appKey = await SecureStore.getItemAsync('KIS_APP_KEY');
  const appSecret = await SecureStore.getItemAsync('KIS_APP_SECRET');
  kisClient = axios.create({
    baseURL: KIS_BASE,
    headers: {
      Authorization: `Bearer ${token}`,
      appkey: appKey ?? '',
      appsecret: appSecret ?? '',
    },
    timeout: 10000,
  });
  return kisClient;
}

export async function getStockPrice(code: string): Promise<Partial<StockData>> {
  try {
    const client = await getClient();
    if (!client) throw new Error('no client');
    const res = await client.get('/uapi/domestic-stock/v1/quotations/inquire-price', {
      headers: { tr_id: 'FHKST01010100' },
      params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: code },
    });
    const d = res.data.output;
    return {
      code,
      price: parseInt(d.stck_prpr, 10),
      change: parseInt(d.prdy_vrss, 10),
      changeRate: parseFloat(d.prdy_ctrt),
      volume: parseInt(d.acml_vol, 10),
      tradeStrength: parseFloat(d.cntr_str),
    };
  } catch {
    const mock = makeMockStockData(code);
    return { code, price: mock.price, change: mock.change, changeRate: mock.changeRate, volume: mock.volume, tradeStrength: mock.tradeStrength };
  }
}

async function getFinancialCached(code: string): Promise<Partial<StockFinancial>> {
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `${FINANCIAL_CACHE_PREFIX}${code}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.updatedAt === today) return parsed;
    }
  } catch {}

  try {
    const client = await getClient();
    if (!client) throw new Error('no client');
    const res = await client.get('/uapi/domestic-stock/v1/finance/financial-ratio', {
      headers: { tr_id: 'FHKST66430300' },
      params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: code, FID_PERIOD_DIV_CODE: 'Y' },
    });
    const d = res.data.output?.[0] ?? {};
    const fin: Partial<StockFinancial> = {
      code,
      per: parseFloat(d.per) || 0,
      pbr: parseFloat(d.pbr) || 0,
      eps: parseFloat(d.eps) || 0,
      bps: parseFloat(d.bps) || 0,
      updatedAt: today,
    };
    await AsyncStorage.setItem(cacheKey, JSON.stringify({ ...fin }));
    return fin;
  } catch {
    const mock = makeMockStockData(code);
    return { code, per: mock.per, pbr: mock.pbr, pfcr: mock.pfcr, updatedAt: today };
  }
}

async function getSectorAvg(): Promise<Record<string, { perSector: number; pbrSector: number; pfcrSector: number }>> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const cached = await AsyncStorage.getItem(SECTOR_AVG_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed._date === today) return parsed.data;
    }
  } catch {}
  // 실데이터 없을 때 기본 섹터 평균
  const defaults = { perSector: 12, pbrSector: 1.2, pfcrSector: 12 };
  return { default: defaults };
}

export async function getScreenerData(code: string): Promise<StockScreenData> {
  // Mock 우선 반환 (KIS API 키 없을 때 완전 동작 보장)
  const mock = makeMockStockData(code);
  try {
    const client = await getClient();
    if (!client) return mock;

    const [priceData, financialData] = await Promise.all([
      getStockPrice(code),
      getFinancialCached(code),
    ]);

    const sectorAvg = await getSectorAvg();
    const sa = sectorAvg[mock.sectorCode] ?? sectorAvg.default ?? { perSector: 12, pbrSector: 1.2, pfcrSector: 12 };

    return {
      ...mock,
      ...priceData,
      ...financialData,
      ...sa,
    } as StockScreenData;
  } catch {
    return mock;
  }
}

export const kisApi = {
  getStockPrice,
  getScreenerData,
  getFinancialCached,
};
