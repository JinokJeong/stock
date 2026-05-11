// 수급/밸류/모멘텀 점수 분해 바 — 부문별 점수 시각화
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { ScoreBreakdown as ScoreBreakdownType } from '../../types/screener';

interface Props {
  breakdown: ScoreBreakdownType;
}

const ITEMS = [
  { key: 'supply' as const, label: '수급', max: 40, color: colors.buy },
  { key: 'value' as const, label: '밸류', max: 35, color: colors.accent },
  { key: 'momentum' as const, label: '모멘텀', max: 25, color: colors.up },
];

export function ScoreBreakdown({ breakdown }: Props) {
  return (
    <View style={styles.container}>
      {ITEMS.map((item) => {
        const score = breakdown[item.key];
        const ratio = score / item.max;
        return (
          <View key={item.key} style={styles.row}>
            <Text style={styles.label}>{item.label}</Text>
            <View style={styles.track}>
              <View
                style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: item.color }]}
              />
            </View>
            <Text style={[styles.score, { color: item.color }]}>
              {score}/{item.max}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { color: colors.text2, fontSize: 12, width: 44 },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4 },
  score: { fontSize: 12, fontWeight: '600', width: 40, textAlign: 'right' },
});
