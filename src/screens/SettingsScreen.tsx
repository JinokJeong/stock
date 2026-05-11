// 설정 화면 — API 키 입력 + 모델 다운로드 상태
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { colors } from '../theme/colors';
import { useLlmModel } from '../hooks/useLlmModel';
import { ModelDownloader } from '../components/llm/ModelDownloader';
import { kisApi } from '../services/kisApi';

const KIS_BASE = 'https://openapi.koreainvestment.com:9443';

const KEYS = [
  { id: 'KIS_APP_KEY',    label: 'KIS App Key',    placeholder: 'P로 시작하는 36자리' },
  { id: 'KIS_APP_SECRET', label: 'KIS App Secret', placeholder: 'App Secret 키 입력' },
  { id: 'DART_API_KEY',   label: 'DART API Key',   placeholder: '40자리 DART 키 (선택)' },
];

function ApiKeyField({ id, label, placeholder }: { id: string; label: string; placeholder: string }) {
  const [value, setValue]     = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(id).then((v) => {
      if (v) {
        setIsSaved(true);
        setValue(v.slice(0, 4) + '••••••••');
      }
    });
  }, []);

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes('••••••••')) return;
    try {
      await SecureStore.setItemAsync(id, trimmed);
      setIsSaved(true);
      setEditing(false);
      setValue(trimmed.slice(0, 4) + '••••••••');
      Alert.alert('저장됨', `${label}이 저장되었습니다.`);
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '오류');
    }
  };

  const startEdit = () => {
    setValue('');
    setEditing(true);
  };

  return (
    <View style={styles.keyRow}>
      <View style={styles.keyLabelRow}>
        <Text style={styles.keyLabel}>{label}</Text>
        {isSaved && !editing && (
          <Text style={styles.savedBadge}>✓ 저장됨</Text>
        )}
        {!isSaved && (
          <Text style={styles.notSavedBadge}>✗ 미설정</Text>
        )}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(t) => { setValue(t); }}
          placeholder={isSaved && !editing ? '저장된 키가 있습니다' : placeholder}
          placeholderTextColor={colors.text3}
          editable={!isSaved || editing}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {isSaved && !editing ? (
          <TouchableOpacity style={styles.editBtn} onPress={startEdit}>
            <Text style={styles.editBtnText}>수정</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.saveBtn} onPress={save}>
            <Text style={styles.saveBtnText}>저장</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function KisConnectionTest() {
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [message, setMessage] = useState('');

  const test = async () => {
    setStatus('testing');
    setMessage('');
    try {
      // 캐시된 토큰 삭제 후 새로 발급 시도
      await AsyncStorage.removeItem('KIS_ACCESS_TOKEN');
      await AsyncStorage.removeItem('KIS_TOKEN_EXPIRES_AT');
      kisApi.resetClient();

      const appKey    = await SecureStore.getItemAsync('KIS_APP_KEY');
      const appSecret = await SecureStore.getItemAsync('KIS_APP_SECRET');

      if (!appKey || !appSecret) {
        setStatus('fail');
        setMessage('키가 저장되지 않았습니다. 위에서 저장 버튼을 눌러주세요.');
        return;
      }

      const res = await axios.post(`${KIS_BASE}/oauth2/tokenP`, {
        grant_type:  'client_credentials',
        appkey:      appKey,
        appsecret:   appSecret,
      }, { timeout: 10000 });

      if (res.data.access_token) {
        await AsyncStorage.setItem('KIS_ACCESS_TOKEN', res.data.access_token);
        const exp = ((res.data.expires_in ?? 21600) * 1000) + Date.now();
        await AsyncStorage.setItem('KIS_TOKEN_EXPIRES_AT', String(exp));
        setStatus('ok');
        setMessage(`토큰 발급 성공 ✓ (${Math.round((res.data.expires_in ?? 21600) / 3600)}시간 유효)`);
      } else {
        setStatus('fail');
        setMessage(`응답 오류: ${JSON.stringify(res.data)}`);
      }
    } catch (e: any) {
      setStatus('fail');
      const errMsg = e?.response?.data?.msg1 ?? e?.response?.data?.message ?? e?.message ?? '알 수 없는 오류';
      setMessage(errMsg);
    }
  };

  return (
    <View style={styles.testBox}>
      <TouchableOpacity
        style={[styles.testBtn, status === 'testing' && { opacity: 0.6 }]}
        onPress={test}
        disabled={status === 'testing'}
      >
        {status === 'testing'
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.testBtnText}>KIS 연결 테스트</Text>
        }
      </TouchableOpacity>
      {message ? (
        <Text style={[styles.testResult, { color: status === 'ok' ? colors.up : colors.down }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

export function SettingsScreen() {
  const { status, downloadProgress, errorMessage, startDownload, retry } = useLlmModel();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>설정</Text>

        <Text style={styles.section}>API 키</Text>
        {KEYS.map((k) => <ApiKeyField key={k.id} {...k} />)}
        <KisConnectionTest />

        <Text style={styles.section}>온디바이스 LLM</Text>
        <ModelDownloader
          status={status}
          downloadProgress={downloadProgress}
          errorMessage={errorMessage}
          onDownload={startDownload}
          onRetry={retry}
        />

        <Text style={styles.section}>앱 정보</Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoRow}>버전  1.0.0</Text>
          <Text style={styles.infoRow}>모델  Qwen2.5 0.5B Instruct Q4_K_M (~380MB)</Text>
          <Text style={styles.infoRow}>빌드  Dev Build (React Native)</Text>
          <Text style={styles.infoRow}>유니버스  코스피200 + 코스닥150 (350종목)</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 48 },
  title:  { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 20 },
  section: {
    color: colors.text2, fontSize: 13, fontWeight: '700',
    marginTop: 24, marginBottom: 10,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  keyRow:      { marginBottom: 14 },
  keyLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  keyLabel:    { color: colors.text2, fontSize: 13 },
  savedBadge:    { color: colors.up,   fontSize: 11, fontWeight: '600' },
  notSavedBadge: { color: colors.down, fontSize: 11, fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, backgroundColor: colors.bg2, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    color: colors.text, fontSize: 13,
    borderWidth: 1, borderColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.buy, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  editBtn: {
    backgroundColor: colors.bg3, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  editBtnText: { color: colors.text2, fontSize: 13 },
  testBox: { marginTop: 8, gap: 8 },
  testBtn: {
    backgroundColor: colors.accent, borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  testBtnText:  { color: '#fff', fontSize: 14, fontWeight: '600' },
  testResult:   { fontSize: 13, lineHeight: 18 },
  infoBox: {
    backgroundColor: colors.bg2, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: colors.border, gap: 6,
  },
  infoRow: { color: colors.text2, fontSize: 12 },
});
