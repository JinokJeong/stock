// 테마 카드 — 업종 스코어 + 등급 표시
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { ThemeScore } from '../../types/theme';

interface Props {
  theme: ThemeScore;
  onPress?: () => void;
}

const GRADE_COLOR: Record<string, string> = {
  관심: colors.text3,
  주목: colors.amber,
  급부상: colors.up,
  과열: colors.down,
};

export function ThemeCard({ theme, onPress }: Props) {
  const gradeColor = GRADE_COLOR[theme.grade] ?? colors.text2;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.header}>
        <Text style={styles.name}>{theme.sectorName}</Text>
        <Text style={[styles.grade, { color: gradeColor }]}>{theme.grade}</Text>
      </View>
      <View style={styles.scoreBg}>
        <View style={[styles.scoreFill, { width: `${theme.score}%`, backgroundColor: gradeColor }]} />
      </View>
      <View style={styles.row}>
        <Text style={styles.score}>{theme.score}점</Text>
        <Text style={styles.rate}>
          {theme.sectorChangeRate >= 0 ? '+' : ''}{theme.sectorChangeRate.toFixed(2)}%
        </Text>
        <Text style={styles.news}>{theme.newsCount}건</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg2,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  grade: { fontSize: 12, fontWeight: '700' },
  scoreBg: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  scoreFill: { height: '100%', borderRadius: 2 },
  row: { flexDirection: 'row', gap: 12 },
  score: { color: colors.text, fontSize: 13, fontWeight: '600' },
  rate: { color: colors.text2, fontSize: 12 },
  news: { color: colors.text3, fontSize: 11 },
});
