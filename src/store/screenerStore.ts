// 스크리너 결과 전역 스토어 — Zustand
import { create } from 'zustand';
import { ScreenerState, RecommendStock, ScreenerPresetId } from '../types/screener';

interface ScreenerStoreState extends ScreenerState {
  setResults: (results: RecommendStock[]) => void;
  setScanning: (scanning: boolean) => void;
  setProgress: (done: number, total: number) => void;
  setPreset: (preset: ScreenerPresetId) => void;
  setSortBy: (sortBy: ScreenerState['sortBy']) => void;
  setFilterMarket: (market: ScreenerState['filterMarket']) => void;
  reset: () => void;
}

const initialState: ScreenerState = {
  results: [],
  scanning: false,
  progress: 0,
  total: 0,
  done: 0,
  lastScanAt: null,
  selectedPreset: 'smart_money',
  sortBy: 'score',
  filterMarket: 'ALL',
};

export const useScreenerStore = create<ScreenerStoreState>((set) => ({
  ...initialState,
  setResults: (results) => set({ results, lastScanAt: Date.now() }),
  setScanning: (scanning) => set({ scanning }),
  setProgress: (done, total) =>
    set({ done, total, progress: total > 0 ? done / total : 0 }),
  setPreset: (selectedPreset) => set({ selectedPreset }),
  setSortBy: (sortBy) => set({ sortBy }),
  setFilterMarket: (filterMarket) => set({ filterMarket }),
  reset: () => set(initialState),
}));
