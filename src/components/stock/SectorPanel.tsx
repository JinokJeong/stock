import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  sectorName: string;
  sectorChangeRate: number;
  kospiChange: number;
  market: 'KOSPI' | 'KOSDAQ';
}

function IndexBar({ label, changeRate }: { label: string; changeRate: number }) {
  const isUp = changeRate >= 0;
  const barColor = isUp ? colors.up : colors.down;
  const ratio = Math.min(Math.abs(changeRate) / 5, 1); // 5% = 100%
  return (
    <View style={s.indexRow}>
      <Text style={s.indexLabel}>{label}</Text>
      <View style={s.indexTrack}>
        {isUp ? (
          <>
            <View style={{ flex: 1 }} />
            <View style={[s.indexFill, { flex: ratio, backgroundColor: barColor + 'aa' }]} />
          </>
        ) : (
          <>
            <View style={[s.indexFill, { flex: ratio, backgroundColor: barColor + 'aa' }]} />
            <View style={{ flex: 1 }} />
          </>
        )}
      </View>
      <Text style={[s.indexVal, { color: barColor }]}>
        {isUp ? '+' : ''}{changeRate.toFixed(2)}%
      </Text>
    </View>
  );
}

export function SectorPanel({ sectorName, sectorChangeRate, kospiChange, market }: Props) {
  return (
    <View style={s.container}>
      <View style={s.badges}>
        <View style={s.badge}>
          <Text style={s.badgeText}>{market}</Text>
        </View>
        {sectorName ? (
          <View style={[s.badge, { borderColor: colors.accent + '66' }]}>
            <Text style={[s.badgeText, { color: colors.accent }]}>{sectorName}</Text>
          </View>
        ) : null}
      </View>
      <View style={s.indexList}>
        <IndexBar label={market === 'KOSPI' ? 'KOSPI' : 'KOSDAQ'} changeRate={kospiChange} />
        {sectorName ? <IndexBar label={sectorName} changeRate={sectorChangeRate} /> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 10 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: {
    borderWidth: 1, borderColor: colors.border2,
    borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3,
    flexShrink: 0, alignSelf: 'flex-start',
  },
  badgeText: { color: colors.text2, fontSize: 11, includeFontPadding: false },
  indexList: { gap: 8 },
  indexRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  indexLabel: { color: colors.text2, fontSize: 11, minWidth: 80, flexShrink: 0 },
  indexTrack: {
    flex: 1, height: 8,
    backgroundColor: colors.border,
    borderRadius: 4, overflow: 'hidden',
    flexDirection: 'row',
  },
  indexFill: { height: '100%', borderRadius: 4 },
  indexVal: { fontSize: 12, fontWeight: '600', width: 56, textAlign: 'right' },
});
