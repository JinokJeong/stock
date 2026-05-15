// 종목 추천 스크리너 관련 타입 정의

export interface ScoreBreakdown {
  supply: number;    // 수급 점수 (0~40)
  value: number;     // 밸류에이션 점수 (0~35)
  momentum: number;  // 모멘텀 점수 (0~25)
}

export interface RecommendStock {
  code: string;
  name: string;
  market: 'KOSPI' | 'KOSDAQ';
  price: number;
  changeRate: number;
  score: number;             // 총점 0~100
  scoreBreakdown: ScoreBreakdown;
  volTurnover: number;
  foreignConsecutiveDays: number;
  institutionBuyAmount: number;
  pbr: number;
  per: number;
  pfcr: number;
  pbrSector: number;
  perSector: number;
  pfcrSector: number;
  volume: number;
  avgVolume20: number;
  sectorChangeRate: number;
  themeGrade?: string;
  themeKeyword?: string;
  aiComment?: string;
}

export type ScreenerPresetId =
  | 'smart_money'
  | 'value_bottom'
  | 'momentum_explosion'
  | 'theme_entry'
  | 'institution_leading'
  | 'breakout_confirm'
  | 'oversold_reversal'
  | 'custom';

export interface ScreenerState {
  results: RecommendStock[];
  scanning: boolean;
  progress: number;     // 0~1
  total: number;
  done: number;
  lastScanAt: number | null;
  selectedPreset: ScreenerPresetId;
  sortBy: 'score' | 'supply' | 'value' | 'momentum';
  filterMarket: 'ALL' | 'KOSPI' | 'KOSDAQ';
}
