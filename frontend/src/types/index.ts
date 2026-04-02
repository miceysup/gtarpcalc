// ============================================================
// ТИПЫ ПРИЛОЖЕНИЯ GTA RP ФИНАНСЫ v3.0 (с модулем 5VITO)
// ============================================================

export type Category = 'income' | 'expense' | 'rent' | 'wheels' | 'bonds';
export type WheelsMode = 'chips' | 'money';
export type TabId = 'dashboard' | 'statistics' | 'shift' | 'insights' | 'vito';
export type Theme = 'neon' | 'dark' | 'galaxy' | 'sunset';

// ── Операция (глобальная) ────────────────────────────────────
export interface Operation {
  id: string;
  date: string;           // YYYY-MM-DD
  timestamp: number;      // Unix ms
  category: Category;
  amount: number;         // calculated final amount (negative for expense)
  baseAmount?: number;
  multiplier?: number;
  description: string;
  wheelsMode?: WheelsMode;
  // Флаг: НЕ включать в глобальную статистику
  vitoOnly?: boolean;     // true → только 5VITO
}

// ── Операция 5VITO ───────────────────────────────────────────
export interface VitoOperation {
  id: string;
  date: string;           // YYYY-MM-DD
  timestamp: number;
  amount: number;         // всегда положительная
  description: string;
}

// ── Смена (Shift) ────────────────────────────────────────────
export interface ShiftSession {
  id: string;
  jobType: string;
  startTime: number;      // Unix ms
  endTime: number;        // Unix ms
  durationMs: number;
  earnings: number;       // заработок за смену
  eph: number;            // earnings per hour
}

// ── Итоги за период ─────────────────────────────────────────
export interface PeriodTotal {
  day: number;
  week: number;
  month: number;
}

// ── Глобальное состояние приложения ─────────────────────────
export interface AppState {
  // Глобальные операции (Dashboard + Statistics, БЕЗ vitoOnly)
  operations: Operation[];

  // Баланс и цели
  currentBalance: number;
  savingsGoal: number;
  goalDescription: string;
  goalAchievedFlag: boolean;

  // Навигация
  activeTab: TabId;
  currentCategory: Category;
  wheelsMode: WheelsMode;
  showTotal: boolean;

  // Итоги (кэш)
  totals: PeriodTotal;

  // Undo stack (хранит снимки operations + currentBalance)
  undoStack: Array<{ operations: Operation[]; currentBalance: number; vitoOperations: VitoOperation[] }>;

  // Напоминание
  lastReminderDate: string;

  // Тема
  theme: Theme;

  // Sound
  soundEnabled: boolean;
}

// ── Состояние смены ──────────────────────────────────────────
export interface ShiftState {
  isRunning: boolean;
  jobType: string;
  startTime: number | null;    // Unix ms
  elapsedMs: number;
  sessions: ShiftSession[];
}

// ── Состояние 5VITO ─────────────────────────────────────────
export interface VitoState {
  operations: VitoOperation[];
  totalSalesVolume: number;
  transactionCount: number;
}
