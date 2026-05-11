// 알림 조건 카드 — 개별 조건 표시 + 삭제 버튼
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { AlertCondition } from '../../types/alert';

interface Props {
  condition: AlertCondition;
  onRemove?: () => void;
}

function describeCondition(c: AlertCondition): string {
  switch (c.type) {
    case '체결강도':    return `체결강도 ≥ ${c.value}`;
    case '외국인순매수':
      if (c.op === 'turn_positive') return '외국인 금일 전환 매수';
      return `외국인 ${c.days}일 연속 순매수`;
    case '기관순매수':
      if (c.op === 'consecutive') return `기관 ${c.days}일 연속 순매수`;
      return '기관 순매수';
    case 'PBR':
      if (c.op === 'lte_absolute') return `PBR ≤ ${c.value}×`;
      return `PBR ≤ 섹터평균 × ${c.ratio}`;
    case 'PER':         return `PER ≤ 섹터평균 × ${c.ratio}`;
    case 'P/FCR':
      if (c.op === 'lte_absolute') return `P/FCR ≤ ${c.value}×`;
      return `P/FCR ≤ 섹터평균 × ${c.ratio}`;
    case '거래량':
      if (c.op === 'gte_avg20_ratio') return `거래량 ≥ 20일평균 × ${c.ratio}`;
      return `거래량 ≥ 전일 × ${c.ratio}`;
    case '업종지수':
      if (c.op === 'outperform_kospi') return '업종 KOSPI 대비 아웃퍼폼';
      if (c.op === 'lte_5day_drop') return `업종 5일 낙폭 ≤ ${c.value}%`;
      return `업종지수 ≥ ${c.value}%`;
    default:            return c.type;
  }
}

export function ConditionCard({ condition, onRemove }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.text}>{describeCondition(condition)}</Text>
      {onRemove ? (
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
          <Text style={styles.removeText}>×</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { color: colors.text, fontSize: 13, flex: 1 },
  removeBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colors.down, fontSize: 18, lineHeight: 20 },
});
