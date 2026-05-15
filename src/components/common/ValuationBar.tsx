// 밸류에이션 비교 바 — PER/PBR/P/FCR 를 섹터 평균 대비 시각화
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  label: string;
  value?: number;
  sectorAvg: number;
  unit?: string;
  decimals?: number;
  invertColor?: boolean;  // true = 높을수록 좋음 (ROE 등)
  description?: string;
}

export function ValuationBar({ label, value, sectorAvg, unit = '×', decimals = 2, invertColor = false, description }: Props) {
  if (value === undefined || value === null) {
    return (
      <View style={styles.wrap}>
        <View style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <View style={[styles.track, { opacity: 0.3 }]}>
            <View style={styles.midMark} />
          </View>
          <Text style={[styles.val, { color: colors.text3 }]}>—</Text>
          <Text style={styles.sector}>/{sectorAvg.toFixed(decimals)}{unit}</Text>
        </View>
        {description ? <Text style={styles.desc}>{description}</Text> : null}
      </View>
    );
  }

  const ratio = sectorAvg > 0 ? value / sectorAvg : 1;
  const barWidth = Math.min(ratio, 2) * 50;
  const isCheap = invertColor ? ratio > 1.1 : ratio < 0.9;
  const isExpensive = invertColor ? ratio < 0.9 : ratio > 1.1;
  const barColor = isCheap ? colors.up : isExpensive ? colors.down : colors.amber;

  return (
    <View style={styles.wrap}>
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
      {description ? <Text style={styles.desc}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: 3,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
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
  desc: {
    fontSize: 10,
    color: colors.text3,
    marginLeft: 50,
  },
});
