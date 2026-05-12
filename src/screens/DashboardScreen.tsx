// 종목 대시보드 화면 — 관심 종목 리스트 + 실시간 KPI
import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useStockStore } from '../store/stockStore';
import { kisApi, isKoreanMarketOpen, isPreMarket } from '../services/kisApi';
import { getStockName } from '../constants/stockUniverse';

function StockRow({ code }: { code: string }) {
  const navigation = useNavigation<any>();
  const stock = useStockStore((s) => s.stocks[code]);
  const setSelected = useStockStore((s) => s.setSelected);

  if (!stock) {
    return (
      <View style={styles.row}>
        <Text style={styles.name}>{getStockName(code)} ({code})</Text>
        <Text style={styles.placeholder}>로딩 중...</Text>
      </View>
    );
  }

  if ((stock as any).error) {
    return (
      <View style={styles.row}>
        <Text style={styles.name}>{getStockName(code)} ({code})</Text>
        <Text style={styles.errorText}>{(stock as any).error}</Text>
      </View>
    );
  }

  const changeColor   = stock.changeRate >= 0 ? colors.up : colors.down;
  const marketOpen    = isKoreanMarketOpen();
  const preMarket     = isPreMarket();
  const hasAfterHours = !marketOpen && !preMarket && !!stock.afterHoursPrice;
  const hasPreMarket  = preMarket && !!stock.preMarketPrice;
  const ahColor       = (stock.afterHoursChangeRate ?? 0) >= 0 ? colors.up : colors.down;
  const pmColor       = (stock.preMarketChangeRate  ?? 0) >= 0 ? colors.up : colors.down;

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.75}
      onPress={() => {
        setSelected(code);
        navigation.navigate('StockDetail', { code });
      }}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.name}>{stock.name} ({code})</Text>
        <Text style={styles.code}>{stock.market}</Text>
      </View>
      <View style={styles.rowCenter}>
        <View style={styles.changeBarRow}>
          <View style={styles.halfTrack}>
            {stock.changeRate < 0 && (
              <View style={[styles.halfFill, {
                width: `${Math.min(Math.abs(stock.changeRate) / 10 * 100, 100)}%`,
                backgroundColor: colors.down,
                alignSelf: 'flex-end',
              }]} />
            )}
          </View>
          <View style={styles.centerTick} />
          <View style={styles.halfTrack}>
            {stock.changeRate >= 0 && (
              <View style={[styles.halfFill, {
                width: `${Math.min(Math.abs(stock.changeRate) / 10 * 100, 100)}%`,
                backgroundColor: colors.up,
                alignSelf: 'flex-start',
              }]} />
            )}
          </View>
        </View>
      </View>
      <View style={styles.rowRight}>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{stock.price?.toLocaleString()}</Text>
          {!marketOpen && <Text style={styles.closeBadge}>종가</Text>}
        </View>
        <Text style={[styles.change, { color: changeColor }]}>
          {stock.changeRate >= 0 ? '+' : ''}{stock.changeRate?.toFixed(2)}%
        </Text>
        {hasAfterHours && (
          <Text style={[styles.afterHours, { color: ahColor }]}>
            시간외 {stock.afterHoursPrice?.toLocaleString()}
            {'  '}{(stock.afterHoursChangeRate ?? 0) >= 0 ? '+' : ''}{stock.afterHoursChangeRate?.toFixed(2)}%
          </Text>
        )}
        {hasPreMarket && (
          <Text style={[styles.afterHours, { color: pmColor }]}>
            장전 {stock.preMarketPrice?.toLocaleString()}
            {'  '}{(stock.preMarketChangeRate ?? 0) >= 0 ? '+' : ''}{stock.preMarketChangeRate?.toFixed(2)}%
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function DashboardScreen() {
  const { watchlist, updateStock } = useStockStore();
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadAll = async () => {
    setError(null);
    await Promise.all(
      watchlist.map(async (code) => {
        try {
          const data = await kisApi.getScreenerData(code);
          updateStock(code, data);
        } catch (e: any) {
          updateStock(code, { error: e?.message ?? '불러오기 실패' } as any);
        }
      })
    );
  };

  useEffect(() => { loadAll(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>대시보드</Text>
        <Text style={styles.subtitle}>{watchlist.length}개 관심 종목</Text>
      </View>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}
      <FlatList
        data={watchlist}
        keyExtractor={(c) => c}
        renderItem={({ item }) => <StockRow code={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.text3, fontSize: 13 },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: colors.down + '22',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.down,
  },
  errorBannerText: { color: colors.down, fontSize: 13 },
  list: { paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.bg,
    gap: 10,
  },
  rowLeft: { flex: 1.2 },
  rowCenter: { flex: 1.5 },
  rowRight: { alignItems: 'flex-end' },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  code: { color: colors.text3, fontSize: 10, marginTop: 2 },
  price: { color: colors.text, fontSize: 14, fontWeight: '600' },
  change: { fontSize: 12, marginTop: 2 },
  sep: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  placeholder: { color: colors.text3, fontSize: 12 },
  errorText: { color: colors.down, fontSize: 11, flex: 1, marginLeft: 8 },
  changeBarRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  halfTrack: {
    flex: 1, height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  halfFill: { height: '100%', borderRadius: 3 },
  centerTick: { width: 1, height: 10, backgroundColor: colors.border2, marginHorizontal: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  closeBadge: {
    fontSize: 9, color: colors.text3,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1,
  },
  afterHours: { fontSize: 10, marginTop: 2 },
});
