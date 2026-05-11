// 온디바이스 LLM 서비스 — llama.rn 래퍼, 감성 분석 + 종목 코멘트 생성
import RNFS from 'react-native-fs';
import { SentimentResult } from '../types/theme';

const MODEL_URL =
  'https://huggingface.co/bartowski/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf';
const MODEL_PATH = `${RNFS.DocumentDirectoryPath}/gemma-3-1b-it-Q4_K_M.gguf`;

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

export async function isModelDownloaded(): Promise<boolean> {
  return RNFS.exists(MODEL_PATH);
}

export async function downloadModel(
  onProgress: (pct: number) => void
): Promise<void> {
  if (await RNFS.exists(MODEL_PATH)) {
    onProgress(1);
    return;
  }
  await RNFS.downloadFile({
    fromUrl: MODEL_URL,
    toFile: MODEL_PATH,
    progress: (r) => onProgress(r.bytesWritten / r.contentLength),
    progressDivider: 2,
  }).promise;
}

export async function loadModel(): Promise<void> {
  if (ctx) return;
  const llama = await getLlamaModule();
  if (!llama) throw new Error('llama.rn 모듈 없음 — Dev Build 필요');
  ctx = await llama.initLlama({
    model: MODEL_PATH,
    use_mlock: true,
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
