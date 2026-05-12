// 종목 상세 화면 — 캔들차트 + 밸류에이션 + 투자자 + AI 코멘트
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useStockStore } from '../store/stockStore';
import { kisApi, isKoreanMarketOpen, isPreMarket } from '../services/kisApi';
import { generateStockComment } from '../services/llmService';
import { useLlmStore } from '../store/llmStore';
import { TradingChart } from '../components/chart/TradingChart';
import { ValuationBar } from '../components/common/ValuationBar';
import { InvestorBar } from '../components/common/InvestorBar';
import { GaugeBar } from '../components/common/GaugeBar';
import { KpiCard } from '../components/common/KpiCard';
import { AiInsightBox } from '../components/llm/AiInsightBox';

type RouteParams = { StockDetail: { code: string } };

export function StockDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'StockDetail'>>();
  const navigation = useNavigation();
  const { code } = route.params;
  const stock = useStockStore((s) => s.stocks[code]);
  const updateStock = useStockStore((s) => s.updateStock);
  const llmStatus = useLlmStore((s) => s.status);
  const [comment, setComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    kisApi.getScreenerData(code)
      .then((data) => updateStock(code, data))
      .catch((e: any) => setLoadError(e?.message ?? '데이터 로드 실패'));
  }, [code]);

  useEffect(() => {
    if (llmStatus === 'ready' && stock) {
      setCommentLoading(true);
      generateStockComment({
        tradeStrength: stock.tradeStrength,
        foreignDays: stock.foreignConsecutiveDays,
        pbr: stock.pbr ?? 1,
        pfcr: stock.pfcr ?? 10,
        themeName: stock.sectorName ?? '',
      }).then((c) => {
        setComment(c);
        setCommentLoading(false);
      });
    }
  }, [llmStatus, stock?.code]);

  if (!stock) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          {loadError
            ? <Text style={[styles.loadingText, { color: colors.down, textAlign: 'center', paddingHorizontal: 24 }]}>{loadError}</Text>
            : <Text style={styles.loadingText}>로딩 중...</Text>
          }
        </View>
      </SafeAreaView>
    );
  }

  const changeColor   = stock.changeRate >= 0 ? colors.up : colors.down;
  const marketOpen    = isKoreanMarketOpen();
  const preMarket     = isPreMarket();
  const hasAfterHours = !marketOpen && !preMarket && !!stock.afterHoursPrice;
  const hasPreMarket  = preMarket && !!stock.preMarketPrice;
  const ahColor = (stock.afterHoursChangeRate ?? 0) >= 0 ? colors.up : colors.down;
  const pmColor = (stock.preMarketChangeRate  ?? 0) >= 0 ? colors.up : colors.down;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{stock.name} ({code})</Text>
          <Text style={styles.meta}>{stock.market}</Text>
        </View>
        <View style={styles.priceBlock}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{stock.price?.toLocaleString()}</Text>
            {!marketOpen && <Text style={styles.closeBadge}>종가</Text>}
          </View>
          <Text style={[styles.change, { color: changeColor }]}>
            {stock.changeRate >= 0 ? '+' : ''}{stock.changeRate?.toFixed(2)}%
          </Text>
          {hasAfterHours && (
            <View style={styles.ahRow}>
              <Text style={styles.ahLabel}>시간외</Text>
              <Text style={[styles.ahPrice, { color: ahColor }]}>
                {stock.afterHoursPrice?.toLocaleString()}
              </Text>
              <Text style={[styles.ahChange, { color: ahColor }]}>
                {(stock.afterHoursChangeRate ?? 0) >= 0 ? '+' : ''}
                {stock.afterHoursChangeRate?.toFixed(2)}%
              </Text>
            </View>
          )}
          {hasPreMarket && (
            <View style={styles.ahRow}>
              <Text style={styles.ahLabel}>장전</Text>
              <Text style={[styles.ahPrice, { color: pmColor }]}>
                {stock.preMarketPrice?.toLocaleString()}
              </Text>
              <Text style={[styles.ahChange, { color: pmColor }]}>
                {(stock.preMarketChangeRate ?? 0) >= 0 ? '+' : ''}
                {stock.preMarketChangeRate?.toFixed(2)}%
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 캔들차트 */}
        <TradingChart code={code} height={440} />

        {/* KPI 행 — 시세 */}
        <View style={styles.kpiRow}>
          <KpiCard
            label="체결강도"
            value={stock.tradeStrength > 0 ? stock.tradeStrength.toFixed(0) : '-'}
            valueColor={stock.tradeStrength >= 130 ? colors.up : colors.text}
          />
          <KpiCard
            label="거래량"
            value={(stock.volume / 10000).toFixed(0) + '만'}
          />
          <KpiCard
            label="외국인"
            value={stock.foreignConsecutiveDays >= 0 ? `+${stock.foreignConsecutiveDays}일` : `${stock.foreignConsecutiveDays}일`}
            valueColor={stock.foreignConsecutiveDays > 0 ? colors.buy : colors.down}
          />
        </View>

        {/* KPI 행 — 밸류에이션 */}
        <View style={styles.kpiRow}>
          <KpiCard
            label="PER"
            value={stock.per != null ? `${stock.per.toFixed(1)}배` : '-'}
            valueColor={stock.per != null && stock.perSector != null
              ? stock.per < stock.perSector ? colors.up : colors.text
              : colors.text}
          />
          <KpiCard
            label="PBR"
            value={stock.pbr != null ? `${stock.pbr.toFixed(2)}배` : '-'}
            valueColor={stock.pbr != null && stock.pbrSector != null
              ? stock.pbr < stock.pbrSector ? colors.up : colors.text
              : colors.text}
          />
          <KpiCard
            label="PCR"
            value={stock.pcr != null ? `${stock.pcr.toFixed(1)}배` : '-'}
          />
        </View>

        {/* 체결강도 게이지 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>체결강도</Text>
          {stock.tradeStrength > 0
            ? <GaugeBar value={stock.tradeStrength} max={200} />
            : <Text style={styles.noData}>장중에만 집계됩니다</Text>
          }
        </View>

        {/* 밸류에이션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>밸류에이션</Text>
          {stock.per !== undefined && (
            <ValuationBar
              label="PER"
              value={stock.per}
              sectorAvg={stock.perSector ?? 12}
              unit="×"
              decimals={1}
            />
          )}
          {stock.pbr !== undefined && (
            <ValuationBar
              label="PBR"
              value={stock.pbr}
              sectorAvg={stock.pbrSector ?? 1.2}
              unit="×"
              decimals={2}
            />
          )}
          {stock.pfcr !== undefined && (
            <ValuationBar
              label="P/FCR"
              value={stock.pfcr}
              sectorAvg={stock.pfcrSector ?? 12}
              unit="×"
              decimals={1}
            />
          )}
        </View>

        {/* 투자자별 매매 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>투자자별 가집계</Text>
          <InvestorBar
            foreignNet={stock.foreignNetAmount ?? 0}
            institutionNet={stock.institutionNetAmount ?? 0}
            retailNet={stock.retailNetAmount ?? 0}
            updatedAt={stock.investorUpdatedAt}
          />
        </View>

        {/* AI 코멘트 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI 분석</Text>
          <AiInsightBox
            comment={comment}
            loading={commentLoading}
            modelReady={llmStatus === 'ready'}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.text2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  back: { paddingRight: 4 },
  backText: { color: colors.accent, fontSize: 14 },
  headerInfo: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.text3, fontSize: 10, marginTop: 2 },
  priceBlock: { alignItems: 'flex-end' },
  priceRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  price: { color: colors.text, fontSize: 16, fontWeight: '700' },
  closeBadge: {
    fontSize: 10, color: colors.text3,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1,
  },
  change: { fontSize: 12, marginTop: 2 },
  ahRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  ahLabel:  { fontSize: 10, color: colors.text3 },
  ahPrice:  { fontSize: 12, fontWeight: '600' },
  ahChange: { fontSize: 11 },
  scroll: { padding: 16, paddingBottom: 48, gap: 16 },
  kpiRow: { flexDirection: 'row', gap: 0 },
  section: { gap: 10 },
  sectionTitle: { color: colors.text2, fontSize: 13, fontWeight: '600' },
  noData: { color: colors.text3, fontSize: 12, paddingVertical: 4 },
});
