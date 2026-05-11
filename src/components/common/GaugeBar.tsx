// 게이지 바 — 0~200 범위의 체결강도 등 단일 수치 시각화
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
}

export function GaugeBar({ value, max = 200, label, showValue = true }: Props) {
  const ratio = Math.min(Math.max(value / max, 0), 1);
  const barColor = value >= 140 ? colors.up : value >= 100 ? colors.amber : colors.down;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: barColor }]} />
        <View style={styles.midLine} />
      </View>
      {showValue && <Text style={[styles.value, { color: barColor }]}>{value.toFixed(0)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: colors.text2,
    fontSize: 11,
    width: 48,
  },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  midLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.border2,
  },
  value: {
    fontSize: 12,
    fontWeight: '600',
    width: 36,
    textAlign: 'right',
  },
});
