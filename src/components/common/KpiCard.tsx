// KPI 카드 — 지표 1개를 라벨/값/서브라벨로 표시
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  label: string;
  value: string | number;
  subLabel?: string;
  valueColor?: string;
  compact?: boolean;
}

export function KpiCard({ label, value, subLabel, valueColor, compact }: Props) {
  return (
    <View style={[styles.card, compact && styles.compact]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
      {subLabel ? <Text style={styles.sub}>{subLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg2,
    borderRadius: 10,
    padding: 12,
    flex: 1,
    margin: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compact: {
    padding: 8,
  },
  label: {
    color: colors.text2,
    fontSize: 11,
    marginBottom: 4,
  },
  value: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sub: {
    color: colors.text3,
    fontSize: 10,
    marginTop: 2,
  },
});
