// 스캔 진행 상태 표시 — 진행률 바 + 종목수 + 마지막 스캔 시간
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  scanning: boolean;
  done: number;
  total: number;
  progress: number;
  lastScanAt: number | null;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `오늘 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function ScanProgress({ scanning, done, total, progress, lastScanAt }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.status}>
          {scanning ? `${total}종목 중 ${done}개 완료` : '스캔 완료'}
        </Text>
        {lastScanAt && !scanning && (
          <Text style={styles.time}>마지막 스캔: {formatTime(lastScanAt)}</Text>
        )}
      </View>
      <View style={styles.barBg}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: scanning ? colors.accent : colors.up,
            },
          ]}
        />
      </View>
      {scanning && (
        <Text style={styles.pct}>{Math.round(progress * 100)}%</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  status: { color: colors.text2, fontSize: 12 },
  time: { color: colors.text3, fontSize: 11 },
  barBg: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  pct: {
    color: colors.accent,
    fontSize: 11,
    textAlign: 'right',
  },
});
