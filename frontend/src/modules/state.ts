// ============================================================
// МОДУЛЬ СОСТОЯНИЯ (state.ts) — единственный источник правды
// ============================================================

import {
  AppState, Category, Operation, WheelsMode, TabId,
  PeriodTotal, ShiftState, VitoState, VitoOperation, Theme
} from '../types';

// ── Начальные значения ───────────────────────────────────────

export const initialAppState: AppState = {
  operations: [],
  currentBalance: 0,
  savingsGoal: 0,
  goalDescription: '',
  goalAchievedFlag: false,
  activeTab: 'dashboard',
  currentCategory: 'income',
  wheelsMode: 'chips',
  showTotal: false,
  totals: { day: 0, week: 0, month: 0 },
  undoStack: [],
  lastReminderDate: '',
  theme: 'neon',
  soundEnabled: true,
};

export const initialShiftState: ShiftState = {
  isRunning: false,
  jobType: 'Дайвер',
  startTime: null,
  elapsedMs: 0,
  sessions: [],
};

export const initialVitoState: VitoState = {
  operations: [],
  totalSalesVolume: 0,
  transactionCount: 0,
};

// ── Реактивное хранилище ─────────────────────────────────────

let appState: AppState = { ...initialAppState, undoStack: [] };
let shiftState: ShiftState = { ...initialShiftState, sessions: [] };
let vitoState: VitoState = { ...initialVitoState, operations: [] };

type Listener = () => void;
const listeners: Set<Listener> = new Set();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  listeners.forEach(fn => fn());
}

// ── Геттеры ──────────────────────────────────────────────────

export const getAppState = (): Readonly<AppState> => appState;
export const getShiftState = (): Readonly<ShiftState> => shiftState;
export const getVitoState = (): Readonly<VitoState> => vitoState;

// ── Обновление состояния ─────────────────────────────────────

export function patchAppState(patch: Partial<AppState>): void {
  appState = { ...appState, ...patch };
  notify();
}

export function patchShiftState(patch: Partial<ShiftState>): void {
  shiftState = { ...shiftState, ...patch };
  notify();
}

export function patchVitoState(patch: Partial<VitoState>): void {
  vitoState = { ...vitoState, ...patch };
  notify();
}

// ── Полная перезагрузка стейта (при загрузке из хранилища) ───

export function hydrateState(app: AppState, shift: ShiftState, vito: VitoState): void {
  appState = app;
  shiftState = shift;
  vitoState = vito;
  notify();
}

// ── Вспомогательные утилиты для категорий ───────────────────

export const CATEGORY_NAMES: Record<Category, string> = {
  income: 'Доходы',
  expense: 'Траты',
  rent: 'Аренда',
  wheels: 'Колёса',
  bonds: 'Вексели',
};

export const CATEGORY_COLORS: Record<Category, string> = {
  income: '#d18fff',
  expense: '#ff5c80',
  rent: '#5cffa2',
  wheels: '#7c83ff',
  bonds: '#ff8c5c',
};

export function getCategoryName(cat: Category): string {
  return CATEGORY_NAMES[cat] ?? cat;
}

export function getCategoryColor(cat: Category): string {
  return CATEGORY_COLORS[cat] ?? '#a0a5cc';
}

// ── Дата  ────────────────────────────────────────────────────

export function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Операции (Global) ─────────────────────────────────────────

function pushUndo(): void {
  const snap = {
    operations: [...appState.operations],
    currentBalance: appState.currentBalance,
    vitoOperations: [...vitoState.operations],
  };
  const stack = [...appState.undoStack, snap].slice(-20); // depth 20
  appState = { ...appState, undoStack: stack };
}

export function addGlobalOperation(
  category: Category,
  baseAmount: number,
  description: string,
  wheelsMode?: WheelsMode
): void {
  pushUndo();

  const mode = wheelsMode ?? appState.wheelsMode;
  let finalAmount: number;

  if (category === 'expense') {
    finalAmount = -Math.abs(baseAmount);
  } else if (category === 'bonds') {
    finalAmount = baseAmount * 1000;
  } else if (category === 'wheels') {
    finalAmount = mode === 'chips' ? baseAmount * 95 : baseAmount;
  } else {
    finalAmount = baseAmount; // income, rent (pre-calculated)
  }

  const op: Operation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: getToday(),
    timestamp: Date.now(),
    category,
    amount: finalAmount,
    baseAmount: ['wheels', 'bonds'].includes(category) ? baseAmount : undefined,
    multiplier: category === 'bonds' ? 1000 : category === 'wheels' && mode === 'chips' ? 95 : undefined,
    description,
    wheelsMode: category === 'wheels' ? mode : undefined,
  };

  const newOps = [op, ...appState.operations];
  const newBalance = appState.currentBalance + finalAmount;

  appState = { ...appState, operations: newOps, currentBalance: newBalance };
  notify();
}

export function removeGlobalOperation(id: string): void {
  pushUndo();
  const op = appState.operations.find(o => o.id === id);
  const delta = op ? -op.amount : 0;
  const newOps = appState.operations.filter(o => o.id !== id);
  appState = { ...appState, operations: newOps, currentBalance: appState.currentBalance + delta };
  notify();
}

export function clearAllOperations(): void {
  pushUndo();
  appState = { ...appState, operations: [], currentBalance: 0 };
  notify();
}

export function undoLastOperation(): boolean {
  if (appState.undoStack.length === 0) return false;
  const stack = [...appState.undoStack];
  const prev = stack.pop()!;
  appState = {
    ...appState,
    operations: prev.operations,
    currentBalance: prev.currentBalance,
    undoStack: stack,
  };
  vitoState = { ...vitoState, operations: prev.vitoOperations };
  recomputeVitoStats();
  notify();
  return true;
}

export function canUndo(): boolean {
  return appState.undoStack.length > 0;
}

// ── Операции 5VITO ───────────────────────────────────────────

export function addVitoOperation(amount: number, description: string): void {
  pushUndo();

  const vOp: VitoOperation = {
    id: `vito-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: getToday(),
    timestamp: Date.now(),
    amount,
    description,
  };

  const newVitoOps = [vOp, ...vitoState.operations];
  const newBalance = appState.currentBalance + amount;

  vitoState = { ...vitoState, operations: newVitoOps };
  recomputeVitoStats();
  appState = { ...appState, currentBalance: newBalance };
  notify();
}

export function removeVitoOperation(id: string): void {
  pushUndo();
  const op = vitoState.operations.find(o => o.id === id);
  const delta = op ? -op.amount : 0;
  vitoState = { ...vitoState, operations: vitoState.operations.filter(o => o.id !== id) };
  recomputeVitoStats();
  appState = { ...appState, currentBalance: appState.currentBalance + delta };
  notify();
}

function recomputeVitoStats(): void {
  const total = vitoState.operations.reduce((s, o) => s + o.amount, 0);
  vitoState = {
    ...vitoState,
    totalSalesVolume: Math.round(total * 100) / 100,
    transactionCount: vitoState.operations.length,
  };
}

// ── Баланс и цели ────────────────────────────────────────────

export function setBalance(val: number): void {
  patchAppState({ currentBalance: val });
}

export function setGoal(amount: number, description: string): void {
  patchAppState({ savingsGoal: amount, goalDescription: description, goalAchievedFlag: false });
}

export function getGoalProgress(): { current: number; goal: number; pct: number } {
  const { currentBalance, savingsGoal } = appState;
  const pct = savingsGoal > 0 ? Math.min((currentBalance / savingsGoal) * 100, 100) : 0;
  return { current: currentBalance, goal: savingsGoal, pct: Math.round(pct) };
}

// ── Shift ────────────────────────────────────────────────────

export function startShift(jobType: string): void {
  patchShiftState({ isRunning: true, jobType, startTime: Date.now(), elapsedMs: 0 });
}

export function stopShift(earnings: number): void {
  if (!shiftState.isRunning || shiftState.startTime === null) return;
  const durationMs = Date.now() - shiftState.startTime + shiftState.elapsedMs;
  const eph = durationMs > 0 ? Math.round((earnings / (durationMs / 3_600_000)) * 100) / 100 : 0;

  const session = {
    id: `shift-${Date.now()}`,
    jobType: shiftState.jobType,
    startTime: shiftState.startTime!,
    endTime: Date.now(),
    durationMs,
    earnings,
    eph,
  };

  const newSessions = [session, ...shiftState.sessions].slice(0, 50);
  patchShiftState({ isRunning: false, startTime: null, elapsedMs: 0, sessions: newSessions });
}

// ── Напоминание ──────────────────────────────────────────────

export function shouldShowReminder(): boolean {
  return appState.lastReminderDate !== getToday();
}

export function markReminderShown(): void {
  patchAppState({ lastReminderDate: getToday() });
}
