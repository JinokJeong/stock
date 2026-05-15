import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { kisApi, OrderBook } from '../../services/kisApi';

interface Props {
  code: string;
  currentPrice?: number;
}

function formatQty(v: number) {
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만`;
  return v.toLocaleString();
}

function AskRow({ price, qty, maxQty, currentPrice }: { price: number; qty: number; maxQty: number; currentPrice?: number }) {
  const ratio = maxQty > 0 ? qty / maxQty : 0;
  const isClosest = currentPrice !== undefined && Math.abs(price - currentPrice) < 500;
  return (
    <View style={s.row}>
      <Text style={[s.qty, { color: colors.down }]}>{formatQty(qty)}</Text>
      <View style={s.barTrack}>
        <View style={{ flex: 1 - ratio }} />
        <View style={[s.bar, { flex: ratio, backgroundColor: colors.down + '44' }]} />
      </View>
      <Text style={[s.price, { color: colors.down, fontWeight: isClosest ? '700' : '400' }]}>
        {price.toLocaleString()}
      </Text>
    </View>
  );
}

function BidRow({ price, qty, maxQty, currentPrice }: { price: number; qty: number; maxQty: number; currentPrice?: number }) {
  const ratio = maxQty > 0 ? qty / maxQty : 0;
  const isClosest = currentPrice !== undefined && Math.abs(price - currentPrice) < 500;
  return (
    <View style={s.row}>
      <Text style={[s.qty, { color: colors.up }]}>{formatQty(qty)}</Text>
      <View style={s.barTrack}>
        <View style={[s.bar, { flex: ratio, backgroundColor: colors.up + '44' }]} />
        <View style={{ flex: 1 - ratio }} />
      </View>
      <Text style={[s.price, { color: colors.up, fontWeight: isClosest ? '700' : '400' }]}>
        {price.toLocaleString()}
      </Text>
    </View>
  );
}

export function OrderBookCard({ code, currentPrice }: Props) {
  const [ob, setOb] = useState<OrderBook | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    kisApi.getOrderBook(code)
      .then((data) => { setOb(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [code]);

  const maxQty = ob
    ? Math.max(...ob.asks.map((a) => a.qty), ...ob.bids.map((b) => b.qty), 1)
    : 1;

  const hasData = ob && (ob.asks.length > 0 || ob.bids.length > 0);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.colLabel}>잔량</Text>
        <View style={{ flex: 1 }} />
        <Text style={s.colLabel}>호가</Text>
      </View>
      {loading ? (
        <Text style={s.empty}>호가 로딩 중...</Text>
      ) : !hasData ? (
        <Text style={s.empty}>호가 데이터 없음 (장중에만 제공)</Text>
      ) : (
        <>
          {ob!.asks.map((a, i) => (
            <AskRow key={`ask-${i}`} price={a.price} qty={a.qty} maxQty={maxQty} currentPrice={currentPrice} />
          ))}
          {currentPrice !== undefined && (
            <View style={s.currentRow}>
              <Text style={s.currentPrice}>{currentPrice.toLocaleString()}</Text>
              <Text style={s.currentLabel}>현재가</Text>
            </View>
          )}
          {ob!.bids.map((b, i) => (
            <BidRow key={`bid-${i}`} price={b.price} qty={b.qty} maxQty={maxQty} currentPrice={currentPrice} />
          ))}
          <View style={s.totalRow}>
            <Text style={[s.totalText, { color: colors.down }]}>
              매도 {formatQty(ob!.totalAskQty)}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={[s.totalText, { color: colors.up }]}>
              매수 {formatQty(ob!.totalBidQty)}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 2 },
  header: { flexDirection: 'row', marginBottom: 4, paddingHorizontal: 2 },
  colLabel: { color: colors.text3, fontSize: 10, width: 44, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', height: 26, gap: 6 },
  qty: { width: 44, fontSize: 11, textAlign: 'right' },
  barTrack: { flex: 1, flexDirection: 'row', height: 14, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.border },
  bar: { height: '100%' },
  price: { width: 70, fontSize: 12, textAlign: 'right' },
  currentRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 5, marginVertical: 2,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border2,
  },
  currentPrice: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'center' },
  currentLabel: { color: colors.text3, fontSize: 10, marginLeft: 6 },
  totalRow: {
    flexDirection: 'row', marginTop: 8,
    paddingTop: 6, borderTopWidth: 1, borderColor: colors.border,
  },
  totalText: { fontSize: 11, fontWeight: '600' },
  empty: { color: colors.text3, fontSize: 12, textAlign: 'center', paddingVertical: 16 },
});
