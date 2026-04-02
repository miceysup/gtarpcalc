// ============================================================
// МОДУЛЬ СТАТИСТИКИ (statistics.ts)
// Только глобальные операции; 5VITO ИСКЛЮЧЕНЫ
// ============================================================

import { getAppState } from './state';
import { filterByDate, getDayStats, DayStats, formatMoneyFull } from './calculator';
import { showNotification, emptyState, fmtSigned, fmt } from './render';

let filterStart = '';
let filterEnd = '';

// Кэш для кликабельных карточек дней
let dayCache: DayStats[] = [];

export function renderStatistics(): void {
  initFilters();
  applyAndRender();
}

function initFilters(): void {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const monthStart = firstOfMonth.toISOString().split('T')[0];

  const startEl = document.getElementById('stats-start') as HTMLInputElement | null;
  const endEl   = document.getElementById('stats-end') as HTMLInputElement | null;

  if (startEl && !startEl.value) startEl.value = monthStart;
  if (endEl && !endEl.value) endEl.value = today;

  filterStart = startEl?.value ?? monthStart;
  filterEnd   = endEl?.value ?? today;
}

export function setupStatisticsEvents(): void {
  document.getElementById('stats-apply')?.addEventListener('click', () => {
    const s = (document.getElementById('stats-start') as HTMLInputElement)?.value;
    const e = (document.getElementById('stats-end') as HTMLInputElement)?.value;
    if (s && e && s > e) { showNotification('Дата начала не может быть позже конца', 'error'); return; }
    filterStart = s ?? filterStart;
    filterEnd   = e ?? filterEnd;
    applyAndRender();
  });

  document.getElementById('stats-reset')?.addEventListener('click', () => {
    const today = new Date().toISOString().split('T')[0];
    const first = new Date(); first.setDate(1);
    filterStart = first.toISOString().split('T')[0];
    filterEnd   = today;
    const startEl = document.getElementById('stats-start') as HTMLInputElement | null;
    const endEl   = document.getElementById('stats-end') as HTMLInputElement | null;
    if (startEl) startEl.value = filterStart;
    if (endEl) endEl.value = filterEnd;
    applyAndRender();
  });
}

function applyAndRender(): void {
  const state = getAppState();
  // Exclude vito operations (5VITO ИСКЛЮЧЕНЫ)
  const globalOps = state.operations.filter(o => !o.vitoOnly);
  const filtered = filterByDate(globalOps, filterStart, filterEnd);

  updateSummaryCards(filtered);
  dayCache = getDayStats(filtered);
  renderDayGrid(dayCache);
}

// ── Карточки сводки ──────────────────────────────────────────

function updateSummaryCards(filtered: ReturnType<typeof filterByDate>): void {
  const opsCnt    = document.getElementById('stats-ops-count');
  const total     = document.getElementById('stats-total');
  const days      = document.getElementById('stats-days');
  const period    = document.getElementById('stats-period');

  const sum = filtered.reduce((s, o) => s + o.amount, 0);
  const uniqueDays = new Set(filtered.map(o => o.date)).size;

  if (opsCnt) opsCnt.textContent   = String(filtered.length);
  if (total) {
    total.textContent = fmtSigned(Math.round(sum));
    total.className = `stats-summary-val ${sum >= 0 ? 'positive' : 'negative'}`;
  }
  if (days) days.textContent = String(uniqueDays);
  if (period) {
    const [sy, sm, sd] = (filterStart || '????-??-??').split('-');
    const [ey, em, ed] = (filterEnd   || '????-??-??').split('-');
    period.textContent = `${sd}.${sm}.${sy} — ${ed}.${em}.${ey}`;
  }
}

// ── Сетка дней ───────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  income: '#d18fff', expense: '#ff5c80', rent: '#5cffa2', wheels: '#7c83ff', bonds: '#ff8c5c',
};
const CAT_NAMES: Record<string, string> = {
  income: 'Доходы', expense: 'Траты', rent: 'Аренда', wheels: 'Колёса', bonds: 'Вексели',
};

function renderDayGrid(stats: DayStats[]): void {
  const container = document.getElementById('stats-grid');
  if (!container) return;

  if (stats.length === 0) {
    container.innerHTML = emptyState('📊', 'Нет данных за выбранный период', 'Измените фильтры или добавьте операции');
    return;
  }

  container.innerHTML = stats.map((day, idx) => {
    const cats = Object.entries(day.byCategory)
      .filter(([, v]) => v !== 0)
      .map(([cat, val]) => `
        <div class="sd-cat">
          <span class="sd-cat-name" style="color:${CAT_COLORS[cat]}">${CAT_NAMES[cat]}</span>
          <span class="sd-cat-val ${val >= 0 ? 'positive' : 'negative'}">${fmtSigned(Math.round(val))}</span>
        </div>
      `).join('');

    return `
      <div class="stats-day-card" data-day-idx="${idx}">
        <div class="sdc-header">
          <span class="sdc-date">${day.displayDate}</span>
          <span class="sdc-total ${day.total >= 0 ? 'positive' : 'negative'}">${fmtSigned(Math.round(day.total))}</span>
        </div>
        <div class="sdc-cats">${cats}</div>
        <div class="sdc-footer">
          <span class="sdc-ops">Операций: ${day.operations.length}</span>
          <span class="sdc-hint">👆 детали</span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll<HTMLElement>('.stats-day-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.dayIdx!);
      if (!isNaN(idx)) showDayModal(dayCache[idx]);
    });
  });
}

// ── Модал детальной информации по дню ────────────────────────

function showDayModal(day: DayStats): void {
  const existing = document.getElementById('day-detail-modal');
  if (existing) existing.remove();

  const CAT_ORDER = ['income', 'rent', 'wheels', 'bonds', 'expense'];
  const grouped: Record<string, typeof day.operations> = {};
  day.operations.forEach(op => {
    if (!grouped[op.category]) grouped[op.category] = [];
    grouped[op.category].push(op);
  });

  const sortedCats = Object.keys(grouped).sort(
    (a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b)
  );

  const categoriesHtml = sortedCats.map(cat => {
    const ops = grouped[cat];
    const catTotal = ops.reduce((s, o) => s + o.amount, 0);
    const opsHtml = ops.map(op => {
      const t = new Date(op.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="dm-op">
          <span class="dm-op-time">${t}</span>
          <span class="dm-op-desc">${op.description || '—'}</span>
          <span class="dm-op-amt ${op.amount >= 0 ? 'positive' : 'negative'}">${fmtSigned(Math.round(op.amount))}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="dm-cat">
        <div class="dm-cat-header" style="border-left-color:${CAT_COLORS[cat]}">
          <span style="color:${CAT_COLORS[cat]}">${CAT_NAMES[cat]}</span>
          <span class="${catTotal >= 0 ? 'positive' : 'negative'}">${fmtSigned(Math.round(catTotal))}</span>
        </div>
        <div class="dm-ops">${opsHtml}</div>
      </div>
    `;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'day-detail-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content modal-md">
      <div class="modal-header">
        <h3>📅 ${day.displayDate}</h3>
        <button class="modal-close-btn" id="close-day-modal">✕</button>
      </div>
      <div class="modal-meta">
        <span>Операций: <strong>${day.operations.length}</strong></span>
        <span>Итого: <strong class="${day.total >= 0 ? 'positive' : 'negative'}">${fmtSigned(Math.round(day.total))}</strong></span>
      </div>
      <div class="modal-body dm-body">
        ${categoriesHtml}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  // CSS .modal-overlay по умолчанию display:none — нужно явно поставить flex
  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('modal-open'));

  const closeModal = () => {
    modal.classList.remove('modal-open');
    modal.addEventListener('transitionend', () => modal.remove(), { once: true });
  };

  document.getElementById('close-day-modal')?.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);
}
