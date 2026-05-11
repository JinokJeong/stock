// 실시간 체결 가격 구독 훅 — KIS WebSocket 연결
import { useEffect } from 'react';
import { subscribe } from '../services/kisWebSocket';
import { useStockStore } from '../store/stockStore';

export function useRealTimePrice(code: string) {
  const updateQuote = useStockStore((s) => s.updateQuote);

  useEffect(() => {
    const unsubscribe = subscribe(code, (quote) => {
      updateQuote(quote);
    });
    return unsubscribe;
  }, [code]);

  const quotes = useStockStore((s) => s.quotes);
  return quotes[code] ?? null;
}
