// 캔들차트 — Victory Native 기반, Mock 데이터로 데모 동작
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../../theme/colors';

const { width: SCREEN_W } = Dimensions.get('window');

interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Props {
  candles?: Candle[];
  height?: number;
}

function generateMockCandles(count = 20): Candle[] {
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
    return { date: d.toISOString().slice(5, 10), open, high, low, close };
  });
}

export function CandleChart({ candles, height = 180 }: Props) {
  const data = useMemo(() => candles ?? generateMockCandles(), [candles]);

  const prices = data.flatMap((c) => [c.high, c.low]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const chartW = SCREEN_W - 48;
  const candleW = Math.max(chartW / data.length - 2, 4);

  const toY = (price: number) =>
    ((maxP - price) / range) * (height - 24) + 8;

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.chart}>
        {data.map((c, i) => {
          const isBull = c.close >= c.open;
          const barColor = isBull ? colors.up : colors.down;
          const bodyTop = toY(Math.max(c.open, c.close));
          const bodyH = Math.max(Math.abs(toY(c.open) - toY(c.close)), 2);
          const x = i * (candleW + 2);
          return (
            <View key={i} style={[styles.candleWrapper, { left: x, width: candleW }]}>
              {/* 심지 */}
              <View
                style={[
                  styles.wick,
                  {
                    backgroundColor: barColor,
                    top: toY(c.high),
                    height: Math.max(toY(c.low) - toY(c.high), 1),
                    left: candleW / 2 - 0.5,
                  },
                ]}
              />
              {/* 몸통 */}
              <View
                style={[
                  styles.body,
                  { backgroundColor: barColor, top: bodyTop, height: bodyH, width: candleW },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        <Text style={styles.priceLabel}>{minP.toLocaleString()}</Text>
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
    flex: 1,
    position: 'relative',
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
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  priceLabel: {
    color: colors.text3,
    fontSize: 9,
  },
});
