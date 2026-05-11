// 종목 추천 스크리너 화면 — 프리셋 선택 + 스캔 실행 + 결과 목록
import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useScreener } from '../hooks/useScreener';
import { useStockStore } from '../store/stockStore';
import { PresetFilter } from '../components/recommend/PresetFilter';
import { ScanProgress } from '../components/recommend/ScanProgress';
import { StockScoreCard } from '../components/recommend/StockScoreCard';
import { RecommendStock } from '../types/screener';

type SortKey = 'score' | 'supply' | 'value' | 'momentum';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'score', label: '스코어순' },
  { key: 'supply', label: '수급' },
  { key: 'value', label: '밸류' },
  { key: 'momentum', label: '모멘텀' },
];

export function RecommendScreen() {
  const navigation = useNavigation<any>();
  const setSelected = useStockStore((s) => s.setSelected);
  const {
    results,
    scanning,
    progress,
    done,
    total,
    lastScanAt,
    selectedPreset,
    sortBy,
    filterMarket,
    startScan,
    setPreset,
    setSortBy,
    setFilterMarket,
  } = useScreener();

  function onPressStock(stock: RecommendStock) {
    setSelected(stock.code);
    navigation.navigate('StockDetail', { code: stock.code });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={results}
        keyExtractor={(s) => s.code}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.title}>추천 종목</Text>
            </View>

            {/* 프리셋 선택 */}
            <PresetFilter selected={selectedPreset} onSelect={setPreset} />

            {/* 스캔 상태 */}
            <ScanProgress
              scanning={scanning}
              done={done}
              total={total}
              progress={progress}
              lastScanAt={lastScanAt}
            />

            {/* 스캔 버튼 */}
            <TouchableOpacity
              style={[styles.scanBtn, scanning && styles.scanBtnDisabled]}
              onPress={() => startScan()}
              disabled={scanning}
              activeOpacity={0.8}
            >
              <Text style={styles.scanBtnText}>
                {scanning ? '스캔 중...' : '스캔 시작'}
              </Text>
            </TouchableOpacity>

            {/* 결과 헤더 */}
            {results.length > 0 && (
              <View style={styles.resultHeader}>
                <Text style={styles.resultCount}>결과: {results.length}종목 충족</Text>
                <View style={styles.sortRow}>
                  {SORT_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.sortBtn, sortBy === opt.key && styles.sortBtnActive]}
                      onPress={() => setSortBy(opt.key)}
                    >
                      <Text style={[styles.sortText, sortBy === opt.key && styles.sortTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.filterRow}>
                  {(['ALL', 'KOSPI', 'KOSDAQ'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.filterBtn, filterMarket === m && styles.filterBtnActive]}
                      onPress={() => setFilterMarket(m)}
                    >
                      <Text style={[styles.filterText, filterMarket === m && styles.filterTextActive]}>
                        {m === 'ALL' ? '전체' : m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <StockScoreCard
            stock={item}
            rank={index + 1}
            onPress={() => onPressStock(item)}
          />
        )}
        ListEmptyComponent={
          !scanning ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>스캔을 시작하면 추천 종목이 표시됩니다</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  scanBtn: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  scanBtnDisabled: { backgroundColor: colors.border2 },
  scanBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  resultHeader: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  resultCount: { color: colors.text, fontSize: 14, fontWeight: '600' },
  sortRow: { flexDirection: 'row', gap: 6 },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortBtnActive: { borderColor: colors.accent, backgroundColor: colors.accent + '22' },
  sortText: { color: colors.text2, fontSize: 11 },
  sortTextActive: { color: colors.accent, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: { borderColor: colors.buy, backgroundColor: colors.buy + '22' },
  filterText: { color: colors.text2, fontSize: 11 },
  filterTextActive: { color: colors.buy, fontWeight: '600' },
  list: { paddingBottom: 32 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.text3, fontSize: 14, textAlign: 'center' },
});
