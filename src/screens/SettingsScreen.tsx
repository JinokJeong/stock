// 설정 화면 — API 키 입력 + 모델 다운로드 상태
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../theme/colors';
import { useLlmModel } from '../hooks/useLlmModel';
import { ModelDownloader } from '../components/llm/ModelDownloader';

const KEYS = [
  { id: 'KIS_APP_KEY', label: 'KIS App Key', placeholder: 'PSxxxxxx...' },
  { id: 'KIS_APP_SECRET', label: 'KIS App Secret', placeholder: 'xxxxx...' },
  { id: 'DART_API_KEY', label: 'DART API Key', placeholder: 'xxxxx...' },
];

function ApiKeyField({
  id, label, placeholder,
}: { id: string; label: string; placeholder: string }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(id).then((v) => {
      if (v) setValue(v.slice(0, 4) + '****');
    });
  }, []);

  const save = async () => {
    if (!value || value.includes('****')) return;
    await SecureStore.setItemAsync(id, value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    Alert.alert('저장됨', `${label}이 안전하게 저장되었습니다.`);
  };

  return (
    <View style={styles.keyRow}>
      <Text style={styles.keyLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(t) => { setValue(t); setSaved(false); }}
          placeholder={placeholder}
          placeholderTextColor={colors.text3}
          secureTextEntry
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>{saved ? '저장됨' : '저장'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function SettingsScreen() {
  const { status, downloadProgress, errorMessage, retry } = useLlmModel();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>설정</Text>

        <Text style={styles.section}>API 키</Text>
        <Text style={styles.hint}>
          KIS/DART API 키는 기기 내 보안 저장소에 암호화됩니다.{'\n'}
          키 없이도 Mock 데이터로 UI 전체 동작합니다.
        </Text>
        {KEYS.map((k) => <ApiKeyField key={k.id} {...k} />)}

        <Text style={styles.section}>온디바이스 LLM</Text>
        <ModelDownloader
          status={status}
          downloadProgress={downloadProgress}
          errorMessage={errorMessage}
          onRetry={retry}
        />

        <Text style={styles.section}>앱 정보</Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoRow}>버전  1.0.0</Text>
          <Text style={styles.infoRow}>모델  Gemma 3 1B IT Q4_K_M</Text>
          <Text style={styles.infoRow}>빌드  Dev Build (React Native)</Text>
          <Text style={styles.infoRow}>유니버스  코스피200 + 코스닥150 (350종목)</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 20 },
  section: {
    color: colors.text2,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  hint: {
    color: colors.text3,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  keyRow: {
    marginBottom: 12,
  },
  keyLabel: { color: colors.text2, fontSize: 13, marginBottom: 6 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.bg2,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.buy,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  infoBox: {
    backgroundColor: colors.bg2,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  infoRow: { color: colors.text2, fontSize: 12 },
});
