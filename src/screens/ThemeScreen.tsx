// 테마 감지 화면 — 업종 스코어 + 뉴스 피드
import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { useThemeAnalysis } from '../hooks/useThemeAnalysis';
import { useThemeStore } from '../store/themeStore';
import { ThemeCard } from '../components/theme/ThemeCard';
import { NewsItem } from '../components/common/NewsItem';

export function ThemeScreen() {
  const { refresh, isAnalyzing } = useThemeAnalysis();
  const { themes, news } = useThemeStore();

  type ListItem =
    | { kind: 'header'; key: string }
    | { kind: 'theme'; key: string; data: (typeof themes)[0] }
    | { kind: 'newsHeader'; key: string }
    | { kind: 'news'; key: string; data: (typeof news)[0] };

  const listData: ListItem[] = [
    { kind: 'header', key: 'th' },
    ...themes.map((t) => ({ kind: 'theme' as const, key: `theme_${t.sectorCode}`, data: t })),
    { kind: 'newsHeader', key: 'nh' },
    ...news.map((n) => ({ kind: 'news' as const, key: `news_${n.id}`, data: n })),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>테마 감지</Text>
        {isAnalyzing && <Text style={styles.analyzing}>분석 중...</Text>}
      </View>
      <FlatList
        data={listData}
        keyExtractor={(item) => item.key}
        refreshControl={
          <RefreshControl refreshing={isAnalyzing} onRefresh={refresh} tintColor={colors.accent} />
        }
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return <Text style={styles.sectionTitle}>업종 스코어</Text>;
          }
          if (item.kind === 'theme') {
            return <ThemeCard theme={item.data} />;
          }
          if (item.kind === 'newsHeader') {
            return <Text style={[styles.sectionTitle, styles.newsTitle]}>최신 공시</Text>;
          }
          if (item.kind === 'news') {
            return (
              <View style={styles.newsWrapper}>
                <NewsItem item={item.data} />
              </View>
            );
          }
          return null;
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>분석 중입니다...</Text>
          </View>
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
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  analyzing: { color: colors.accent, fontSize: 12 },
  sectionTitle: {
    color: colors.text2,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  newsTitle: { paddingTop: 20 },
  newsWrapper: { paddingHorizontal: 16 },
  list: { paddingBottom: 32 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.text3, fontSize: 14 },
});
