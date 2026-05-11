// 테마 스코어 계산 — 순수 JS, LLM 없이도 정량 파트 독립 동작
import { ThemeGrade } from '../types/theme';

export function calcThemeScore(
  sectorChangeRate: number,
  sectorHistory: number[],
  sentiment: number,
  urgency: number
): number {
  const history = sectorHistory.length > 0 ? sectorHistory : [0];
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance = history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length;
  const std = Math.sqrt(variance);
  const zscore = std === 0 ? 0 : (sectorChangeRate - mean) / std;
  const quant = Math.min(Math.max(zscore / 3.0, 0), 1.0) * 100;
  const qual = (sentiment * 0.5 + urgency * 0.5) * 100;
  return Math.round(quant * 0.6 + qual * 0.4);
}

export function getGrade(score: number): ThemeGrade {
  if (score >= 80) return '과열';
  if (score >= 60) return '급부상';
  if (score >= 40) return '주목';
  return '관심';
}
