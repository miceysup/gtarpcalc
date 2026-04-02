// ============================================================
// МОДУЛЬ РЕНДЕРИНГА ДЭШБОРДА (dashboard.ts)
// ============================================================

import { AppState, Category, WheelsMode } from '../types';
import {
  getAppState, getCategoryName, getCategoryColor,
  addGlobalOperation, removeGlobalOperation, clearAllOperations, undoLastOperation, canUndo,
  patchAppState, setBalance, setGoal,
} from './state';
import { calculateTotals, filterByCategory, formatMoneyFull, formatMoney } from './calculator';
import {
  showNotification, createRipple, emptyState, buildSegmentedControl, openModal, closeModal, fmtSigned, fmt
} from './render';
import { soundManager } from './sounds';

// ── Рендер вкладки Dashboard ────────────────────────────────

export function renderDashboard(): void {
  const state = getAppState();

  updateBalanceWidget(state);
  updateSegmentedCategories(state);
  updateInputForm(state);
  updateTotalsRow(state);
  updateHistoryList(state);
  updateUndoBtn();
}

// ── Виджет баланса ───────────────────────────────────────────

function updateBalanceWidget(state: AppState): void {
  const balEl = document.getElementById('bal-value');
  if (balEl) {
    balEl.textContent = `${fmt(Math.round(state.currentBalance))}$`;
    balEl.className = 'bal-value' + (state.currentBalance < 0 ? ' negative' : '');
  }

  const goalBar = document.getElementById('goal-bar-wrap');
  const goalFill = document.getElementById('goal-bar-fill');
  const goalLbl  = document.getElementById('goal-bar-label');

  if (goalBar && goalFill && goalLbl) {
    if (state.savingsGoal > 0) {
      goalBar.style.display = 'block';
      const pct = Math.min((state.currentBalance / state.savingsGoal) * 100, 100);
      goalFill.style.width = `${Math.max(0, pct)}%`;
      goalLbl.textContent = `${Math.round(pct)}% до цели ${fmt(state.savingsGoal)}$`;
      if (state.goalDescription) goalLbl.textContent += ` — ${state.goalDescription}`;
    } else {
      goalBar.style.display = 'none';
    }
  }
}

// ── Segmented Control категорий ──────────────────────────────

const CATS: { value: Category; label: string }[] = [
  { value: 'income',  label: '💰 Доходы'   },
  { value: 'expense', label: '💸 Траты'    },
  { value: 'rent',    label: '🏢 Аренда'   },
  { value: 'wheels',  label: '🎰 Колёса'   },
  { value: 'bonds',   label: '📜 Вексели'  },
];

function updateSegmentedCategories(state: AppState): void {
  buildSegmentedControl('category-seg', CATS, state.currentCategory, (val) => {
    soundManager.playClick();
    patchAppState({ currentCategory: val as Category });
    renderDashboard();
  });
}

// ── Форма ввода ───────────────────────────────────────────────

function updateInputForm(state: AppState): void {
  const cat = state.currentCategory;

  // Скрываем все формы
  ['form-generic', 'form-income', 'form-expense', 'form-rent', 'form-wheels', 'form-bonds']
    .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

  const color = getCategoryColor(cat);
  const addBtn = document.getElementById('btn-add-op') as HTMLButtonElement | null;
  if (addBtn) {
    addBtn.style.background = `linear-gradient(135deg, ${color}cc, ${color}88)`;
    addBtn.textContent = cat === 'rent' ? '🏢 Добавить аренду' : `Добавить ${getCategoryName(cat).toLowerCase()}`;
  }

  if (cat === 'income')  { const f = document.getElementById('form-income');  if (f) f.style.display = 'block'; }
  else if (cat === 'expense'){ const f = document.getElementById('form-expense'); if (f) f.style.display = 'block'; }
  else if (cat === 'rent')   { const f = document.getElementById('form-rent');    if (f) f.style.display = 'block'; }
  else if (cat === 'wheels') {
    const f = document.getElementById('form-wheels');
    if (f) f.style.display = 'block';
    updateWheelsMode(state.wheelsMode);
  } else if (cat === 'bonds') { const f = document.getElementById('form-bonds');  if (f) f.style.display = 'block'; }
}

function updateWheelsMode(mode: WheelsMode): void {
  const chipsBtn = document.getElementById('wheels-chips-btn');
  const moneyBtn = document.getElementById('wheels-money-btn');
  const resultEl = document.getElementById('wheels-result');
  const labelEl  = document.getElementById('wheels-amount-lbl');

  chipsBtn?.classList.toggle('active', mode === 'chips');
  moneyBtn?.classList.toggle('active', mode === 'money');

  if (labelEl) labelEl.textContent = mode === 'chips' ? 'Количество фишек' : 'Сумма денег ($)';
  if (resultEl) resultEl.style.display = mode === 'chips' ? 'flex' : 'none';
}

// ── Итоги ─────────────────────────────────────────────────────

function updateTotalsRow(state: AppState): void {
  const ops = state.showTotal
    ? state.operations.filter(o => !o.vitoOnly)
    : filterByCategory(state.operations.filter(o => !o.vitoOnly), state.currentCategory);

  const totals = calculateTotals(ops);

  const set = (id: string, val: number) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = `${fmtSigned(val)}`;
    el.className = 'total-val' + (val > 0 ? ' positive' : val < 0 ? ' negative' : '');
  };

  set('total-day', totals.day);
  set('total-week', totals.week);
  set('total-month', totals.month);

  const toggleLbl = document.getElementById('total-toggle-label');
  if (toggleLbl) toggleLbl.textContent = state.showTotal ? 'Общее' : getCategoryName(state.currentCategory);
}

// ── Список операций ──────────────────────────────────────────

function updateHistoryList(state: AppState): void {
  const container = document.getElementById('history-list');
  if (!container) return;

  const globalOps = state.operations.filter(o => !o.vitoOnly);
  const ops = state.showTotal
    ? globalOps.slice(0, 30)
    : filterByCategory(globalOps, state.currentCategory).slice(0, 20);

  if (ops.length === 0) {
    container.innerHTML = emptyState('📭', 'Операций нет', 'Добавьте первую операцию выше');
    return;
  }

  container.innerHTML = ops.map(op => {
    const [y, m, d] = op.date.split('-');
    const color = getCategoryColor(op.category);
    return `
      <div class="history-row" data-op-id="${op.id}">
        <div class="hr-date">${d}.${m}</div>
        <div class="hr-cat" style="color:${color}">${getCategoryName(op.category)}</div>
        <div class="hr-desc">${op.description || '—'}</div>
        <div class="hr-amount ${op.amount >= 0 ? 'positive' : 'negative'}">${op.amount >= 0 ? '+' : ''}${fmt(Math.abs(op.amount))}$</div>
        <button class="hr-delete-btn" data-id="${op.id}" title="Удалить">✕</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll<HTMLButtonElement>('.hr-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id!;
      if (confirm('Удалить эту операцию?')) {
        soundManager.playDelete();
        removeGlobalOperation(id);
        showNotification('Операция удалена', 'info');
        renderDashboard();
      }
    });
  });
}

function updateUndoBtn(): void {
  const btn = document.getElementById('btn-undo') as HTMLButtonElement | null;
  if (btn) btn.disabled = !canUndo();
}

// ── Обработчики событий формы ────────────────────────────────

export function setupDashboardEvents(): void {
  // Кнопка добавления
  document.getElementById('btn-add-op')?.addEventListener('click', e => {
    handleAddOperation();
    createRipple(e as MouseEvent, e.currentTarget as HTMLElement);
  });

  // Enter в полях ввода
  const inputIds = [
    'income-amount', 'income-desc', 'expense-amount', 'expense-desc',
    'rent-price', 'rent-hours', 'wheels-amount', 'bonds-amount',
  ];
  inputIds.forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if ((e as KeyboardEvent).key === 'Enter') handleAddOperation();
    });
  });

  // Режим колёс
  document.getElementById('wheels-chips-btn')?.addEventListener('click', () => {
    soundManager.playClick();
    patchAppState({ wheelsMode: 'chips' });
    updateWheelsMode('chips');
    updateWheelsPreview();
  });
  document.getElementById('wheels-money-btn')?.addEventListener('click', () => {
    soundManager.playClick();
    patchAppState({ wheelsMode: 'money' });
    updateWheelsMode('money');
    updateWheelsPreview();
  });
  document.getElementById('wheels-amount')?.addEventListener('input', updateWheelsPreview);

  // Быстрые кнопки доходов
  document.querySelectorAll<HTMLButtonElement>('.quick-income').forEach(btn => {
    btn.addEventListener('click', () => {
      (document.getElementById('income-desc') as HTMLInputElement).value = btn.dataset.desc!;
      soundManager.playClick();
    });
  });

  // Быстрые кнопки трат
  document.querySelectorAll<HTMLButtonElement>('.quick-expense').forEach(btn => {
    btn.addEventListener('click', () => {
      (document.getElementById('expense-desc') as HTMLInputElement).value = btn.dataset.desc!;
      soundManager.playClick();
    });
  });

  // Быстрые кнопки часов аренды
  document.querySelectorAll<HTMLButtonElement>('.rent-hour-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const hoursInput = document.getElementById('rent-hours') as HTMLInputElement;
      hoursInput.value = String((parseFloat(hoursInput.value) || 0) + parseFloat(btn.dataset.h!));
    });
  });

  // Предустановки аренды
  document.getElementById('rent-preset1')?.addEventListener('click', () => {
    (document.getElementById('rent-price') as HTMLInputElement).value = '5500';
    (document.getElementById('rent-hours') as HTMLInputElement).value = '1';
  });
  document.getElementById('rent-preset2')?.addEventListener('click', () => {
    (document.getElementById('rent-price') as HTMLInputElement).value = '5500';
    (document.getElementById('rent-hours') as HTMLInputElement).value = '2';
  });

  // Векселя — авторасчёт
  document.getElementById('bonds-amount')?.addEventListener('input', () => {
    const n = parseFloat((document.getElementById('bonds-amount') as HTMLInputElement).value) || 0;
    const res = document.getElementById('bonds-result');
    if (res) res.textContent = `= ${fmt(n * 1000)}$`;
  });

  // Toggles
  document.getElementById('total-toggle')?.addEventListener('change', e => {
    patchAppState({ showTotal: (e.target as HTMLInputElement).checked });
    renderDashboard();
  });

  // Undo
  document.getElementById('btn-undo')?.addEventListener('click', e => {
    createRipple(e as MouseEvent, e.currentTarget as HTMLElement);
    if (undoLastOperation()) {
      soundManager.playDelete();
      showNotification('Действие отменено', 'info');
      renderDashboard();
    } else {
      showNotification('Нечего отменять', 'warning');
    }
  });

  // Очистить
  document.getElementById('btn-clear')?.addEventListener('click', () => {
    if (confirm('Очистить ВСЕ операции? Это нельзя отменить.')) {
      clearAllOperations();
      soundManager.playDelete();
      showNotification('Все операции очищены', 'info');
      renderDashboard();
    }
  });

  // Настройки (открыть модал)
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    const st = getAppState();
    (document.getElementById('set-balance') as HTMLInputElement).value = String(st.currentBalance);
    (document.getElementById('set-goal') as HTMLInputElement).value = String(st.savingsGoal);
    (document.getElementById('set-goal-desc') as HTMLInputElement).value = st.goalDescription;
    openModal('settings-modal');
  });

  document.getElementById('btn-settings-save')?.addEventListener('click', () => {
    const bal  = parseFloat((document.getElementById('set-balance') as HTMLInputElement).value) || 0;
    const goal = parseFloat((document.getElementById('set-goal') as HTMLInputElement).value) || 0;
    const desc = (document.getElementById('set-goal-desc') as HTMLInputElement).value.trim();
    setBalance(bal);
    setGoal(goal, desc);
    closeModal('settings-modal');
    soundManager.playAdd();
    showNotification('Настройки сохранены', 'success');
    renderDashboard();
  });

  document.getElementById('btn-settings-close')?.addEventListener('click', () => closeModal('settings-modal'));
  document.getElementById('settings-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('settings-modal');
  });
}

// ── Добавление операции ──────────────────────────────────────

function handleAddOperation(): void {
  const cat = getAppState().currentCategory;

  if (cat === 'income')  handleAddIncome();
  else if (cat === 'expense') handleAddExpense();
  else if (cat === 'rent')    handleAddRent();
  else if (cat === 'wheels')  handleAddWheels();
  else if (cat === 'bonds')   handleAddBonds();
}

function getInputVal(id: string): string {
  return (document.getElementById(id) as HTMLInputElement)?.value?.trim() ?? '';
}
function clearInputs(...ids: string[]): void {
  ids.forEach(id => { const el = document.getElementById(id) as HTMLInputElement; if (el) el.value = ''; });
}

function handleAddIncome(): void {
  const amount = parseFloat(getInputVal('income-amount'));
  if (isNaN(amount) || amount <= 0) { showNotification('Введите корректную сумму', 'error'); return; }
  const desc = getInputVal('income-desc');
  soundManager.playAdd();
  addGlobalOperation('income', amount, desc || 'Доход');
  clearInputs('income-amount', 'income-desc');
  showNotification(`+${fmt(amount)}$ — Доход`, 'success');
  renderDashboard();
  checkGoal();
}

function handleAddExpense(): void {
  const amount = parseFloat(getInputVal('expense-amount'));
  if (isNaN(amount) || amount <= 0) { showNotification('Введите корректную сумму', 'error'); return; }
  const desc = getInputVal('expense-desc');
  soundManager.playAdd();
  addGlobalOperation('expense', amount, desc || 'Трата');
  clearInputs('expense-amount', 'expense-desc');
  showNotification(`-${fmt(amount)}$ — Трата`, 'info');
  renderDashboard();
}

function handleAddRent(): void {
  const price = parseFloat(getInputVal('rent-price'));
  const hours = parseFloat(getInputVal('rent-hours'));
  if (isNaN(price) || price <= 0 || isNaN(hours) || hours <= 0) {
    showNotification('Введите цену и часы', 'error'); return;
  }
  const total = price * hours;
  soundManager.playAdd();
  addGlobalOperation('rent', total, `Аренда: ${fmt(price)}$/ч × ${hours}ч`);
  clearInputs('rent-price', 'rent-hours');
  showNotification(`+${fmt(total)}$ — Аренда`, 'success');
  renderDashboard();
  checkGoal();
}

function handleAddWheels(): void {
  const amount = parseFloat(getInputVal('wheels-amount'));
  const mode = getAppState().wheelsMode;
  if (isNaN(amount) || amount <= 0) { showNotification('Введите корректное значение', 'error'); return; }
  const finalAmt = mode === 'chips' ? amount * 95 : amount;
  const desc = mode === 'chips' ? `Фишки: ${fmt(amount)} × 95` : `Деньги: ${fmt(amount)}$`;
  soundManager.playAdd();
  addGlobalOperation('wheels', amount, desc, mode);
  clearInputs('wheels-amount');
  const resEl = document.getElementById('wheels-result');
  if (resEl) resEl.textContent = '= 0$';
  showNotification(`+${fmt(finalAmt)}$ — Колёса`, 'success');
  renderDashboard();
  checkGoal();
}

function handleAddBonds(): void {
  const n = parseFloat(getInputVal('bonds-amount'));
  if (isNaN(n) || n <= 0) { showNotification('Введите количество векселей', 'error'); return; }
  soundManager.playAdd();
  addGlobalOperation('bonds', n, `Вексели: ${fmt(n)} × 1000`);
  clearInputs('bonds-amount');
  const res = document.getElementById('bonds-result');
  if (res) res.textContent = '= 0$';
  showNotification(`+${fmt(n * 1000)}$ — Вексели`, 'success');
  renderDashboard();
  checkGoal();
}

function updateWheelsPreview(): void {
  const mode = getAppState().wheelsMode;
  if (mode !== 'chips') return;
  const n = parseFloat((document.getElementById('wheels-amount') as HTMLInputElement)?.value) || 0;
  const res = document.getElementById('wheels-result');
  if (res) res.textContent = `= ${fmt(n * 95)}$`;
}

// ── Проверка цели ─────────────────────────────────────────────

function checkGoal(): void {
  const st = getAppState();
  if (st.savingsGoal > 0 && st.currentBalance >= st.savingsGoal && !st.goalAchievedFlag) {
    patchAppState({ goalAchievedFlag: true });
    soundManager.playSuccess();
    showGoalModal(st.goalDescription, st.savingsGoal);
  } else if (st.currentBalance < st.savingsGoal) {
    patchAppState({ goalAchievedFlag: false });
  }
}

function showGoalModal(desc: string, goal: number): void {
  const m = document.getElementById('goal-modal');
  const d = document.getElementById('goal-modal-desc');
  const a = document.getElementById('goal-modal-amount');
  if (d) d.textContent = desc || 'Цель достигнута!';
  if (a) a.textContent = `${fmt(goal)}$`;
  openModal('goal-modal');
  setTimeout(() => closeModal('goal-modal'), 6000);
}
