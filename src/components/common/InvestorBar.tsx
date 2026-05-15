import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  foreignNet: number;
  institutionNet: number;
  retailNet: number;
  updatedAt?: string;
  prevForeignNet?: number;
  prevInstitutionNet?: number;
  prevRetailNet?: number;
  prevUpdatedAt?: string;
  foreignConsecutiveDays?: number;
  institutionConsecutiveDays?: number;
}

function formatAmount(val: number): string {
  if (val === 0) return '0';
  const abs = Math.abs(val);
  if (abs >= 10_000) return `${(val / 10_000).toFixed(0)}조`;
  if (abs >= 100)   return `${(val / 100).toFixed(1)}억`;
  return `${(val * 100).toFixed(0)}만`;
}

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const ratio = total > 0 ? Math.abs(value) / total : 0;
  const barColor = value > 0 ? colors.buy : value < 0 ? colors.down : colors.text3;
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <View style={s.track}>
        <View style={[s.fill, { width: `${Math.min(ratio * 100, 100)}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[s.val, { color: barColor }]} numberOfLines={1}>
        {value > 0 ? '+' : ''}{formatAmount(value)}
      </Text>
    </View>
  );
}

function BarGroup({
  foreignNet, institutionNet, retailNet, label, dim,
}: {
  foreignNet: number; institutionNet: number; retailNet: number;
  label?: string; dim?: boolean;
}) {
  const total = Math.max(Math.abs(foreignNet), Math.abs(institutionNet), Math.abs(retailNet), 1);
  return (
    <View style={[s.group, dim ? s.groupDim : null]}>
      {label ? <Text style={s.groupLabel}>{label}</Text> : null}
      <Bar label="외국인" value={foreignNet}      total={total} />
      <Bar label="기관"   value={institutionNet}  total={total} />
      <Bar label="개인"   value={retailNet}        total={total} />
    </View>
  );
}

export function InvestorBar({
  foreignNet, institutionNet, retailNet, updatedAt,
  prevForeignNet, prevInstitutionNet, prevRetailNet, prevUpdatedAt,
  foreignConsecutiveDays, institutionConsecutiveDays,
}: Props) {
  const hasPrev = prevForeignNet !== undefined;

  const fDays = foreignConsecutiveDays ?? 0;
  const iDays = institutionConsecutiveDays ?? 0;
  const hasConsecutive = fDays !== 0 || iDays !== 0;

  function consecutiveLabel(days: number, label: string) {
    if (days === 0) return null;
    const dir = days > 0 ? '연속 순매수' : '연속 순매도';
    const color = days > 0 ? colors.up : colors.down;
    return (
      <Text style={[s.consecutive, { color }]}>
        {label} {Math.abs(days)}일 {dir}
      </Text>
    );
  }

  return (
    <View style={s.container}>
      <BarGroup
        foreignNet={foreignNet}
        institutionNet={institutionNet}
        retailNet={retailNet}
        label={updatedAt ? `${updatedAt} 기준` : undefined}
      />
      {hasConsecutive && (
        <View style={s.consecutiveRow}>
          {consecutiveLabel(fDays, '외국인')}
          {consecutiveLabel(iDays, '기관')}
        </View>
      )}
      {hasPrev && (
        <>
          <View style={s.divider} />
          <BarGroup
            foreignNet={prevForeignNet!}
            institutionNet={prevInstitutionNet ?? 0}
            retailNet={prevRetailNet ?? 0}
            label={prevUpdatedAt ?? '전일 확정'}
            dim
          />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 0 },
  group: { gap: 5 },
  groupDim: { opacity: 0.6 },
  groupLabel: { color: colors.text3, fontSize: 10, textAlign: 'right', marginBottom: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: colors.text2, fontSize: 11, width: 44 },
  track: {
    flex: 1, height: 6,
    backgroundColor: colors.border,
    borderRadius: 3, overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  val: { fontSize: 12, fontWeight: '600', width: 72, textAlign: 'right' },
  consecutiveRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  consecutive: { fontSize: 11, fontWeight: '600' },
});
