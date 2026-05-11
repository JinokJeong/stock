// 뉴스 아이템 — 제목/감성 점수/시간 표시
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { NewsItem as NewsItemType } from '../../types/theme';

interface Props {
  item: NewsItemType;
  onPress?: () => void;
}

export function NewsItem({ item, onPress }: Props) {
  const sentiment = item.sentiment ?? 0.5;
  const sentimentColor =
    sentiment > 0.65 ? colors.up : sentiment < 0.35 ? colors.down : colors.amber;
  const sentimentLabel =
    sentiment > 0.65 ? '긍정' : sentiment < 0.35 ? '부정' : '중립';

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        <Text style={[styles.badge, { backgroundColor: sentimentColor + '33', color: sentimentColor }]}>
          {sentimentLabel}
        </Text>
        {item.corpName ? <Text style={styles.corp}>{item.corpName}</Text> : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      {item.summary ? <Text style={styles.summary} numberOfLines={1}>{item.summary}</Text> : null}
      <Text style={styles.time}>{item.publishedAt?.slice(0, 10) ?? ''}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg2,
    borderRadius: 10,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  badge: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  corp: {
    color: colors.text2,
    fontSize: 11,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  summary: {
    color: colors.text2,
    fontSize: 11,
    marginBottom: 4,
  },
  time: {
    color: colors.text3,
    fontSize: 10,
  },
});
