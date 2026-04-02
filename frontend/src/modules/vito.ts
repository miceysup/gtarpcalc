// ============================================================
// МОДУЛЬ 5VITO (vito.ts)
// Изолированное торговое логово — изолировано от глобальной статистики
// ============================================================

import { getVitoState, getAppState, addVitoOperation, removeVitoOperation } from './state';
import { showNotification, emptyState, fmt, createRipple } from './render';
import { soundManager } from './sounds';

export function renderVito(): void {
  updateVitoStats();
  renderVitoList();
}

export function setupVitoEvents(): void {
  // Кнопка «Выставить на продажу»
  document.getElementById('vito-list-btn')?.addEventListener('click', e => {
    handleVitoAdd();
    createRipple(e as MouseEvent, e.currentTarget as HTMLElement);
  });

  // Enter в полях
  ['vito-amount', 'vito-desc'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if ((e as KeyboardEvent).key === 'Enter') handleVitoAdd();
    });
  });

  // Превью суммы
  document.getElementById('vito-amount')?.addEventListener('input', updateVitoPreview);
}

// ── Добавление продажи ───────────────────────────────────────

function handleVitoAdd(): void {
  const amountEl = document.getElementById('vito-amount') as HTMLInputElement;
  const descEl   = document.getElementById('vito-desc')   as HTMLInputElement;

  const amount = parseFloat(amountEl?.value) || 0;
  const desc   = descEl?.value?.trim() || '';

  if (amount <= 0) {
    showNotification('Введите сумму продажи', 'error');
    amountEl?.focus();
    return;
  }
  if (!desc) {
    showNotification('Укажите описание товара', 'error');
    descEl?.focus();
    return;
  }

  soundManager.playAdd();
  addVitoOperation(amount, desc);

  amountEl.value = '';
  descEl.value = '';
  updateVitoPreview();

  showNotification(`💰 +${fmt(amount)}$ от продажи «${desc}»`, 'success');
  renderVito();
}

// ── Превью ───────────────────────────────────────────────────

function updateVitoPreview(): void {
  const n = parseFloat((document.getElementById('vito-amount') as HTMLInputElement)?.value) || 0;
  const el = document.getElementById('vito-amount-preview');
  if (el) el.textContent = n > 0 ? `+${fmt(n)}$` : '';
}

// ── Локальная статистика 5VITO ───────────────────────────────

function updateVitoStats(): void {
  const vito = getVitoState();
  const app  = getAppState();

  const volumeEl = document.getElementById('vito-total-volume');
  const countEl  = document.getElementById('vito-tx-count');
  const balEl    = document.getElementById('vito-global-bal');

  if (volumeEl) {
    volumeEl.textContent = `${fmt(vito.totalSalesVolume)}$`;
  }
  if (countEl) {
    countEl.textContent = String(vito.transactionCount);
  }
  if (balEl) {
    balEl.textContent = `${fmt(Math.round(app.currentBalance))}$`;
    balEl.className = 'vito-stat-val ' + (app.currentBalance >= 0 ? 'positive' : 'negative');
  }
}

// ── Список операций 5VITO ────────────────────────────────────

function renderVitoList(): void {
  const container = document.getElementById('vito-history');
  if (!container) return;

  const ops = getVitoState().operations;

  if (ops.length === 0) {
    container.innerHTML = emptyState('🏪', 'Нет продаж', 'Добавьте первую продажу выше');
    return;
  }

  container.innerHTML = ops.slice(0, 50).map(op => {
    const [y, m, d] = op.date.split('-');
    const time = new Date(op.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="vito-row">
        <div class="vr-meta">
          <span class="vr-date">${d}.${m}.${y}</span>
          <span class="vr-time">${time}</span>
        </div>
        <div class="vr-desc">${op.description}</div>
        <div class="vr-amount positive">+${fmt(op.amount)}$</div>
        <button class="vr-delete-btn" data-id="${op.id}" title="Удалить">✕</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll<HTMLButtonElement>('.vr-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id!;
      if (confirm('Удалить эту продажу?')) {
        soundManager.playDelete();
        removeVitoOperation(id);
        showNotification('Запись удалена', 'info');
        renderVito();
      }
    });
  });
}
