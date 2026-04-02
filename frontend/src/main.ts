// ============================================================
// ТОЧКА ВХОДА — main.ts
// GTA RP Финансы v3.0 | Wails Desktop App
// ============================================================

import './app.css';

// Модули состояния и хранилища
import {
  getAppState, getShiftState, getVitoState,
  subscribe, patchAppState, hydrateState,
  shouldShowReminder, markReminderShown,
} from './modules/state';
import {
  loadAppState, loadShiftState, loadVitoState,
  saveAppState, saveShiftState, saveVitoState,
  saveTheme, loadTheme,
} from './modules/storage';

// Модули вкладок
import { renderDashboard, setupDashboardEvents } from './modules/dashboard';
import { renderStatistics, setupStatisticsEvents } from './modules/statistics';
import { renderShift, setupShiftEvents } from './modules/shift';
import { renderInsights } from './modules/insights';
import { renderVito, setupVitoEvents } from './modules/vito';

// Вспомогательные модули
import { soundManager } from './modules/sounds';
import { showNotification, openModal, closeModal } from './modules/render';

import { TabId } from './types';

// ──────────────────────────────────────────────────────────────
// 1. ИНИЦИАЛИЗАЦИЯ
// ──────────────────────────────────────────────────────────────

async function initApp(): Promise<void> {
  console.log('🚀 GTA RP Финансы v3.0 запуск...');

  // Загрузка данных из localStorage
  const savedApp   = loadAppState();
  const savedShift = loadShiftState();
  const savedVito  = loadVitoState();
  hydrateState(savedApp, savedShift, savedVito);

  // Восстанавливаем тему
  const theme = loadTheme();
  applyTheme(theme);

  // Настраиваем обработчики навигации
  setupNavigation();

  // Настраиваем глобальные события
  setupGlobalEvents();

  // Настраиваем события вкладок
  setupDashboardEvents();
  setupStatisticsEvents();
  setupShiftEvents();
  setupVitoEvents();

  // Подписываемся на изменения состояния для автосохранения
  subscribe(() => {
    const app   = getAppState();
    const shift = getShiftState();
    const vito  = getVitoState();
    saveAppState(app);
    saveShiftState(shift);
    saveVitoState(vito);
  });

  // Первоначальный рендер
  const activeTab = savedApp.activeTab ?? 'dashboard';
  switchTab(activeTab);

  // Проверяем напоминание
  startReminderTimer();

  console.log('✅ Приложение инициализировано');
}

// ──────────────────────────────────────────────────────────────
// 2. НАВИГАЦИЯ (Bottom Navigation Bar)
// ──────────────────────────────────────────────────────────────

const TAB_RENDER: Record<TabId, () => void> = {
  dashboard:  renderDashboard,
  statistics: renderStatistics,
  shift:      renderShift,
  insights:   renderInsights,
  vito:       renderVito,
};

function switchTab(tabId: TabId): void {
  // Скрываем все страницы
  document.querySelectorAll<HTMLElement>('.tab-page').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('tab-active');
  });

  // Показываем нужную страницу
  const page = document.getElementById(`page-${tabId}`);
  if (page) {
    page.style.display = 'flex';
    requestAnimationFrame(() => page.classList.add('tab-active'));
  }

  // Обновляем навигационные кнопки
  document.querySelectorAll<HTMLElement>('.nav-btn').forEach(btn => {
    btn.classList.toggle('nav-active', btn.dataset.tab === tabId);
  });

  // Сохраняем активную вкладку
  patchAppState({ activeTab: tabId });

  // Рендерим нужный контент
  const renderFn = TAB_RENDER[tabId];
  if (renderFn) renderFn();
}

function setupNavigation(): void {
  document.querySelectorAll<HTMLButtonElement>('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab as TabId;
      if (tab) {
        soundManager.playClick();
        switchTab(tab);
      }
    });
  });
}

// ──────────────────────────────────────────────────────────────
// 3. ГЛОБАЛЬНЫЕ СОБЫТИЯ
// ──────────────────────────────────────────────────────────────

function setupGlobalEvents(): void {
  // Переключатель звуков (в шапке)
  document.getElementById('btn-sound-toggle')?.addEventListener('click', () => {
    const enabled = soundManager.toggle();
    patchAppState({ soundEnabled: enabled });
    const btn = document.getElementById('btn-sound-toggle');
    if (btn) btn.textContent = enabled ? '🔊' : '🔇';
    showNotification(enabled ? 'Звуки включены' : 'Звуки выключены', 'info');
  });

  // Переключатель темы
  document.querySelectorAll<HTMLButtonElement>('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme!;
      applyTheme(theme);
      saveTheme(theme);
      patchAppState({ theme: theme as any });
      showNotification(`Тема изменена`, 'info');
    });
  });

  // Клавиатура
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      // Закрыть модальные окна
      ['settings-modal', 'goal-modal', 'day-detail-modal', 'reminder-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m && m.style.display !== 'none') closeModal(id);
      });
    }
  });

  // Кнопка закрытия модала цели
  document.getElementById('btn-close-goal')?.addEventListener('click', () => closeModal('goal-modal'));
  document.getElementById('goal-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('goal-modal');
  });

  // Напоминание
  document.getElementById('btn-reminder-ok')?.addEventListener('click', () => {
    markReminderShown();
    closeModal('reminder-modal');
  });
}

// ──────────────────────────────────────────────────────────────
// 4. ТЕМЫ
// ──────────────────────────────────────────────────────────────

function applyTheme(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll<HTMLElement>('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

// ──────────────────────────────────────────────────────────────
// 5. НАПОМИНАНИЕ (23:57)
// ──────────────────────────────────────────────────────────────

function startReminderTimer(): void {
  const check = () => {
    const now = new Date();
    if (now.getHours() === 23 && now.getMinutes() === 57 && shouldShowReminder()) {
      markReminderShown();
      openModal('reminder-modal');
    }
  };
  check();
  setInterval(check, 60_000);
}

// ──────────────────────────────────────────────────────────────
// 6. СТАРТ
// ──────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Для отладки в консоли
(window as any).__app = { getAppState, getShiftState, getVitoState };
