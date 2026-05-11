// 알림 조건 전역 스토어 — Zustand
import { create } from 'zustand';
import { UserAlert, AlertCondition, LogicOperator } from '../types/alert';

interface AlertStoreState {
  alerts: UserAlert[];
  editingAlert: UserAlert | null;
  addAlert: (alert: UserAlert) => void;
  removeAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
  setEditingAlert: (alert: UserAlert | null) => void;
  updateEditingConditions: (conditions: AlertCondition[], logic: LogicOperator[]) => void;
}

export const useAlertStore = create<AlertStoreState>((set) => ({
  alerts: [],
  editingAlert: null,

  addAlert: (alert) =>
    set((s) => ({ alerts: [...s.alerts, alert] })),

  removeAlert: (id) =>
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),

  toggleAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    })),

  setEditingAlert: (editingAlert) => set({ editingAlert }),

  updateEditingConditions: (conditions, logic) =>
    set((s) =>
      s.editingAlert
        ? { editingAlert: { ...s.editingAlert, conditions, logic } }
        : {}
    ),
}));
