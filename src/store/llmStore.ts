// LLM 로드 상태 전역 스토어 — Zustand
import { create } from 'zustand';
import { LlmState, LlmStatus } from '../types/llm';

interface LlmStoreState extends LlmState {
  setStatus: (status: LlmStatus) => void;
  setDownloadProgress: (progress: number) => void;
  setError: (message: string | null) => void;
  setModelPath: (path: string | null) => void;
  reset: () => void;
}

const initialState: LlmState = {
  status: 'idle',
  downloadProgress: 0,
  errorMessage: null,
  modelPath: null,
};

export const useLlmStore = create<LlmStoreState>((set) => ({
  ...initialState,
  setStatus: (status) => set({ status }),
  setDownloadProgress: (downloadProgress) => set({ downloadProgress }),
  setError: (errorMessage) => set({ errorMessage }),
  setModelPath: (modelPath) => set({ modelPath }),
  reset: () => set(initialState),
}));
