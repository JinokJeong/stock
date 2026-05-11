// 알림 빌더 상태 관리 훅
import { useCallback } from 'react';
import { useAlertStore } from '../store/alertStore';
import { AlertCondition, AlertPreset, LogicOperator, UserAlert } from '../types/alert';
import { sendLocalAlert, evaluateConditions } from '../services/alertEngine';

export function useAlertBuilder() {
  const {
    alerts,
    editingAlert,
    addAlert,
    removeAlert,
    toggleAlert,
    setEditingAlert,
    updateEditingConditions,
  } = useAlertStore();

  const startNew = useCallback((preset?: AlertPreset) => {
    const newAlert: UserAlert = {
      id: `alert_${Date.now()}`,
      presetId: preset?.id,
      name: preset?.name ?? '새 알림',
      conditions: preset?.conditions ?? [],
      logic: preset?.logic ?? [],
      enabled: true,
      createdAt: Date.now(),
    };
    setEditingAlert(newAlert);
  }, []);

  const saveEditing = useCallback(() => {
    if (!editingAlert) return;
    addAlert(editingAlert);
    setEditingAlert(null);
  }, [editingAlert]);

  const addCondition = useCallback(
    (condition: AlertCondition) => {
      if (!editingAlert) return;
      const conditions = [...editingAlert.conditions, condition];
      const logic: LogicOperator[] = [
        ...editingAlert.logic,
        ...(editingAlert.conditions.length > 0 ? (['AND'] as LogicOperator[]) : []),
      ];
      updateEditingConditions(conditions, logic);
    },
    [editingAlert]
  );

  const removeCondition = useCallback(
    (index: number) => {
      if (!editingAlert) return;
      const conditions = editingAlert.conditions.filter((_, i) => i !== index);
      const logic = editingAlert.logic.filter((_, i) => i < conditions.length - 1);
      updateEditingConditions(conditions, logic);
    },
    [editingAlert]
  );

  const toggleLogic = useCallback(
    (index: number) => {
      if (!editingAlert) return;
      const logic = editingAlert.logic.map((op, i) =>
        i === index ? (op === 'AND' ? 'OR' : 'AND') : op
      ) as LogicOperator[];
      updateEditingConditions(editingAlert.conditions, logic);
    },
    [editingAlert]
  );

  return {
    alerts,
    editingAlert,
    startNew,
    saveEditing,
    removeAlert,
    toggleAlert,
    addCondition,
    removeCondition,
    toggleLogic,
    cancelEditing: () => setEditingAlert(null),
  };
}
