// LLM 모델 다운로드 및 로드 훅
import { useCallback, useEffect } from 'react';
import { useLlmStore } from '../store/llmStore';
import {
  downloadModel,
  isModelDownloaded,
  loadModel,
} from '../services/llmService';
import RNFS from 'react-native-fs';

const MODEL_PATH = `${RNFS.DocumentDirectoryPath}/gemma-3-1b-it-Q4_K_M.gguf`;

export function useLlmModel() {
  const { status, downloadProgress, errorMessage, setStatus, setDownloadProgress, setError, setModelPath } =
    useLlmStore();

  const initModel = useCallback(async () => {
    try {
      setStatus('checking');
      const downloaded = await isModelDownloaded();

      if (!downloaded) {
        setStatus('downloading');
        await downloadModel((pct) => setDownloadProgress(pct));
      }

      setModelPath(MODEL_PATH);
      setStatus('loading');
      await loadModel();
      setStatus('ready');
    } catch (e: any) {
      setError(e?.message ?? '알 수 없는 오류');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (status === 'idle') {
      initModel();
    }
  }, []);

  return {
    status,
    downloadProgress,
    errorMessage,
    isReady: status === 'ready',
    retry: initModel,
  };
}
