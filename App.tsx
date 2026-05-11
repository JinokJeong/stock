// 앱 진입점 — 권한 요청, LLM 초기화, 네비게이션 마운트
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigation } from './src/navigation';
import { colors } from './src/theme/colors';
import { useLlmModel } from './src/hooks/useLlmModel';

function AppInner() {
  useLlmModel();

  useEffect(() => {
    // 알림 권한 요청 (Android 13+)
    if (Platform.OS === 'android') {
      (async () => {
        try {
          const { PermissionsAndroid } = require('react-native');
          if (Platform.Version >= 33) {
            await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
          }
        } catch {}
      })();
    }
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" backgroundColor={colors.bg} />
      <RootNavigation />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
