// 테마 분석 관련 타입 정의

export type ThemeGrade = '관심' | '주목' | '급부상' | '과열';

export interface ThemeScore {
  sectorCode: string;
  sectorName: string;
  score: number;          // 0~100
  grade: ThemeGrade;
  quantScore: number;     // 정량 파트 (업종지수 z-score 기반)
  qualScore: number;      // 정성 파트 (LLM 감성 기반)
  sectorChangeRate: number;
  newsCount: number;
  updatedAt: number;      // timestamp
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  corpCode?: string;
  corpName?: string;
  sentiment?: number;    // 0~1 (LLM 분석)
  urgency?: number;      // 0~1
  summary?: string;
}

export interface SentimentResult {
  sentiment: number;   // 0~1
  urgency: number;     // 0~1
  summary: string;
}
