// ============================================================
// МОДУЛЬ ВЫЧИСЛЕНИЙ (calculator.ts)
// ============================================================

import { Operation, Category, PeriodTotal } from '../types';
import { getToday } from './state';

// ── Итоги за периоды ─────────────────────────────────────────

export function calculateTotals(operations: Operation[]): PeriodTotal {
  const today = getToday();
  const now = new Date();

  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let day = 0, week = 0, month = 0;

  for (const op of operations) {
    if (op.vitoOnly) continue;            // Только глобальные операции

    const opDate = new Date(op.date + 'T00:00:00');

    if (op.date === today) day += op.amount;
    if (opDate >= weekAgo) week += op.amount;
    if (opDate >= monthStart) month += op.amount;
  }

  return {
    day: round2(day),
    week: round2(week),
    month: round2(month),
  };
}

// ── Фильтрация ───────────────────────────────────────────────

export function filterByDate(
  operations: Operation[],
  start: string,
  end: string
): Operation[] {
  // Exclude vito operations from global stats
  const global = operations.filter(op => !op.vitoOnly);
  if (!start && !end) return global;
  return global.filter(op => {
    if (start && op.date < start) return false;
    if (end && op.date > end) return false;
    return true;
  });
}

export function filterByCategory(operations: Operation[], category: Category | 'all'): Operation[] {
  if (category === 'all') return operations;
  return operations.filter(op => op.category === category);
}

// ── Статистика по дням ───────────────────────────────────────

export interface DayStats {
  date: string;
  displayDate: string;
  total: number;
  byCategory: Record<Category, number>;
  operations: Operation[];
}

export function getDayStats(operations: Operation[]): DayStats[] {
  const map = new Map<string, DayStats>();

  for (const op of operations) {
    if (op.vitoOnly) continue;
    if (!map.has(op.date)) {
      const [y, m, d] = op.date.split('-');
      map.set(op.date, {
        date: op.date,
        displayDate: `${d}.${m}.${y}`,
        total: 0,
        byCategory: { income: 0, expense: 0, rent: 0, wheels: 0, bonds: 0 },
        operations: [],
      });
    }
    const ds = map.get(op.date)!;
    ds.total += op.amount;
    ds.byCategory[op.category] += op.amount;
    ds.operations.push(op);
  }

  return Array.from(map.values())
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ── "Рекорды" (для вкладки Insights) ────────────────────────

export interface Records {
  bestDay: { date: string; displayDate: string; total: number } | null;
  bestWeek: { weekLabel: string; total: number } | null;
  largestOp: { description: string; amount: number; category: string } | null;
  netLast7: number;
  daysToGoal: number | null;
}

export function computeRecords(operations: Operation[], currentBalance: number, goal: number): Records {
  const global = operations.filter(op => !op.vitoOnly);

  // Best day
  const dayMap = new Map<string, number>();
  for (const op of global) {
    dayMap.set(op.date, (dayMap.get(op.date) ?? 0) + op.amount);
  }
  let bestDay: Records['bestDay'] = null;
  dayMap.forEach((total, date) => {
    if (!bestDay || total > bestDay.total) {
      const [y, m, d] = date.split('-');
      bestDay = { date, displayDate: `${d}.${m}.${y}`, total };
    }
  });

  // Best week (rolling 7-day window)
  const sorted = [...global].sort((a, b) => a.date.localeCompare(b.date));
  let bestWeek: Records['bestWeek'] = null;
  for (let i = 0; i < sorted.length; i++) {
    const windowStart = new Date(sorted[i].date + 'T00:00:00');
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowStart.getDate() + 6);
    const weekTotal = sorted
      .filter(op => {
        const d = new Date(op.date + 'T00:00:00');
        return d >= windowStart && d <= windowEnd;
      })
      .reduce((s, o) => s + o.amount, 0);
    if (!bestWeek || weekTotal > bestWeek.total) {
      const [y, m, d] = sorted[i].date.split('-');
      bestWeek = { weekLabel: `Нед. с ${d}.${m}.${y}`, total: weekTotal };
    }
  }

  // Largest single operation
  let largestOp: Records['largestOp'] = null;
  for (const op of global) {
    if (!largestOp || op.amount > largestOp.amount) {
      largestOp = { description: op.description || op.category, amount: op.amount, category: op.category };
    }
  }

  // Net last 7 days
  const today = getToday();
  const sevenAgo = new Date();
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  const sevenAgoStr = sevenAgo.toISOString().split('T')[0];
  const netLast7 = global
    .filter(op => op.date >= sevenAgoStr && op.date <= today)
    .reduce((s, op) => s + op.amount, 0);

  // Days to goal
  let daysToGoal: number | null = null;
  if (goal > 0 && currentBalance < goal && netLast7 > 0) {
    const dailyAvg = netLast7 / 7;
    daysToGoal = Math.ceil((goal - currentBalance) / dailyAvg);
  }

  return { bestDay, bestWeek, largestOp, netLast7: round2(netLast7), daysToGoal };
}

// ── Утилита ──────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;

export function formatMoney(n: number, withSign = false): string {
  const sign = withSign && n > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('ru-RU').format(Math.abs(n))}${n < 0 ? '' : ''}$`;
}

export function formatMoneyFull(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('ru-RU').format(n)}$`;
}
