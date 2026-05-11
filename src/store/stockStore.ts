// 실시간 주식 데이터 전역 스토어 — Zustand
import { create } from 'zustand';
import { StockData, RealtimeQuote } from '../types/stock';

interface StockStoreState {
  watchlist: string[];
  stocks: Record<string, StockData>;
  quotes: Record<string, RealtimeQuote>;
  selectedCode: string | null;
  addToWatchlist: (code: string) => void;
  removeFromWatchlist: (code: string) => void;
  updateStock: (code: string, partial: Partial<StockData>) => void;
  updateQuote: (quote: RealtimeQuote) => void;
  setSelected: (code: string | null) => void;
}

export const useStockStore = create<StockStoreState>((set) => ({
  watchlist: ['005930', '000660', '373220', '005380', '247540'],
  stocks: {},
  quotes: {},
  selectedCode: null,

  addToWatchlist: (code) =>
    set((s) => ({
      watchlist: s.watchlist.includes(code) ? s.watchlist : [...s.watchlist, code],
    })),

  removeFromWatchlist: (code) =>
    set((s) => ({ watchlist: s.watchlist.filter((c) => c !== code) })),

  updateStock: (code, partial) =>
    set((s) => ({
      stocks: { ...s.stocks, [code]: { ...(s.stocks[code] ?? {}), ...partial } as StockData },
    })),

  updateQuote: (quote) =>
    set((s) => ({
      quotes: { ...s.quotes, [quote.code]: quote },
      stocks: s.stocks[quote.code]
        ? {
            ...s.stocks,
            [quote.code]: {
              ...s.stocks[quote.code],
              price: quote.price,
              volume: quote.volume,
              tradeStrength: quote.tradeStrength,
            },
          }
        : s.stocks,
    })),

  setSelected: (code) => set({ selectedCode: code }),
}));
