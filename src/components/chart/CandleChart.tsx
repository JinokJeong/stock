// 캔들차트 — KIS 일별 시세 기반, 현재가 라인 표시
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../../theme/colors';
import { CandleData } from '../../services/kisApi';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  candles?: CandleData[];
  currentPrice?: number;
  height?: number;
}

function generateMockCandles(count = 20): CandleData[] {
  let price = 50000;
  return Array.from({ length: count }, (_, i) => {
    const change = (Math.random() - 0.48) * price * 0.04;
    const open = price;
    const close = Math.round(price + change);
    const high = Math.round(Math.max(open, close) * (1 + Math.random() * 0.015));
    const low = Math.round(Math.min(open, close) * (1 - Math.random() * 0.015));
    price = close;
    const d = new Date();
    d.setDate(d.getDate() - (count - i));
    return {
      date: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      open, high, low, close,
    };
  });
}

export function CandleChart({ candles: propCandles, currentPrice, height = 180 }: Props) {
  const isMock = !propCandles || propCandles.length === 0;
  const data = useMemo(
    () => (isMock ? generateMockCandles() : propCandles!),
    [propCandles],
  );

  const prices = data.flatMap((c) => [c.high, c.low]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const chartW = SCREEN_W - 48;
  const candleW = Math.max(chartW / data.length - 2, 4);

  const toY = (price: number) =>
    ((maxP - price) / range) * (height - 32) + 8;

  const showCurrentLine =
    !isMock &&
    currentPrice !== undefined &&
    currentPrice >= minP &&
    currentPrice <= maxP;

  return (
    <View style={[styles.container, { height }]}>
      <View style={[styles.chart, { height: height - 24 }]}>
        {data.map((c, i) => {
          const isBull = c.close >= c.open;
          const barColor = isBull ? colors.up : colors.down;
          const bodyTop = toY(Math.max(c.open, c.close));
          const bodyH = Math.max(Math.abs(toY(c.open) - toY(c.close)), 2);
          const x = i * (candleW + 2);
          return (
            <View key={i} style={[styles.candleWrapper, { left: x, width: candleW }]}>
              <View
                style={[styles.wick, {
                  backgroundColor: barColor,
                  top: toY(c.high),
                  height: Math.max(toY(c.low) - toY(c.high), 1),
                  left: candleW / 2 - 0.5,
                }]}
              />
              <View
                style={[styles.body, { backgroundColor: barColor, top: bodyTop, height: bodyH, width: candleW }]}
              />
            </View>
          );
        })}

        {/* 현재가 수평선 */}
        {showCurrentLine && (
          <>
            <View style={[styles.currentLine, { top: toY(currentPrice!) }]} />
            <Text style={[styles.currentLabel, { top: toY(currentPrice!) - 13 }]}>
              {currentPrice!.toLocaleString()}
            </Text>
          </>
        )}
      </View>

      <View style={styles.labels}>
        <Text style={styles.priceLabel}>{minP.toLocaleString()}</Text>
        {isMock && <Text style={styles.mockBadge}>샘플 데이터</Text>}
        <Text style={styles.priceLabel}>{maxP.toLocaleString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg2,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chart: {
    position: 'relative',
    overflow: 'hidden',
  },
  candleWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  wick: {
    position: 'absolute',
    width: 1,
  },
  body: {
    position: 'absolute',
    borderRadius: 1,
  },
  currentLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  currentLabel: {
    position: 'absolute',
    right: 2,
    fontSize: 9,
    color: colors.accent,
    fontWeight: '600',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  priceLabel: {
    color: colors.text3,
    fontSize: 9,
  },
  mockBadge: {
    color: colors.text3,
    fontSize: 8,
    opacity: 0.5,
  },
});
