// LLM 모델 다운로드 및 로드 훅
import { useCallback, useEffect } from 'react';
import { useLlmStore } from '../store/llmStore';
import {
  downloadModel,
  isModelDownloaded,
  loadModel,
} from '../services/llmService';
import RNFS from 'react-native-fs';

const MODEL_PATH = `${RNFS.DocumentDirectoryPath}/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf`;

export function useLlmModel() {
  const { status, downloadProgress, errorMessage, setStatus, setDownloadProgress, setError, setModelPath } =
    useLlmStore();

  // 다운로드 없이 이미 존재하는 모델만 로드 (앱 시작 시 자동 실행)
  const tryLoadExisting = useCallback(async () => {
    try {
      setStatus('checking');
      const downloaded = await isModelDownloaded();
      if (!downloaded) {
        setStatus('idle'); // 파일 없음 — 사용자가 수동으로 다운로드해야 함
        return;
      }
      setModelPath(MODEL_PATH);
      setStatus('loading');
      await loadModel();
      setStatus('ready');
    } catch (e: any) {
      setError(e?.message ?? '모델 로드 실패');
      setStatus('error');
    }
  }, []);

  // 사용자가 명시적으로 다운로드+로드 요청할 때 호출
  const startDownload = useCallback(async () => {
    try {
      setStatus('downloading');
      await downloadModel((pct) => setDownloadProgress(pct));
      setModelPath(MODEL_PATH);
      setStatus('loading');
      await loadModel();
      setStatus('ready');
    } catch (e: any) {
      setError(e?.message ?? '다운로드 실패');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (status === 'idle') {
      tryLoadExisting();
    }
  }, []);

  return {
    status,
    downloadProgress,
    errorMessage,
    isReady: status === 'ready',
    startDownload,
    retry: startDownload,
  };
}
