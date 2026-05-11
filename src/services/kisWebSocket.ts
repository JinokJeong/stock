// KIS 실시간 체결 WebSocket — 자동 재연결 포함
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { RealtimeQuote } from '../types/stock';

const WS_URL = 'ws://openapi.koreainvestment.com:21000';
const RECONNECT_DELAY = 3000;

type QuoteCallback = (quote: RealtimeQuote) => void;

let ws: WebSocket | null = null;
let subscribers: Map<string, QuoteCallback[]> = new Map();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionalClose = false;

function parseQuote(raw: string): RealtimeQuote | null {
  try {
    const parts = raw.split('^');
    return {
      code: parts[0],
      price: parseFloat(parts[2]) || 0,
      volume: parseInt(parts[8], 10) || 0,
      tradeStrength: parseFloat(parts[12]) || 100,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

async function buildSubscribeMessage(code: string): Promise<string> {
  const token = await AsyncStorage.getItem('KIS_ACCESS_TOKEN');
  const appKey = await SecureStore.getItemAsync('KIS_APP_KEY');
  const appSecret = await SecureStore.getItemAsync('KIS_APP_SECRET');

  return JSON.stringify({
    header: {
      approval_key: token ?? '',
      custtype: 'P',
      tr_type: '1',
      'content-type': 'utf-8',
    },
    body: {
      input: {
        tr_id: 'H0STCNT0',
        tr_key: code,
      },
    },
  });
}

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = async () => {
    for (const code of subscribers.keys()) {
      const msg = await buildSubscribeMessage(code);
      ws?.send(msg);
    }
  };

  ws.onmessage = (e) => {
    const data = typeof e.data === 'string' ? e.data : '';
    if (!data.startsWith('{')) {
      const quote = parseQuote(data);
      if (quote && subscribers.has(quote.code)) {
        subscribers.get(quote.code)!.forEach((cb) => cb(quote));
      }
    }
  };

  ws.onerror = () => {};

  ws.onclose = () => {
    ws = null;
    if (!intentionalClose) {
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
    }
  };
}

export function subscribe(code: string, callback: QuoteCallback): () => void {
  if (!subscribers.has(code)) {
    subscribers.set(code, []);
  }
  subscribers.get(code)!.push(callback);

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connect();
  } else {
    buildSubscribeMessage(code).then((msg) => ws?.send(msg));
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
