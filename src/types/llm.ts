// 온디바이스 LLM 관련 타입 정의

export type LlmStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'error';

export interface LlmState {
  status: LlmStatus;
  downloadProgress: number;  // 0~1
  errorMessage: string | null;
  modelPath: string | null;
}

export interface CompletionResult {
  text: string;
  tokenCount: number;
}
