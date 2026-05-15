// 추천 종목 카드 — 스코어/수급/밸류/모멘텀 요약 표시
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { RecommendStock } from '../../types/screener';

interface Props {
  stock: RecommendStock;
  rank: number;
  onPress?: () => void;
}

export function StockScoreCard({ stock, rank, onPress }: Props) {
  const changeColor = stock.changeRate >= 0 ? colors.up : colors.down;
  const scoreRatio = stock.score / 100;
  const scoreFillColor =
    stock.score >= 70 ? colors.up : stock.score >= 50 ? colors.amber : colors.text2;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.header}>
        <Text style={styles.rank}>{rank}위</Text>
        <View style={styles.nameBlock}>
          <Text style={styles.name} numberOfLines={1}>{stock.name} ({stock.code})</Text>
          <Text style={styles.meta}>{stock.market}</Text>
        </View>
        <View style={styles.priceBlock}>
          <Text style={styles.price}>{stock.price.toLocaleString()}</Text>
          <Text style={[styles.change, { color: changeColor }]}>
            {stock.changeRate >= 0 ? '+' : ''}{stock.changeRate.toFixed(2)}%
          </Text>
        </View>
      </View>

      {/* 총점 바 */}
      <View style={styles.scoreRow}>
        <View style={styles.scoreBg}>
          <View style={[styles.scoreFill, { width: `${scoreRatio * 100}%`, backgroundColor: scoreFillColor }]} />
        </View>
        <Text style={[styles.scoreVal, { color: scoreFillColor }]}>{stock.score}점</Text>
      </View>

      {/* 부문 점수 */}
      <View style={styles.breakdown}>
        <Text style={styles.bdItem}>수급 {stock.scoreBreakdown.supply}</Text>
        <Text style={styles.sep}>·</Text>
        <Text style={styles.bdItem}>밸류 {stock.scoreBreakdown.value}</Text>
        <Text style={styles.sep}>·</Text>
        <Text style={styles.bdItem}>모멘텀 {stock.scoreBreakdown.momentum}</Text>
      </View>

      {/* 핵심 지표 */}
      <View style={styles.indicators}>
        {(stock.volTurnover ?? 0) > 0 && <Text style={styles.ind}>회전율 {stock.volTurnover.toFixed(2)}%</Text>}
        {stock.foreignConsecutiveDays > 0 && (
          <Text style={styles.ind}>외국인 {stock.foreignConsecutiveDays}일 연속</Text>
        )}
        {stock.pbr > 0 && <Text style={styles.ind}>PBR {stock.pbr.toFixed(2)}×</Text>}
        {stock.themeGrade && (
          <Text style={[styles.ind, stock.themeGrade === '급부상' || stock.themeGrade === '과열' ? { color: colors.up } : null]}>
            {stock.themeKeyword} {stock.themeGrade}
          </Text>
        )}
      </View>

      <Text style={styles.detail}>상세보기 →</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg2,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  rank: {
    color: colors.text3,
    fontSize: 12,
    width: 28,
    marginTop: 2,
  },
  nameBlock: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.text3, fontSize: 10, marginTop: 2 },
  priceBlock: { alignItems: 'flex-end' },
  price: { color: colors.text, fontSize: 14, fontWeight: '600' },
  change: { fontSize: 12, marginTop: 2 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  scoreBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreFill: { height: '100%', borderRadius: 3 },
  scoreVal: { fontSize: 13, fontWeight: '700', width: 36, textAlign: 'right' },
  breakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  bdItem: { color: colors.text2, fontSize: 12 },
  sep: { color: colors.text3, fontSize: 10 },
  indicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  ind: {
    color: colors.text2,
    fontSize: 11,
    backgroundColor: colors.bg3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detail: {
    color: colors.accent,
    fontSize: 12,
    textAlign: 'right',
  },
});
