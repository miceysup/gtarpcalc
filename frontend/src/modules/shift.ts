// ============================================================
// МОДУЛЬ СМЕНЫ (shift.ts)
// ============================================================

import { getShiftState, patchShiftState, startShift, stopShift } from './state';
import { showNotification, emptyState, fmtDuration, fmt } from './render';
import { soundManager } from './sounds';
import { addGlobalOperation } from './state';
import { renderDashboard } from './dashboard';

const JOB_TYPES = ['Дайвер 🤿', 'Дальнобойщик 🚛', 'Шахтёр ⛏️', 'Строитель 🏗️', 'Курьер 🛵', 'Рыбак 🎣', 'Другое'];

let timerInterval: number | null = null;
let sessionStart: number | null = null;

export function renderShift(): void {
  renderJobTypeGrid();
  updateTimerUI();
  renderSessionHistory();
}

export function setupShiftEvents(): void {
  document.getElementById('shift-start-btn')?.addEventListener('click', handleStartShift);
  document.getElementById('shift-stop-btn')?.addEventListener('click', handleStopShift);
}

// ── Выбор работы ─────────────────────────────────────────────

function renderJobTypeGrid(): void {
  const el = document.getElementById('job-type-grid');
  if (!el) return;

  const current = getShiftState().jobType;
  el.innerHTML = JOB_TYPES.map(j => `
    <button class="job-type-btn ${j === current ? 'active' : ''}" data-job="${j}">${j}</button>
  `).join('');

  el.querySelectorAll<HTMLButtonElement>('.job-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (getShiftState().isRunning) { showNotification('Смена уже запущена', 'warning'); return; }
      patchShiftState({ jobType: btn.dataset.job! });
      renderJobTypeGrid();
      soundManager.playClick();
    });
  });
}

// ── Запуск / Остановка смены ─────────────────────────────────

function handleStartShift(): void {
  const st = getShiftState();
  if (st.isRunning) { showNotification('Смена уже идёт', 'warning'); return; }

  startShift(st.jobType);
  sessionStart = Date.now();

  timerInterval = window.setInterval(() => {
    updateTimerUI();
  }, 1000);

  updateTimerButtons(true);
  soundManager.playAdd();
  showNotification(`Смена «${st.jobType}» начата`, 'success');
}

function handleStopShift(): void {
  const st = getShiftState();
  if (!st.isRunning) { showNotification('Смена не запущена', 'warning'); return; }

  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

  const earningsInput = document.getElementById('shift-earnings') as HTMLInputElement;
  const earnings = parseFloat(earningsInput?.value) || 0;

  stopShift(earnings);

  if (earnings > 0) {
    addGlobalOperation('income', earnings, `Смена: ${getShiftState().jobType}`);
    showNotification(`Смена завершена! +${fmt(earnings)}$ добавлено в баланс`, 'success');
    soundManager.playSuccess();
    renderDashboard();
  } else {
    showNotification('Смена завершена (без дохода)', 'info');
  }

  if (earningsInput) earningsInput.value = '';
  updateTimerButtons(false);
  updateTimerUI();
  renderSessionHistory();
}

// ── Обновление UI таймера ─────────────────────────────────────

let lastDisplayedMs = 0;

function updateTimerUI(): void {
  const st = getShiftState();
  const timerEl = document.getElementById('shift-timer');
  const ephEl = document.getElementById('shift-eph');
  const earningsInput = document.getElementById('shift-earnings') as HTMLInputElement | null;

  let ms = 0;
  if (st.isRunning && sessionStart !== null) {
    ms = Date.now() - sessionStart + st.elapsedMs;
  }

  if (timerEl) timerEl.textContent = fmtDuration(ms);

  // EPH projection
  if (ephEl) {
    const earnVal = parseFloat(earningsInput?.value || '0') || 0;
    const hrs = ms / 3_600_000;
    const eph = hrs > 0.01 ? Math.round(earnVal / hrs) : 0;
    ephEl.textContent = eph > 0 ? `${fmt(eph)}$/ч` : '—';
  }

  lastDisplayedMs = ms;
}

function updateTimerButtons(running: boolean): void {
  const startBtn = document.getElementById('shift-start-btn') as HTMLButtonElement | null;
  const stopBtn  = document.getElementById('shift-stop-btn')  as HTMLButtonElement | null;
  const earningsGrp = document.getElementById('shift-earnings-group');

  if (startBtn) startBtn.disabled = running;
  if (stopBtn)  stopBtn.disabled  = !running;
  if (earningsGrp) earningsGrp.style.display = running ? 'block' : 'none';

  const timerEl = document.getElementById('shift-timer');
  if (timerEl) {
    timerEl.className = 'shift-timer-display' + (running ? ' running' : '');
  }
}

// ── История смен ─────────────────────────────────────────────

function renderSessionHistory(): void {
  const container = document.getElementById('shift-history');
  if (!container) return;

  const sessions = getShiftState().sessions;

  if (sessions.length === 0) {
    container.innerHTML = emptyState('⏱️', 'Нет записей о сменах', 'Начните смену выше');
    return;
  }

  container.innerHTML = sessions.slice(0, 20).map(s => {
    const start = new Date(s.startTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `
      <div class="shift-session-row">
        <div class="ssr-job">${s.jobType}</div>
        <div class="ssr-meta">
          <span class="ssr-date">${start}</span>
          <span class="ssr-dur">${fmtDuration(s.durationMs)}</span>
        </div>
        <div class="ssr-eph">
          <span class="ssr-earn positive">+${fmt(s.earnings)}$</span>
          <span class="ssr-eph-val">${fmt(s.eph)}$/ч</span>
        </div>
      </div>
    `;
  }).join('');
}
