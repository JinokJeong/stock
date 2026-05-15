// 실시간 주식 데이터 전역 스토어 — Zustand
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StockData, RealtimeQuote } from '../types/stock';

const WATCHLIST_KEY = 'WATCHLIST_V1';
const DEFAULT_WATCHLIST = ['005930', '000660', '373220', '005380', '010120'];

interface StockStoreState {
  watchlist: string[];
  stocks: Record<string, StockData>;
  quotes: Record<string, RealtimeQuote>;
  selectedCode: string | null;
  watchlistLoaded: boolean;
  addToWatchlist: (code: string) => void;
  removeFromWatchlist: (code: string) => void;
  reorderWatchlist: (from: number, to: number) => void;
  loadWatchlist: () => Promise<void>;
  updateStock: (code: string, partial: Partial<StockData>) => void;
  updateQuote: (quote: RealtimeQuote) => void;
  setSelected: (code: string | null) => void;
}

async function saveWatchlist(list: string[]) {
  try { await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(list)); } catch {}
}

export const useStockStore = create<StockStoreState>((set, get) => ({
  watchlist: DEFAULT_WATCHLIST,
  stocks: {},
  quotes: {},
  selectedCode: null,
  watchlistLoaded: false,

  loadWatchlist: async () => {
    try {
      const raw = await AsyncStorage.getItem(WATCHLIST_KEY);
      const list: string[] = raw ? JSON.parse(raw) : DEFAULT_WATCHLIST;
      set({ watchlist: list, watchlistLoaded: true });
    } catch {
      set({ watchlistLoaded: true });
    }
  },

  addToWatchlist: (code) =>
    set((s) => {
      if (s.watchlist.includes(code)) return s;
      const next = [...s.watchlist, code];
      saveWatchlist(next);
      return { watchlist: next };
    }),

  removeFromWatchlist: (code) =>
    set((s) => {
      const next = s.watchlist.filter((c) => c !== code);
      saveWatchlist(next);
      return { watchlist: next };
    }),

  reorderWatchlist: (from, to) =>
    set((s) => {
      const next = [...s.watchlist];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      saveWatchlist(next);
      return { watchlist: next };
    }),

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
            },
          }
        : s.stocks,
    })),

  setSelected: (code) => set({ selectedCode: code }),
}));
