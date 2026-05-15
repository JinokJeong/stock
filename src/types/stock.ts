// 주식 데이터 관련 타입 정의

export interface StockPrice {
  code: string;
  name: string;
  price: number;
  change: number;
  changeRate: number;
  volume: number;
  volTurnover: number;     // 거래회전율 (vol_tnrt)
  netBuyCount: number;     // 순매수 체결 건수
}

export interface StockInvestor {
  code: string;
  foreignBuyAmount: number;
  foreignSellAmount: number;
  foreignNetAmount: number;
  institutionBuyAmount: number;
  institutionSellAmount: number;
  institutionNetAmount: number;
  retailNetAmount: number;
  foreignConsecutiveDays: number;    // 외국인 연속 순매수 일수 (음수면 순매도)
  institutionConsecutiveDays: number;
  foreignTurnedPositive: boolean;    // 외국인 금일 전환 매수
  investorUpdatedAt?: string;        // 가집계 시각 HH:MM 또는 "MM/DD 전일"
  // 장 중 수량 기반 추정 (당일 _tr_pbmn 미제공 시)
  foreignNetQty?: number;
  institutionNetQty?: number;
  retailNetQty?: number;
  investorIsEstimated?: boolean;     // true = 수량×현재가 추정치
  // 전일 확정 금액 (investorIsEstimated=true 일 때 함께 표시)
  prevForeignNetAmount?: number;
  prevInstitutionNetAmount?: number;
  prevRetailNetAmount?: number;
  prevInvestorDate?: string;         // YYYYMMDD
}

export interface StockFinancial {
  code: string;
  per: number;
  pbr: number;
  pcr: number;      // Price / Cash flow Ratio
  pfcr: number;     // Price / Free Cash flow Ratio (legacy)
  eps: number;
  bps: number;
  fcfPerShare: number;
  perSector: number;
  pbrSector: number;
  pcrSector: number;
  pfcrSector: number;
  updatedAt: string;
}

export interface StockData extends StockPrice, StockInvestor {
  per?: number;
  pbr?: number;
  pcr?: number;     // Price / Cash flow Ratio
  pfcr?: number;          // Price / Free Cash flow Ratio
  pcrEstimated?: boolean;  // true = NI 기반 OCF 추정치
  pfcrEstimated?: boolean; // true = PCR 기반 추정치
  eps?: number;
  bps?: number;
  fcfPerShare?: number;
  roe?: number;
  roeSector?: number;
  perSector?: number;
  pbrSector?: number;
  pcrSector?: number;
  pfcrSector?: number;
  updatedAt?: string;
  lstnStcn: number;
  avgVolume20: number;
  prevVolume: number;
  sectorCode: string;
  sectorName: string;
  sectorChange: number;
  sectorChangeRate: number;
  kospiChange: number;
  sector5dayChange: number;
  market: 'KOSPI' | 'KOSDAQ';
  // 시간외 단일가 (장후)
  afterHoursPrice?: number;
  afterHoursChange?: number;
  afterHoursChangeRate?: number;
  // 장전 예상체결가
  preMarketPrice?: number;
  preMarketChange?: number;
  preMarketChangeRate?: number;
}

export interface StockScreenData extends StockData {
  themeGrade?: string;
}

export interface RealtimeQuote {
  code: string;
  price: number;
  volume: number;
  timestamp: number;
}
