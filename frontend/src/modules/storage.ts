// ============================================================
// МОДУЛЬ ХРАНИЛИЩА (storage.ts)
// Три отдельных ключа: global, shift, vito
// ============================================================

import { AppState, ShiftState, VitoState } from '../types';
import { initialAppState, initialShiftState, initialVitoState } from './state';

const KEYS = {
  app: 'gtarp-v3-app',
  shift: 'gtarp-v3-shift',
  vito: 'gtarp-v3-vito',
  theme: 'gtarp-v3-theme',
} as const;

// ── Запись ───────────────────────────────────────────────────

export function saveAppState(state: AppState): void {
  try { localStorage.setItem(KEYS.app, JSON.stringify(state)); } catch { /* quota */ }
}

export function saveShiftState(state: ShiftState): void {
  try { localStorage.setItem(KEYS.shift, JSON.stringify(state)); } catch { /* quota */ }
}

export function saveVitoState(state: VitoState): void {
  try { localStorage.setItem(KEYS.vito, JSON.stringify(state)); } catch { /* quota */ }
}

// ── Чтение ───────────────────────────────────────────────────

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(KEYS.app);
    if (!raw) return { ...initialAppState, undoStack: [] };
    const parsed = JSON.parse(raw) as Partial<AppState>;

    // Migration / defaults
    return {
      ...initialAppState,
      ...parsed,
      undoStack: [],               // UndoStack не персистируем между сессиями
      operations: Array.isArray(parsed.operations) ? parsed.operations : [],
    };
  } catch {
    return { ...initialAppState, undoStack: [] };
  }
}

export function loadShiftState(): ShiftState {
  try {
    const raw = localStorage.getItem(KEYS.shift);
    if (!raw) return { ...initialShiftState, sessions: [] };
    const parsed = JSON.parse(raw) as Partial<ShiftState>;
    return {
      ...initialShiftState,
      ...parsed,
      // Если приложение перезапустилось посреди смены — сбрасываем таймер
      isRunning: false,
      startTime: null,
      elapsedMs: 0,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return { ...initialShiftState, sessions: [] };
  }
}

export function loadVitoState(): VitoState {
  try {
    const raw = localStorage.getItem(KEYS.vito);
    if (!raw) return { ...initialVitoState, operations: [] };
    const parsed = JSON.parse(raw) as Partial<VitoState>;
    const ops = Array.isArray(parsed.operations) ? parsed.operations : [];
    const total = ops.reduce((s: number, o: { amount: number }) => s + o.amount, 0);
    return {
      operations: ops,
      totalSalesVolume: Math.round(total * 100) / 100,
      transactionCount: ops.length,
    };
  } catch {
    return { ...initialVitoState, operations: [] };
  }
}

// ── Тема ────────────────────────────────────────────────────

export function saveTheme(theme: string): void {
  localStorage.setItem(KEYS.theme, theme);
}

export function loadTheme(): string {
  return localStorage.getItem(KEYS.theme) ?? 'neon';
}

// ── Экспорт данных ───────────────────────────────────────────

export function exportAllData(app: AppState, shift: ShiftState, vito: VitoState): string {
  return JSON.stringify({ app, shift, vito, exportedAt: new Date().toISOString() }, null, 2);
}
