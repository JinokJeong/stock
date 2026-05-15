import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useStockStore } from '../store/stockStore';
import { kisApi, enrichWithDart, isKoreanMarketOpen, isPreMarket } from '../services/kisApi';
import { generateStockComment } from '../services/llmService';
import { useLlmStore } from '../store/llmStore';
import { useAlertStore } from '../store/alertStore';
import { useRealTimePrice } from '../hooks/useRealTimePrice';
import { TradingChart } from '../components/chart/TradingChart';
import { ValuationBar } from '../components/common/ValuationBar';
import { InvestorBar } from '../components/common/InvestorBar';
import { GaugeBar } from '../components/common/GaugeBar';
import { AiInsightBox } from '../components/llm/AiInsightBox';
import { OrderBookCard } from '../components/stock/OrderBookCard';
import { SectorPanel } from '../components/stock/SectorPanel';

type RouteParams = { StockDetail: { code: string } };

// ── 인라인 서브컴포넌트 ──────────────────────────────────────────────────────

function Badge({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <View style={[bs.badge, accent && bs.badgeAccent]}>
      <Text style={[bs.badgeText, accent && bs.badgeAccentText]}>{text}</Text>
    </View>
  );
}

function PulsingDot() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[bs.dot, { opacity: anim }]} />;
}

interface MetricCardProps {
  label: string;
  value: string;
  subtitle: string;
  subtitleColor?: string;
  bar?: React.ReactNode;
}
function MetricCard({ label, value, subtitle, subtitleColor, bar }: MetricCardProps) {
  return (
    <View style={ms.card}>
      <Text style={ms.label}>{label}</Text>
      <Text style={ms.value}>{value}</Text>
      <Text style={[ms.subtitle, subtitleColor ? { color: subtitleColor } : null]}>{subtitle}</Text>
      {bar ? <View style={ms.barWrap}>{bar}</View> : null}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={ds.sectionTitle}>{title}</Text>;
}

// ── 본체 ────────────────────────────────────────────────────────────────────

export function StockDetailScreen() {
  const route      = useRoute<RouteProp<RouteParams, 'StockDetail'>>();
  const navigation = useNavigation<any>();
  const { code }   = route.params;

  const stock       = useStockStore((s) => s.stocks[code]);
  const updateStock = useStockStore((s) => s.updateStock);
  const llmStatus   = useLlmStore((s) => s.status);
  const alerts      = useAlertStore((s) => s.alerts);

  const [comment, setComment]             = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [loadError, setLoadError]         = useState<string | null>(null);
  const [updatedTime, setUpdatedTime]     = useState('');
  const priceRef = useRef(0);

  const marketOpen = isKoreanMarketOpen();
  const preMarket  = isPreMarket();

  useRealTimePrice(code);

  useEffect(() => {
    setLoadError(null);
    kisApi.getScreenerData(code)
      .then((data) => {
        updateStock(code, data);
        priceRef.current = data.price ?? 0;
        const now = new Date();
        setUpdatedTime(
          `${String(now.getHours()).padStart(2, '0')}:` +
          `${String(now.getMinutes()).padStart(2, '0')}:` +
          `${String(now.getSeconds()).padStart(2, '0')}`
        );
        // DART OCF 기반 PCR/PFCR 백그라운드 보강
        enrichWithDart(code, data.price ?? 0, data.lstnStcn ?? 0)
          .then((dart) => { if (Object.keys(dart).length > 0) updateStock(code, dart); })
          .catch(() => {});
      })
      .catch((e: any) => setLoadError(e?.message ?? '데이터 로드 실패'));
  }, [code]);

  useEffect(() => { priceRef.current = stock?.price ?? priceRef.current; }, [stock?.price]);

  // 장중 투자자 가집계 30초 주기 갱신
  useEffect(() => {
    if (!marketOpen) return;
    const id = setInterval(() => {
      if (!priceRef.current) return;
      kisApi.refreshInvestorEstimate(code, priceRef.current)
        .then((data) => updateStock(code, data))
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [code, marketOpen]);

  useEffect(() => {
    if (llmStatus === 'ready' && stock) {
      setCommentLoading(true);
      generateStockComment({
        name:             stock.name,
        price:            stock.price ?? 0,
        changeRate:       stock.changeRate ?? 0,
        volTurnover:      stock.volTurnover ?? 0,
        foreignDays:      stock.foreignConsecutiveDays,
        foreignNet:       stock.foreignNetAmount ?? 0,
        institutionNet:   stock.institutionNetAmount ?? 0,
        retailNet:        stock.retailNetAmount ?? 0,
        per:              stock.per,
        pbr:              stock.pbr,
        pcr:              stock.pcr,
        sectorName:       stock.sectorName ?? '',
        sectorChangeRate: stock.sectorChangeRate ?? 0,
        kospiChange:      stock.kospiChange ?? 0,
        volume:           stock.volume ?? 0,
        avgVolume20:      stock.avgVolume20 ?? 0,
        prevVolume:       stock.prevVolume ?? 0,
      }).then((c) => {
        setComment(c);
        setCommentLoading(false);
      });
    }
  }, [llmStatus, stock?.code]);

  if (!stock) {
    return (
      <SafeAreaView style={ds.safe}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={ds.backBtn}>
          <Text style={ds.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <View style={ds.loadingCenter}>
          {loadError
            ? <Text style={[ds.loadingText, { color: colors.down, textAlign: 'center', paddingHorizontal: 24 }]}>{loadError}</Text>
            : <Text style={ds.loadingText}>로딩 중...</Text>
          }
        </View>
      </SafeAreaView>
    );
  }

  const changeColor = stock.changeRate >= 0 ? colors.up : colors.down;
  const hasAfterHours = !marketOpen && !preMarket && !!stock.afterHoursPrice;
  const hasPreMarket  = preMarket && !!stock.preMarketPrice;
  const ahColor = (stock.afterHoursChangeRate ?? 0) >= 0 ? colors.up : colors.down;
  const pmColor = (stock.preMarketChangeRate  ?? 0) >= 0 ? colors.up : colors.down;

  // 거래량 비교
  const volPct    = stock.prevVolume > 0
    ? ((stock.volume / stock.prevVolume - 1) * 100)
    : 0;
  const volRatio  = stock.avgVolume20 > 0
    ? Math.min(stock.volume / stock.avgVolume20, 2)
    : 0;

  // 거래회전율
  const vt = stock.volTurnover ?? 0;
  const vtLabel = vt <= 0 ? '-' : vt >= 3 ? '매우 활발' : vt >= 1 ? '활발' : '보통';
  const vtColor = vt <= 0 ? colors.text3 : vt >= 3 ? colors.up : vt >= 1 ? colors.amber : colors.text2;

  // 외국인 연속 순매수일
  const fDays      = stock.foreignConsecutiveDays ?? 0;
  const fDaysStr   = fDays === 0 ? '-' : (fDays > 0 ? '+' : '') + fDays + '일';
  const fDaysLabel = fDays > 0 ? '연속 순매수' : fDays < 0 ? '연속 순매도' : '데이터 없음';
  const fDaysColor = fDays > 0 ? colors.up : fDays < 0 ? colors.down : colors.text3;

  // 이 종목 관련 알림
  const stockAlerts = alerts.filter((a) => a.enabled);

  return (
    <SafeAreaView style={ds.safe} edges={['top']}>

      {/* ─── 헤더 ───────────────────────────────────────────────────────── */}
      <View style={ds.header}>
        <View style={ds.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={ds.backBtn}>
            <Text style={ds.backText}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={ds.stockName}>{stock.name}</Text>
          <View style={ds.badgeRow}>
            <Badge text={code} />
            <Badge text={stock.market} accent />
            {stock.sectorName ? <Badge text={stock.sectorName} /> : null}
          </View>
          {marketOpen && (
            <View style={ds.realtimeRow}>
              <PulsingDot />
              <Text style={ds.realtimeText}>실시간 갱신 중</Text>
            </View>
          )}
        </View>

        <View style={ds.headerRight}>
          <Text style={[ds.bigPrice, { color: changeColor }]}>
            {stock.price?.toLocaleString()}
          </Text>
          <Text style={[ds.changeText, { color: changeColor }]}>
            {stock.changeRate >= 0 ? '▲' : '▼'}
            {Math.abs(stock.change ?? 0).toLocaleString()}
            {'  '}
            {stock.changeRate >= 0 ? '+' : ''}{stock.changeRate?.toFixed(2)}%
          </Text>
          {updatedTime ? <Text style={ds.updatedAt}>{updatedTime} 갱신</Text> : null}
          {hasAfterHours && (
            <Text style={[ds.extraPrice, { color: ahColor }]}>
              시간외 {stock.afterHoursPrice?.toLocaleString()}{'  '}
              {(stock.afterHoursChangeRate ?? 0) >= 0 ? '+' : ''}
              {stock.afterHoursChangeRate?.toFixed(2)}%
            </Text>
          )}
          {hasPreMarket && (
            <Text style={[ds.extraPrice, { color: pmColor }]}>
              장전 {stock.preMarketPrice?.toLocaleString()}{'  '}
              {(stock.preMarketChangeRate ?? 0) >= 0 ? '+' : ''}
              {stock.preMarketChangeRate?.toFixed(2)}%
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={ds.scroll}>

        {/* ─── 3 KPI 카드 ─────────────────────────────────────────────── */}
        <View style={ds.kpiRow}>
          <MetricCard
            label="거래회전율"
            value={vt > 0 ? vt.toFixed(2) + '%' : '-'}
            subtitle={vtLabel}
            subtitleColor={vtColor}
            bar={vt > 0
              ? <GaugeBar value={vt} max={5} showValue={false} />
              : null
            }
          />
          <MetricCard
            label="누적 거래량"
            value={(stock.volume / 10000).toFixed(0) + '만'}
            subtitle={stock.prevVolume > 0
              ? `전일 대비 ${volPct >= 0 ? '+' : ''}${volPct.toFixed(0)}%`
              : '전일 데이터 없음'
            }
            subtitleColor={volPct >= 0 ? colors.up : colors.down}
            bar={
              <View style={ms.volBarTrack}>
                <View style={[ms.volBarFill, {
                  width: `${Math.min(volRatio / 2, 1) * 100}%`,
                  backgroundColor: volPct >= 0 ? colors.up : colors.down,
                }]} />
                <View style={ms.volBarMid} />
              </View>
            }
          />
          <MetricCard
            label="외국인 연속"
            value={fDaysStr}
            subtitle={fDaysLabel}
            subtitleColor={fDaysColor}
          />
        </View>

        {/* ─── 당일 분봉 차트 ──────────────────────────────────────────── */}
        <View style={ds.section}>
          <SectionTitle title="당일 분봉 (30분)" />
          <TradingChart code={code} height={220} />
        </View>

        {/* ─── 호가창 ─────────────────────────────────────────────────── */}
        <View style={ds.section}>
          <SectionTitle title="호가" />
          <OrderBookCard code={code} currentPrice={stock.price} />
        </View>

        {/* ─── 투자자별 가집계 ─────────────────────────────────────────── */}
        <View style={ds.section}>
          <SectionTitle title="투자자별 가집계" />
          <InvestorBar
            foreignNet={stock.foreignNetAmount ?? 0}
            institutionNet={stock.institutionNetAmount ?? 0}
            retailNet={stock.retailNetAmount ?? 0}
            updatedAt={stock.investorUpdatedAt}
            prevForeignNet={
              stock.investorIsEstimated && (stock.prevForeignNetAmount ?? 0) !== 0
                ? stock.prevForeignNetAmount
                : undefined
            }
            prevInstitutionNet={stock.prevInstitutionNetAmount}
            prevRetailNet={stock.prevRetailNetAmount}
            prevUpdatedAt={stock.prevInvestorDate
              ? `${stock.prevInvestorDate.slice(4, 6)}/${stock.prevInvestorDate.slice(6, 8)} 전일 확정`
              : undefined}
            foreignConsecutiveDays={stock.foreignConsecutiveDays}
            institutionConsecutiveDays={stock.institutionConsecutiveDays}
          />
        </View>

        {/* ─── 밸류에이션 ─────────────────────────────────────────────── */}
        <View style={ds.section}>
          <SectionTitle title="밸류에이션" />
          {stock.per !== undefined && (
            <ValuationBar
              label="PER" value={stock.per}
              sectorAvg={stock.perSector ?? 12} unit="×" decimals={1}
              description="주가수익비율 — 낮을수록 이익 대비 저평가"
            />
          )}
          {stock.pbr !== undefined && (
            <ValuationBar
              label="PBR" value={stock.pbr}
              sectorAvg={stock.pbrSector ?? 1.2} unit="×" decimals={2}
              description="주가순자산비율 — 낮을수록 자산 대비 저평가"
            />
          )}
          {stock.roe !== undefined && (
            <ValuationBar
              label="ROE" value={stock.roe}
              sectorAvg={stock.roeSector ?? 8} unit="%" decimals={1}
              invertColor
              description="자기자본이익률 — 높을수록 수익성 우수"
            />
          )}
          <ValuationBar
            label={stock.pcrEstimated ? 'PCR*' : 'PCR'} value={stock.pcr}
            sectorAvg={stock.pcrSector ?? 12} unit="×" decimals={1}
            description="주가현금흐름비율 — 낮을수록 현금 창출 대비 저평가"
          />
          <ValuationBar
            label={stock.pfcrEstimated ? 'P/FCR*' : 'P/FCR'}
            value={stock.pfcr}
            sectorAvg={stock.pfcrSector ?? 12} unit="×" decimals={1}
            description="주가잉여현금흐름비율 — 낮을수록 실질 현금 대비 저평가"
          />
          {stock.per === undefined && stock.pbr === undefined && (
            <Text style={ds.noData}>재무 데이터 없음</Text>
          )}
        </View>

        {/* ─── 관련 업종 ───────────────────────────────────────────────── */}
        <View style={ds.section}>
          <SectionTitle title="관련 업종" />
          <SectorPanel
            sectorName={stock.sectorName ?? ''}
            sectorChangeRate={stock.sectorChangeRate ?? 0}
            kospiChange={stock.kospiChange ?? 0}
            market={stock.market}
          />
        </View>

        {/* ─── AI 분석 ─────────────────────────────────────────────────── */}
        <View style={ds.section}>
          <SectionTitle title="AI 분석" />
          <AiInsightBox
            comment={comment}
            loading={commentLoading}
            modelReady={llmStatus === 'ready'}
          />
        </View>

        {/* ─── 매매 알림 조건 ──────────────────────────────────────────── */}
        <View style={ds.section}>
          <View style={ds.sectionHeaderRow}>
            <SectionTitle title="매매 알림 조건" />
            <TouchableOpacity
              onPress={() => navigation.navigate('AlertBuilder')}
              style={ds.addBtn}
            >
              <Text style={ds.addBtnText}>+ 새 알림</Text>
            </TouchableOpacity>
          </View>
          {stockAlerts.length === 0 ? (
            <Text style={ds.noData}>등록된 알림 없음 — '+ 새 알림'으로 추가하세요</Text>
          ) : (
            stockAlerts.slice(0, 5).map((a) => (
              <View key={a.id} style={ds.alertRow}>
                <View style={[ds.alertDot, { backgroundColor: a.enabled ? colors.up : colors.border2 }]} />
                <Text style={ds.alertName}>{a.name || '알림'}</Text>
                <Text style={[ds.alertStatus, { color: a.enabled ? colors.up : colors.text3 }]}>
                  {a.enabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── 스타일 ─────────────────────────────────────────────────────────────────

const bs = StyleSheet.create({
  badge: {
    borderWidth: 1, borderColor: colors.border2,
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    flexShrink: 0,
  },
  badgeAccent: { borderColor: colors.accent + '66' },
  badgeText: { color: colors.text2, fontSize: 10 },
  badgeAccentText: { color: colors.accent },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.up },
});

const ms = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.bg2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 3,
  },
  label:    { color: colors.text2, fontSize: 10 },
  value:    { color: colors.text,  fontSize: 16, fontWeight: '700' },
  subtitle: { color: colors.text3, fontSize: 10 },
  barWrap:  { marginTop: 4 },
  volBarTrack: {
    height: 6, backgroundColor: colors.border,
    borderRadius: 3, overflow: 'hidden', position: 'relative',
  },
  volBarFill: { height: '100%', borderRadius: 3 },
  volBarMid: {
    position: 'absolute', left: '50%', top: 0, bottom: 0,
    width: 1, backgroundColor: colors.border2,
  },
});

const ds = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
    alignItems: 'flex-start',
  },
  headerLeft:  { flex: 1, gap: 4 },
  headerRight: { alignItems: 'flex-end', gap: 2 },
  backBtn:     { marginBottom: 2 },
  backText:    { color: colors.accent, fontSize: 13 },
  stockName:   { color: colors.text, fontSize: 17, fontWeight: '800' },
  badgeRow:    { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  realtimeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  realtimeText:{ color: colors.text3, fontSize: 10 },
  bigPrice:    { fontSize: 22, fontWeight: '800' },
  changeText:  { fontSize: 13, fontWeight: '600' },
  updatedAt:   { color: colors.text3, fontSize: 10, marginTop: 2 },
  extraPrice:  { fontSize: 11, marginTop: 1 },
  scroll:      { padding: 16, paddingBottom: 56, gap: 20 },
  kpiRow:      { flexDirection: 'row', gap: 8 },
  section:     { gap: 10 },
  sectionTitle:{ color: colors.text2, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addBtn: {
    backgroundColor: colors.accent + '22',
    borderWidth: 1, borderColor: colors.accent + '66',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3,
  },
  addBtnText:   { color: colors.accent, fontSize: 11 },
  alertRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  alertDot:     { width: 7, height: 7, borderRadius: 3.5 },
  alertName:    { flex: 1, color: colors.text, fontSize: 13 },
  alertStatus:  { fontSize: 11, fontWeight: '600' },
  loadingCenter:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText:  { color: colors.text2 },
  noData:       { color: colors.text3, fontSize: 12, paddingVertical: 4 },
});
