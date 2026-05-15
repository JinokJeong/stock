// AI 코멘트 표시 컴포넌트 — 온디바이스 LLM 생성 인사이트
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  comment: string;
  loading?: boolean;
  modelReady?: boolean;
}

export function AiInsightBox({ comment, loading = false, modelReady = true }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.badge}>AI</Text>
        <Text style={styles.label}>온디바이스 분석</Text>
        {!modelReady && <Text style={styles.notReady}>모델 준비 중</Text>}
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.loadingText}>분석 중...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator nestedScrollEnabled>
          <Text style={styles.comment}>
            {comment || (modelReady ? '신호 데이터 대기 중' : 'LLM 준비 후 분석 가능')}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg3,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  badge: {
    backgroundColor: colors.accent,
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  label: {
    color: colors.text2,
    fontSize: 11,
    flex: 1,
  },
  notReady: {
    color: colors.amber,
    fontSize: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: colors.text2,
    fontSize: 13,
  },
  scrollArea: {
    maxHeight: 120,
  },
  comment: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
});
