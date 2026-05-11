// 투자자별 매매 비중 바 — 외국인/기관/개인 순매수 시각화
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  foreignNet: number;
  institutionNet: number;
  retailNet: number;
}

function formatAmount(val: number): string {
  if (val === 0) return '0억';
  const abs = Math.abs(val);
  if (abs >= 100_000_000) {
    const b = val / 100_000_000;
    return `${Math.abs(b) >= 10 ? b.toFixed(0) : b.toFixed(1)}억`;
  }
  // 1억 미만은 만원 단위
  const m = Math.round(val / 10_000);
  if (m === 0) return '0만';
  return `${m.toLocaleString()}만`;
}

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const ratio = total > 0 ? Math.abs(value) / total : 0;
  const barColor = value > 0 ? colors.buy : value < 0 ? colors.down : colors.text3;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(ratio * 100, 100)}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.val, { color: barColor }]}>
        {value > 0 ? '+' : ''}{formatAmount(value)}
      </Text>
    </View>
  );
}

export function InvestorBar({ foreignNet, institutionNet, retailNet }: Props) {
  const total = Math.max(
    Math.abs(foreignNet),
    Math.abs(institutionNet),
    Math.abs(retailNet),
    1
  );

  return (
    <View style={styles.container}>
      <Bar label="외국인" value={foreignNet} total={total} />
      <Bar label="기관" value={institutionNet} total={total} />
      <Bar label="개인" value={retailNet} total={total} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: colors.text2, fontSize: 11, width: 36 },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  val: { fontSize: 12, fontWeight: '600', width: 52, textAlign: 'right' },
});
