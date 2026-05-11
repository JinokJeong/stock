// 모델 다운로드 UI — 다운로드/로드 상태 시각화
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { LlmStatus } from '../../types/llm';

interface Props {
  status: LlmStatus;
  downloadProgress: number;
  errorMessage: string | null;
  onRetry: () => void;
  onDownload: () => void;
}

const STATUS_LABEL: Record<LlmStatus, string> = {
  idle: '대기 중',
  checking: '모델 확인 중...',
  downloading: '모델 다운로드 중',
  loading: '모델 로딩 중...',
  ready: '준비 완료',
  error: '오류 발생',
};

export function ModelDownloader({ status, downloadProgress, errorMessage, onRetry, onDownload }: Props) {
  if (status === 'ready') return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI 분석 엔진</Text>
      <Text style={styles.subtitle}>온디바이스 LLM (Gemma 3 1B · ~800MB)</Text>

      {status === 'idle' && (
        <>
          <Text style={styles.hint}>Wi-Fi 연결 후 다운로드하세요</Text>
          <TouchableOpacity style={styles.downloadBtn} onPress={onDownload}>
            <Text style={styles.retryText}>AI 모델 다운로드</Text>
          </TouchableOpacity>
        </>
      )}

      {status === 'downloading' && (
        <>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
          </View>
          <Text style={styles.pctText}>{Math.round(downloadProgress * 100)}% · ~800MB</Text>
          <Text style={styles.hint}>Wi-Fi 연결 권장 · 앱을 닫지 마세요</Text>
        </>
      )}

      {(status === 'checking' || status === 'loading') && (
        <ActivityIndicator color={colors.accent} size="large" style={styles.spinner} />
      )}

      {status !== 'idle' && (
        <Text style={styles.label}>{STATUS_LABEL[status]}</Text>
      )}

      {status === 'error' && (
        <>
          <Text style={styles.error}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg2,
    borderRadius: 12,
    padding: 20,
    margin: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.text2,
    fontSize: 12,
    marginBottom: 16,
  },
  progressBg: {
    width: '100%',
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  pctText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  hint: {
    color: colors.text3,
    fontSize: 11,
    marginBottom: 8,
  },
  spinner: {
    marginBottom: 12,
  },
  label: {
    color: colors.text2,
    fontSize: 13,
    marginTop: 4,
  },
  error: {
    color: colors.down,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  downloadBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 8,
    backgroundColor: colors.buy,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
