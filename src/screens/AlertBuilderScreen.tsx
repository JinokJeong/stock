// 알림 빌더 화면 — 7가지 프리셋 + 직접 조합(AND/OR)
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { useAlertBuilder } from '../hooks/useAlertBuilder';
import { ALERT_PRESETS } from '../constants/alertPresets';
import { PresetButton } from '../components/alert/PresetButton';
import { ConditionCard } from '../components/alert/ConditionCard';
import { OpConnector } from '../components/alert/OpConnector';
import { UserAlert } from '../types/alert';

type Tab = 'presets' | 'custom' | 'myAlerts';

export function AlertBuilderScreen() {
  const [tab, setTab] = useState<Tab>('presets');
  const {
    alerts,
    editingAlert,
    startNew,
    saveEditing,
    removeAlert,
    toggleAlert,
    removeCondition,
    toggleLogic,
    cancelEditing,
  } = useAlertBuilder();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>알림 빌더</Text>
      </View>

      {/* 탭 */}
      <View style={styles.tabs}>
        {(['presets', 'custom', 'myAlerts'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => { setTab(t); cancelEditing(); }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'presets' ? '프리셋' : t === 'custom' ? '직접설정' : `내 알림(${alerts.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 프리셋 목록 */}
      {tab === 'presets' && (
        <FlatList
          data={ALERT_PRESETS}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PresetButton
              preset={item}
              onPress={() => {
                startNew(item);
                setTab('custom');
              }}
            />
          )}
          contentContainerStyle={styles.list}
        />
      )}

      {/* 직접 설정 / 편집 */}
      {tab === 'custom' && (
        <FlatList
          data={editingAlert?.conditions ?? []}
          keyExtractor={(_, i) => String(i)}
          ListHeaderComponent={
            <Text style={styles.sectionLabel}>
              {editingAlert?.name ?? '새 알림'} 편집
            </Text>
          }
          renderItem={({ item, index }) => (
            <>
              {index > 0 && editingAlert && (
                <OpConnector
                  op={editingAlert.logic[index - 1] ?? 'AND'}
                  onToggle={() => toggleLogic(index - 1)}
                />
              )}
              <View style={styles.condWrapper}>
                <ConditionCard
                  condition={item}
                  onRemove={() => removeCondition(index)}
                />
              </View>
            </>
          )}
          ListEmptyComponent={
            <View style={styles.emptyEdit}>
              <Text style={styles.emptyText}>
                {editingAlert ? '프리셋에서 불러오거나 조건을 추가하세요' : '프리셋 탭에서 시작하거나 새 알림을 만드세요'}
              </Text>
            </View>
          }
          ListFooterComponent={
            editingAlert ? (
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.saveBtn} onPress={saveEditing}>
                  <Text style={styles.saveBtnText}>저장</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={cancelEditing}>
                  <Text style={styles.cancelBtnText}>취소</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.newBtn} onPress={() => startNew()}>
                <Text style={styles.newBtnText}>+ 새 알림 만들기</Text>
              </TouchableOpacity>
            )
          }
          contentContainerStyle={styles.list}
        />
      )}

      {/* 내 알림 목록 */}
      {tab === 'myAlerts' && (
        <FlatList
          data={alerts}
          keyExtractor={(a) => a.id}
          renderItem={({ item }: { item: UserAlert }) => (
            <View style={styles.alertRow}>
              <View style={styles.alertInfo}>
                <Text style={styles.alertName}>{item.name}</Text>
                <Text style={styles.alertMeta}>{item.conditions.length}개 조건</Text>
              </View>
              <Switch
                value={item.enabled}
                onValueChange={() => toggleAlert(item.id)}
                trackColor={{ true: colors.up, false: colors.border }}
                thumbColor={colors.text}
              />
              <TouchableOpacity onPress={() => removeAlert(item.id)}>
                <Text style={styles.removeText}>삭제</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>저장된 알림이 없습니다</Text>
            </View>
          }
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { borderColor: colors.accent, backgroundColor: colors.accent + '22' },
  tabText: { color: colors.text2, fontSize: 13 },
  tabTextActive: { color: colors.accent, fontWeight: '600' },
  list: { paddingBottom: 32 },
  sectionLabel: {
    color: colors.text2,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  condWrapper: { paddingHorizontal: 16, marginVertical: 2 },
  editActions: { flexDirection: 'row', gap: 12, padding: 16 },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.bg2,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: { color: colors.text2 },
  newBtn: {
    margin: 16,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border2,
    borderStyle: 'dashed',
  },
  newBtnText: { color: colors.accent, fontSize: 14 },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  alertInfo: { flex: 1 },
  alertName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  alertMeta: { color: colors.text3, fontSize: 11, marginTop: 2 },
  removeText: { color: colors.down, fontSize: 12 },
  empty: { padding: 40, alignItems: 'center' },
  emptyEdit: { padding: 24, alignItems: 'center' },
  emptyText: { color: colors.text3, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
