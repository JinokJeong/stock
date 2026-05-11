// 온디바이스 LLM 서비스 — llama.rn 래퍼, 감성 분석 + 종목 코멘트 생성
import RNFS from 'react-native-fs';
import { SentimentResult } from '../types/theme';

const MODEL_URL =
  'https://huggingface.co/bartowski/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf';
const MODEL_PATH = `${RNFS.DocumentDirectoryPath}/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf`;
const MIN_MODEL_SIZE = 250 * 1024 * 1024; // 250MB — 정상 파일 최소 크기 (실제 ~380MB)

// llama.rn 동적 import (네이티브 빌드 전용)
let ctx: any = null;
let llamaModule: any = null;

async function getLlamaModule() {
  if (llamaModule) return llamaModule;
  try {
    llamaModule = require('llama.rn');
    return llamaModule;
  } catch {
    return null;
  }
}

async function getFileSize(path: string): Promise<number> {
  try {
    const stat = await RNFS.stat(path);
    return Number(stat.size);
  } catch {
    return 0;
  }
}

async function deleteIfExists(path: string): Promise<void> {
  try {
    if (await RNFS.exists(path)) await RNFS.unlink(path);
  } catch {}
}

export async function isModelDownloaded(): Promise<boolean> {
  if (!(await RNFS.exists(MODEL_PATH))) return false;
  const size = await getFileSize(MODEL_PATH);
  if (size < MIN_MODEL_SIZE) {
    // 불완전한 파일 삭제
    await deleteIfExists(MODEL_PATH);
    return false;
  }
  return true;
}

export async function downloadModel(
  onProgress: (pct: number) => void
): Promise<void> {
  // 이미 유효한 파일이 있으면 건너뜀
  if (await isModelDownloaded()) {
    onProgress(1);
    return;
  }
  // 혹시 남은 불완전 파일 제거 후 새로 다운로드
  await deleteIfExists(MODEL_PATH);

  const result = await RNFS.downloadFile({
    fromUrl: MODEL_URL,
    toFile: MODEL_PATH,
    background: true,
    progress: (r) => {
      if (r.contentLength > 0) {
        onProgress(r.bytesWritten / r.contentLength);
      }
    },
    progressDivider: 5,
  }).promise;

  if (result.statusCode !== 200) {
    await deleteIfExists(MODEL_PATH);
    throw new Error(`다운로드 실패 (HTTP ${result.statusCode})`);
  }

  const size = await getFileSize(MODEL_PATH);
  if (size < MIN_MODEL_SIZE) {
    await deleteIfExists(MODEL_PATH);
    throw new Error(`파일 불완전 (${Math.round(size / 1024 / 1024)}MB — 최소 500MB 필요)`);
  }
}

export async function loadModel(): Promise<void> {
  if (ctx) return;
  const llama = await getLlamaModule();
  if (!llama) throw new Error('llama.rn 모듈 없음 — Dev Build 필요');

  if (!(await RNFS.exists(MODEL_PATH))) {
    throw new Error('모델 파일 없음 — 먼저 다운로드 필요');
  }

  ctx = await llama.initLlama({
    model: MODEL_PATH,
    use_mlock: false,
    n_ctx: 512,
    n_gpu_layers: 0,
  });
}

export function isModelLoaded(): boolean {
  return ctx !== null;
}

export async function releaseModel(): Promise<void> {
  if (ctx) {
    await ctx.release?.();
    ctx = null;
  }
}

export async function analyzeNewsSentiment(
  newsText: string
): Promise<SentimentResult> {
  const fallback: SentimentResult = {
    sentiment: 0.5,
    urgency: 0.5,
    summary: newsText.slice(0, 30),
  };
  if (!ctx) return fallback;

  try {
    const result = await ctx.completion({
      prompt: `한국 주식 뉴스 분석. JSON만 출력. 다른 텍스트 금지.\n뉴스:"${newsText.slice(0, 200)}"\n출력:{"sentiment":0.0~1.0,"urgency":0.0~1.0,"summary":"한줄"}`,
      n_predict: 80,
      temperature: 0.1,
      stop: ['\n\n'],
    });
    const parsed = JSON.parse(result.text.trim());
    return {
      sentiment: Number(parsed.sentiment) || 0.5,
      urgency: Number(parsed.urgency) || 0.5,
      summary: String(parsed.summary || newsText.slice(0, 30)),
    };
  } catch {
    return fallback;
  }
}

export async function generateStockComment(signal: {
  tradeStrength: number;
  foreignDays: number;
  pbr: number;
  pfcr: number;
  themeName: string;
}): Promise<string> {
  if (!ctx) return '';
  try {
    const result = await ctx.completion({
      prompt: `체결강도${signal.tradeStrength},외국인${signal.foreignDays}일순매수,PBR${signal.pbr.toFixed(2)},P/FCR${signal.pfcr.toFixed(1)},테마:${signal.themeName}. 투자신호 한 문장:`,
      n_predict: 60,
      temperature: 0.3,
      stop: ['\n'],
    });
    return result.text.trim();
  } catch {
    return '';
  }
}
