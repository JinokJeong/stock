// 섹터 등락률 바 — 업종별 수익률 수평 바 차트
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface SectorItem {
  name: string;
  changeRate: number;
}

interface Props {
  sectors: SectorItem[];
}

export function SectorBar({ sectors }: Props) {
  const maxAbs = Math.max(...sectors.map((s) => Math.abs(s.changeRate)), 0.01);

  return (
    <View style={styles.container}>
      {sectors.map((s, i) => {
        const isPos = s.changeRate >= 0;
        const barW = (Math.abs(s.changeRate) / maxAbs) * 50;
        const barColor = isPos ? colors.up : colors.down;
        return (
          <View key={i} style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
            <View style={styles.track}>
              <View style={styles.center}>
                {isPos ? (
                  <View style={[styles.bar, { width: `${barW}%`, backgroundColor: barColor }]} />
                ) : (
                  <View style={{ flex: 1 }} />
                )}
              </View>
              <View style={styles.center}>
                {!isPos ? (
                  <View style={[styles.barLeft, { width: `${barW}%`, backgroundColor: barColor }]} />
                ) : (
                  <View style={{ flex: 1 }} />
                )}
              </View>
            </View>
            <Text style={[styles.rate, { color: barColor }]}>
              {isPos ? '+' : ''}{s.changeRate.toFixed(2)}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: colors.text2, fontSize: 11, width: 64 },
  track: {
    flex: 1,
    height: 8,
    flexDirection: 'row',
  },
  center: { flex: 1, justifyContent: 'flex-end' },
  bar: {
    height: 8,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  barLeft: {
    height: 8,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-end',
  },
  rate: { fontSize: 11, fontWeight: '600', width: 52, textAlign: 'right' },
});
