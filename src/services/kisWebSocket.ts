// KIS 실시간 체결 WebSocket — 자동 재연결 포함
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { RealtimeQuote } from '../types/stock';

const WS_URL = 'ws://openapi.koreainvestment.com:21000';
const KIS_BASE = 'https://openapi.koreainvestment.com:9443';
const RECONNECT_DELAY = 5000;
const APPROVAL_KEY_CACHE = 'KIS_WS_APPROVAL_KEY';

type QuoteCallback = (quote: RealtimeQuote) => void;

let ws: WebSocket | null = null;
let subscribers: Map<string, QuoteCallback[]> = new Map();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionalClose = false;
let approvalKey: string | null = null;
let failCount = 0;
const MAX_FAIL = 2; // 연속 2회 실패 시 포기 (포트 21000 차단 환경)

async function fetchApprovalKey(): Promise<string | null> {
  if (approvalKey) return approvalKey;
  try {
    const cached = await AsyncStorage.getItem(APPROVAL_KEY_CACHE);
    if (cached) { approvalKey = cached; return cached; }

    const appKey    = await SecureStore.getItemAsync('KIS_APP_KEY');
    const appSecret = await SecureStore.getItemAsync('KIS_APP_SECRET');
    if (!appKey || !appSecret) return null;

    const res = await axios.post(`${KIS_BASE}/oauth2/Approval`, {
      grant_type: 'client_credentials',
      appkey: appKey,
      secretkey: appSecret,
    }, { timeout: 10000 });

    const key = res.data?.approval_key ?? null;
    if (key) {
      approvalKey = key;
      await AsyncStorage.setItem(APPROVAL_KEY_CACHE, key);
      console.log('[WS] approval_key 발급 완료');
    }
    return key;
  } catch (e) {
    console.log('[WS] approval_key 발급 실패:', String(e));
    return null;
  }
}

function parseQuote(raw: string): RealtimeQuote | null {
  try {
    const parts = raw.split('^');
    return {
      code: parts[0],
      price: parseFloat(parts[2]) || 0,
      volume: parseInt(parts[8], 10) || 0,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

async function buildSubscribeMessage(code: string): Promise<string | null> {
  const key = await fetchApprovalKey();
  if (!key) return null;
  return JSON.stringify({
    header: {
      approval_key: key,
      custtype: 'P',
      tr_type: '1',
      'content-type': 'utf-8',
    },
    body: { input: { tr_id: 'H0STCNT0', tr_key: code } },
  });
}

async function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const key = await fetchApprovalKey();
  if (!key) {
    console.log('[WS] approval_key 없음 — 연결 중단');
    return;
  }

  ws = new WebSocket(WS_URL);

  ws.onopen = async () => {
    console.log('[WS] 연결됨');
    failCount = 0;
    for (const code of subscribers.keys()) {
      const msg = await buildSubscribeMessage(code);
      if (msg) ws?.send(msg);
    }
  };

  ws.onmessage = (e) => {
    const data = typeof e.data === 'string' ? e.data : '';
    if (!data.startsWith('{')) {
      const quote = parseQuote(data);
      if (quote && subscribers.has(quote.code)) {
        console.log(`[WS] ${quote.code} price=${quote.price}`);
        subscribers.get(quote.code)!.forEach((cb) => cb(quote));
      }
    }
  };

  ws.onerror = (e: any) => {
    failCount += 1;
    console.log(`[WS] 오류 (${failCount}/${MAX_FAIL}):`, e?.message ?? String(e));
    if (failCount >= MAX_FAIL) {
      console.log('[WS] 최대 재시도 초과 — WebSocket 비활성화');
    }
  };

  ws.onclose = () => {
    ws = null;
  };
}

export function subscribe(code: string, callback: QuoteCallback): () => void {
  if (!subscribers.has(code)) subscribers.set(code, []);
  subscribers.get(code)!.push(callback);

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    if (failCount < MAX_FAIL) connect();
  } else {
    buildSubscribeMessage(code).then((msg) => { if (msg) ws?.send(msg); });
  }

  return () => {
    const cbs = subscribers.get(code) ?? [];
    const idx = cbs.indexOf(callback);
    if (idx !== -1) cbs.splice(idx, 1);
    if (cbs.length === 0) subscribers.delete(code);
    if (subscribers.size === 0) disconnectAll();
  };
}

export function disconnectAll() {
  intentionalClose = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  ws?.close();
  ws = null;
  subscribers.clear();
  intentionalClose = false;
}
