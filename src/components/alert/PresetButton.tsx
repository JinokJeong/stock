// 프리셋 버튼 — 알림 빌더용 프리셋 선택
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/colors';
import { AlertPreset } from '../../types/alert';

interface Props {
  preset: AlertPreset;
  selected?: boolean;
  onPress: () => void;
}

function ReliabilityDots({ n }: { n: number }) {
  return (
    <View style={styles.dots}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[styles.dot, i <= n ? styles.dotOn : styles.dotOff]}
        />
      ))}
    </View>
  );
}

export function PresetButton({ preset, selected, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.btn, selected && styles.selected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.icon}>{preset.icon}</Text>
      <View style={styles.info}>
        <Text style={[styles.name, selected && styles.nameSelected]}>{preset.name}</Text>
        <Text style={styles.desc} numberOfLines={1}>{preset.description}</Text>
        <View style={styles.footer}>
          <ReliabilityDots n={preset.reliability} />
          <Text style={styles.freq}>{preset.expectedFreq}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    backgroundColor: colors.bg2,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
    gap: 10,
  },
  selected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '15',
  },
  icon: { fontSize: 24 },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  nameSelected: { color: colors.accent },
  desc: { color: colors.text2, fontSize: 11, marginBottom: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { backgroundColor: colors.up },
  dotOff: { backgroundColor: colors.border2 },
  freq: { color: colors.text3, fontSize: 10 },
});
