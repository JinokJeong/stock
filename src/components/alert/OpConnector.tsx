// AND/OR 토글 — 조건 사이 논리 연산자 전환
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { LogicOperator } from '../../types/alert';

interface Props {
  op: LogicOperator;
  onToggle: () => void;
}

export function OpConnector({ op, onToggle }: Props) {
  const isAnd = op === 'AND';
  return (
    <TouchableOpacity
      style={[styles.btn, isAnd ? styles.and : styles.or]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, isAnd ? styles.andText : styles.orText]}>{op}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
    marginVertical: 4,
    borderWidth: 1,
  },
  and: { backgroundColor: colors.buy + '22', borderColor: colors.buy },
  or: { backgroundColor: colors.accent + '22', borderColor: colors.accent },
  text: { fontSize: 12, fontWeight: '700' },
  andText: { color: colors.buy },
  orText: { color: colors.accent },
});
