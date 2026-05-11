// 알림 조건 및 프리셋 관련 타입 정의

export type ConditionType =
  | '체결강도'
  | '외국인순매수'
  | '기관순매수'
  | 'PBR'
  | 'PER'
  | 'P/FCR'
  | '거래량'
  | '업종지수';

export type ConditionOp =
  | 'gte'
  | 'lte'
  | 'consecutive'
  | 'gte_amount'
  | 'lte_absolute'
  | 'lte_sector_ratio'
  | 'gte_prev_ratio'
  | 'gte_avg20_ratio'
  | 'turn_positive'
  | 'outperform_kospi'
  | 'lte_5day_drop';

export interface AlertCondition {
  type: ConditionType;
  op: ConditionOp;
  value?: number;
  ratio?: number;
  days?: number;
}

export type LogicOperator = 'AND' | 'OR';

export interface AlertPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  expectedFreq: string;
  reliability: number;   // 1~5
  conditions: AlertCondition[];
  logic: LogicOperator[];
}

export interface UserAlert {
  id: string;
  presetId?: string;
  name: string;
  conditions: AlertCondition[];
  logic: LogicOperator[];
  enabled: boolean;
  targetCode?: string;   // 특정 종목 또는 undefined(전체)
  createdAt: number;
}
