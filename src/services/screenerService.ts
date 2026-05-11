// 종목 스크리너 — 전체 종목 복합 조건 필터링 + 스코어 계산
import { STOCK_UNIVERSE } from '../constants/stockUniverse';
import { kisApi } from './kisApi';
import { evaluateConditions } from './alertEngine';
import { AlertCondition, LogicOperator } from '../types/alert';
import { RecommendStock, ScoreBreakdown } from '../types/screener';
import { StockScreenData } from '../types/stock';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calcSupplyScore(s: StockScreenData): number {
  let score = 0;
  if (s.foreignConsecutiveDays >= 3) score += 20;
  else if (s.foreignConsecutiveDays >= 1) score += 8;
  if (s.institutionBuyAmount > 0) score += 10;
  if (s.tradeStrength >= 140) score += 10;
  else if (s.tradeStrength >= 120) score += 5;
  return score;
}

function calcValueScore(s: StockScreenData): number {
  let score = 0;
  const pbrSector = s.pbrSector ?? 1.2;
  const perSector = s.perSector ?? 12;
  const pfcrSector = s.pfcrSector ?? 12;
  if (s.pbr !== undefined) {
    if (s.pbr < pbrSector * 0.7) score += 15;
    else if (s.pbr < pbrSector * 0.9) score += 8;
  }
  if (s.per !== undefined) {
    if (s.per < perSector * 0.7) score += 10;
    else if (s.per < perSector * 0.9) score += 5;
  }
  if (s.pfcr !== undefined) {
    if (s.pfcr < pfcrSector * 0.7) score += 10;
    else if (s.pfcr < pfcrSector * 0.9) score += 5;
  }
  return score;
}

function calcMomentumScore(s: StockScreenData): number {
  let score = 0;
  if (s.avgVolume20 > 0) {
    if (s.volume >= s.avgVolume20 * 2.0) score += 10;
    else if (s.volume >= s.avgVolume20 * 1.5) score += 5;
  }
  if (s.sectorChangeRate >= 2.0) score += 10;
  else if (s.sectorChangeRate >= 1.0) score += 5;
  if (s.themeGrade === '급부상' || s.themeGrade === '과열') score += 5;
  return score;
}

export function calcRecommendScore(s: StockScreenData): number {
  return Math.min(calcSupplyScore(s) + calcValueScore(s) + calcMomentumScore(s), 100);
}

export async function runScreener(
  conditions: AlertCondition[],
  logic: LogicOperator[],
  onProgress: (done: number, total: number) => void
): Promise<RecommendStock[]> {
  const results: RecommendStock[] = [];
  const universe = STOCK_UNIVERSE;

  for (let i = 0; i < universe.length; i++) {
    const code = universe[i];
    try {
      const data = await kisApi.getScreenerData(code);
      const passes = conditions.length === 0 || evaluateConditions(conditions, logic, data);
      if (passes) {
        const supply = calcSupplyScore(data);
        const value = calcValueScore(data);
        const momentum = calcMomentumScore(data);
        const score = Math.min(supply + value + momentum, 100);
        const breakdown: ScoreBreakdown = { supply, value, momentum };

        results.push({
          code: data.code,
          name: data.name,
          market: data.market,
          price: data.price,
          changeRate: data.changeRate,
          score,
          scoreBreakdown: breakdown,
          tradeStrength: data.tradeStrength,
          foreignConsecutiveDays: data.foreignConsecutiveDays,
          institutionBuyAmount: data.institutionBuyAmount,
          pbr: data.pbr ?? 0,
          per: data.per ?? 0,
          pfcr: data.pfcr ?? 0,
          pbrSector: data.pbrSector ?? 1.2,
          perSector: data.perSector ?? 12,
          pfcrSector: data.pfcrSector ?? 12,
          volume: data.volume,
          avgVolume20: data.avgVolume20,
          sectorChangeRate: data.sectorChangeRate,
          themeGrade: data.themeGrade,
          themeKeyword: data.sectorName,
        });
      }
    } catch {}

    onProgress(i + 1, universe.length);

    // API 호출 제한: 초당 최대 20건 (20건마다 1초 대기)
    if (i % 20 === 19) await sleep(1000);
  }

  return results.sort((a, b) => b.score - a.score);
}
