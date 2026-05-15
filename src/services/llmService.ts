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
  name: string;
  price: number;
  changeRate: number;
  volTurnover: number;
  foreignDays: number;
  foreignNet: number;       // 백만원
  institutionNet: number;   // 백만원
  retailNet: number;        // 백만원
  per?: number;
  pbr?: number;
  pcr?: number;
  sectorName: string;
  sectorChangeRate: number;
  kospiChange: number;
  volume: number;
  avgVolume20: number;
  prevVolume: number;
}): Promise<string> {
  if (!ctx) return '';
  try {
    const fmt = (n: number, d = 1) => n.toFixed(d);
    const bil = (won: number) => {
      const v = Math.round(won / 100);
      return (v >= 0 ? '+' : '') + v + '억';
    };
    const volM = (v: number) => (v / 10000).toFixed(0) + '만';

    const volPct = signal.prevVolume > 0
      ? (((signal.volume / signal.prevVolume) - 1) * 100).toFixed(0) + '%'
      : '-';
    const avgPct = signal.avgVolume20 > 0
      ? (((signal.volume / signal.avgVolume20) - 1) * 100).toFixed(0) + '%'
      : '-';

    const val = [
      signal.per  != null ? `PER ${fmt(signal.per)}` : null,
      signal.pbr  != null ? `PBR ${fmt(signal.pbr, 2)}` : null,
      signal.pcr  != null ? `PCR ${fmt(signal.pcr)}` : null,
    ].filter(Boolean).join(', ') || '밸류에이션 미제공';
const hints: string[] = [];
if (signal.per  && signal.per > 30) hints.push(`PER ${signal.per}은 고평가`);
if (signal.foreignNet < -200) hints.push(`외국인 ${bil(signal.foreignNet)}억은 대규모 순매도`);
if (signal.changeRate < -5) hints.push(`주가 ${fmt(signal.changeRate)}%는 급락`);
if (signal.foreignDays < -2) hints.push(`외국인 ${signal.foreignDays}일 연속 매도`);
const interpretation = hints.length > 0 
  ? `\n해석 힌트: ${hints.join(', ')}` 
  : '';

    const data =
`종목: ${signal.name} ${signal.price.toLocaleString()}원 (${signal.changeRate >= 0 ? '+' : ''}${fmt(signal.changeRate)}%)
시장: KOSPI ${signal.kospiChange >= 0 ? '+' : ''}${fmt(signal.kospiChange)}%, 업종 ${signal.sectorName} ${signal.sectorChangeRate >= 0 ? '+' : ''}${fmt(signal.sectorChangeRate)}%
밸류에이션: ${val}
투자자(억원): 외국인 ${bil(signal.foreignNet)}, 기관 ${bil(signal.institutionNet)}, 개인 ${bil(signal.retailNet)}
외국인 연속: ${signal.foreignDays >= 0 ? '+' : ''}${signal.foreignDays}일, 거래회전율: ${fmt(signal.volTurnover, 2)}%
거래량: ${volM(signal.volume)} (전일比 ${volPct}, 20일평균比 ${avgPct})
${interpretation}`;

    console.log('[LLM] 입력 데이터:' + data);

    // assistant 턴을 "판단: "로 시작 → 모델이 매수/매도/중립 단어 하나로 이어서 완성
    const prompt =
`<|im_start|>system
당신은 한국 주식  트레이딩 분석가입니다.
반드시 아래 규칙을 따르세요:
1. 첫 단어는 반드시 "매수", "매도", "중립" 중 하나입니다.
2. 첫 단어 뒤에 마침표를 찍습니다.
3. 이유를 2문장으로 작성합니다.
4. 절대로 예시 문장을 그대로 쓰지 마세요.
5. 분석 결과는 매수, 매도, 중립 중 꼭 하나만 나와야 합니다.
6. 같은 말을 반복하지 마세요. 
<|im_end|>
<|im_start|>user
${data}

위 종목을 분석하여 매수or매도or중립 중 꼭 하나만 추천하고, 해당 종목의 실제 데이터를 근거로 이유 4문장을 작성하세요.
<|im_end|>
<|im_start|>assistant
판단: `;

    const result = await ctx.completion({
      prompt,
      n_predict: 150,
      temperature: 0.3,
      stop: ['<|im_end|>', '<|endoftext|>', '<|im_start|>'],
    });
    return result.text.trim();
  } catch {
    return '';
  }
}
