// ============================================================
// МОДУЛЬ INSIGHTS (insights.ts) — прогнозы и рекорды
// ============================================================

import { getAppState } from './state';
import { computeRecords, formatMoneyFull } from './calculator';
import { emptyState, fmtSigned, fmt } from './render';

export function renderInsights(): void {
  const st = getAppState();
  const globalOps = st.operations.filter(o => !o.vitoOnly);
  const rec = computeRecords(globalOps, st.currentBalance, st.savingsGoal);

  renderForecastCards(st.currentBalance, st.savingsGoal, st.goalDescription, rec.netLast7, rec.daysToGoal);
  renderRecordCards(rec);
}

// ── Карточки прогноза ────────────────────────────────────────

function renderForecastCards(
  balance: number,
  goal: number,
  goalDesc: string,
  netLast7: number,
  daysToGoal: number | null
): void {
  const el = document.getElementById('forecast-cards');
  if (!el) return;

  const dailyAvg = Math.round(netLast7 / 7);

  el.innerHTML = `
    <div class="forecast-card">
      <div class="fc-icon">📈</div>
      <div class="fc-label">Среднее за день (7 дн.)</div>
      <div class="fc-value ${dailyAvg >= 0 ? 'positive' : 'negative'}">${fmtSigned(dailyAvg)}</div>
    </div>
    <div class="forecast-card">
      <div class="fc-icon">📅</div>
      <div class="fc-label">Чистый доход за 7 дней</div>
      <div class="fc-value ${netLast7 >= 0 ? 'positive' : 'negative'}">${fmtSigned(Math.round(netLast7))}</div>
    </div>
    <div class="forecast-card">
      <div class="fc-icon">🎯</div>
      <div class="fc-label">Дней до цели${goalDesc ? ` «${goalDesc}»` : ''}</div>
      <div class="fc-value">
        ${goal <= 0
          ? '<span class="text-muted">Цель не задана</span>'
          : balance >= goal
            ? '<span class="positive">✅ Достигнута!</span>'
            : daysToGoal !== null
              ? `<span>${daysToGoal} дн.</span>`
              : '<span class="text-muted">Нет данных</span>'
        }
      </div>
    </div>
  `;
}

// ── Карточки рекордов ─────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  income: '#d18fff', expense: '#ff5c80', rent: '#5cffa2', wheels: '#7c83ff', bonds: '#ff8c5c',
};

function renderRecordCards(rec: ReturnType<typeof computeRecords>): void {
  const el = document.getElementById('records-cards');
  if (!el) return;

  el.innerHTML = `
    <div class="record-card">
      <div class="rc-trophy">🏆</div>
      <div class="rc-title">Лучший день</div>
      ${rec.bestDay
        ? `<div class="rc-val positive">+${fmt(Math.round(rec.bestDay.total))}$</div>
           <div class="rc-sub">${rec.bestDay.displayDate}</div>`
        : `<div class="rc-val text-muted">—</div>`
      }
    </div>
    <div class="record-card">
      <div class="rc-trophy">🥇</div>
      <div class="rc-title">Лучшая неделя</div>
      ${rec.bestWeek
        ? `<div class="rc-val positive">+${fmt(Math.round(rec.bestWeek.total))}$</div>
           <div class="rc-sub">${rec.bestWeek.weekLabel}</div>`
        : `<div class="rc-val text-muted">—</div>`
      }
    </div>
    <div class="record-card">
      <div class="rc-trophy">💎</div>
      <div class="rc-title">Крупнейшая операция</div>
      ${rec.largestOp
        ? `<div class="rc-val ${rec.largestOp.amount >= 0 ? 'positive' : 'negative'}">${fmtSigned(Math.round(rec.largestOp.amount))}</div>
           <div class="rc-sub" style="color:${CAT_COLORS[rec.largestOp.category]}">${rec.largestOp.description}</div>`
        : `<div class="rc-val text-muted">—</div>`
      }
    </div>
  `;
}
