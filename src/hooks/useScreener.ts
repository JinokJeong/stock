// 스크리너 실행 훅 — 프리셋 선택 + 배치 스캔 + 진행률 업데이트
import { useCallback } from 'react';
import { useScreenerStore } from '../store/screenerStore';
import { runScreener } from '../services/screenerService';
import { ALERT_PRESETS } from '../constants/alertPresets';
import { AlertCondition, LogicOperator } from '../types/alert';
import { ScreenerPresetId } from '../types/screener';

export function useScreener() {
  const {
    results,
    scanning,
    progress,
    done,
    total,
    lastScanAt,
    selectedPreset,
    sortBy,
    filterMarket,
    setResults,
    setScanning,
    setProgress,
    setPreset,
    setSortBy,
    setFilterMarket,
  } = useScreenerStore();

  const startScan = useCallback(
    async (
      customConditions?: AlertCondition[],
      customLogic?: LogicOperator[]
    ) => {
      if (scanning) return;
      setScanning(true);
      setProgress(0, 1);

      let conditions: AlertCondition[] = customConditions ?? [];
      let logic: LogicOperator[] = customLogic ?? [];

      if (!customConditions && selectedPreset !== 'custom') {
        const preset = ALERT_PRESETS.find((p) => p.id === selectedPreset);
        if (preset) {
          conditions = preset.conditions;
          logic = preset.logic;
        }
      }

      try {
        const results = await runScreener(conditions, logic, (d, t) => {
          setProgress(d, t);
        });
        setResults(results);
      } catch {}

      setScanning(false);
    },
    [scanning, selectedPreset]
  );

  // 필터/정렬 적용된 결과
  const filtered = results
    .filter((s) => filterMarket === 'ALL' || s.market === filterMarket)
    .sort((a, b) => {
      if (sortBy === 'supply') return b.scoreBreakdown.supply - a.scoreBreakdown.supply;
      if (sortBy === 'value') return b.scoreBreakdown.value - a.scoreBreakdown.value;
      if (sortBy === 'momentum') return b.scoreBreakdown.momentum - a.scoreBreakdown.momentum;
      return b.score - a.score;
    });

  return {
    results: filtered,
    scanning,
    progress,
    done,
    total,
    lastScanAt,
    selectedPreset,
    sortBy,
    filterMarket,
    startScan,
    setPreset,
    setSortBy,
    setFilterMarket,
  };
}
