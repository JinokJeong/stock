// 밸류에이션 비교 바 — PER/PBR/P/FCR 를 섹터 평균 대비 시각화
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  label: string;
  value: number;
  sectorAvg: number;
  unit?: string;
  decimals?: number;
}

export function ValuationBar({ label, value, sectorAvg, unit = '×', decimals = 2 }: Props) {
  const ratio = sectorAvg > 0 ? value / sectorAvg : 1;
  const barWidth = Math.min(ratio, 2) * 50; // 섹터 평균이 50% 지점
  const isCheap = ratio < 0.9;
  const barColor = isCheap ? colors.up : ratio > 1.1 ? colors.down : colors.amber;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <View style={styles.midMark} />
        <View style={[styles.fill, { width: `${Math.min(barWidth, 100)}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.val, { color: barColor }]}>
        {value.toFixed(decimals)}{unit}
      </Text>
      <Text style={styles.sector}>
        /{sectorAvg.toFixed(decimals)}{unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
    gap: 6,
  },
  label: {
    color: colors.text2,
    fontSize: 11,
    width: 44,
  },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  midMark: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.border2,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  val: {
    fontSize: 12,
    fontWeight: '600',
    width: 48,
    textAlign: 'right',
  },
  sector: {
    fontSize: 10,
    color: colors.text3,
    width: 44,
  },
});
