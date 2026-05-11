// 프리셋 선택 버튼 그룹 — 수평 스크롤
import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { ALERT_PRESETS } from '../../constants/alertPresets';
import { ScreenerPresetId } from '../../types/screener';

interface Props {
  selected: ScreenerPresetId;
  onSelect: (id: ScreenerPresetId) => void;
}

const ALL_PRESETS = [
  ...ALERT_PRESETS.map((p) => ({ id: p.id as ScreenerPresetId, name: p.name, icon: p.icon })),
  { id: 'custom' as ScreenerPresetId, name: '직접설정', icon: '⚙️' },
];

export function PresetFilter({ selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {ALL_PRESETS.map((p) => {
        const isSelected = p.id === selected;
        return (
          <TouchableOpacity
            key={p.id}
            style={[styles.btn, isSelected && styles.selected]}
            onPress={() => onSelect(p.id)}
            activeOpacity={0.75}
          >
            <Text style={styles.icon}>{p.icon}</Text>
            <Text style={[styles.name, isSelected && styles.nameSelected]}>
              {p.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '22',
  },
  icon: { fontSize: 14 },
  name: { color: colors.text2, fontSize: 12, fontWeight: '500' },
  nameSelected: { color: colors.accent, fontWeight: '600' },
});
