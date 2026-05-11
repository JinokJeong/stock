// 테마 스코어 전역 스토어 — Zustand
import { create } from 'zustand';
import { ThemeScore, NewsItem } from '../types/theme';

interface ThemeStoreState {
  themes: ThemeScore[];
  news: NewsItem[];
  lastUpdated: number | null;
  isAnalyzing: boolean;
  setThemes: (themes: ThemeScore[]) => void;
  setNews: (news: NewsItem[]) => void;
  setAnalyzing: (v: boolean) => void;
}

export const useThemeStore = create<ThemeStoreState>((set) => ({
  themes: [],
  news: [],
  lastUpdated: null,
  isAnalyzing: false,
  setThemes: (themes) => set({ themes, lastUpdated: Date.now() }),
  setNews: (news) => set({ news }),
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
}));
