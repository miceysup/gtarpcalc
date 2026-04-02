// ============================================================
// МОДУЛЬ УВЕДОМЛЕНИЙ И УТИЛИТ РЕНДЕРИНГА (render.ts)
// ============================================================

// ── Рябь-эффект (ripple) ─────────────────────────────────────

export function createRipple(e: MouseEvent, el: HTMLElement): void {
  const ripple = document.createElement('span');
  ripple.className = 'ripple-effect';
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.cssText = `
    width:${size}px; height:${size}px;
    left:${e.clientX - rect.left - size / 2}px;
    top:${e.clientY - rect.top - size / 2}px;
  `;
  el.style.position = 'relative';
  el.style.overflow = 'hidden';
  el.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

// ── Тост-уведомления ─────────────────────────────────────────

export type NotifType = 'success' | 'error' | 'info' | 'warning';

export function showNotification(msg: string, type: NotifType = 'info'): void {
  const container = document.getElementById('notif-container') ?? createNotifContainer();
  const el = document.createElement('div');
  el.className = `notif notif-${type}`;

  const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : 'ℹ';
  el.innerHTML = `<span class="notif-icon">${icon}</span><span class="notif-msg">${msg}</span>`;

  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('notif-visible'));

  setTimeout(() => {
    el.classList.remove('notif-visible');
    el.classList.add('notif-hiding');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 3500);
}

function createNotifContainer(): HTMLElement {
  const c = document.createElement('div');
  c.id = 'notif-container';
  document.body.appendChild(c);
  return c;
}

// ── Форматирование ───────────────────────────────────────────

export function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n);
}

export function fmtSigned(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${fmt(n)}$`;
}

export function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ── Пустой экран ─────────────────────────────────────────────

export function emptyState(icon: string, title: string, sub: string): string {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <p class="empty-title">${title}</p>
      <p class="empty-sub">${sub}</p>
    </div>
  `;
}

// ── Segment Control (macOS-style) ────────────────────────────

export function buildSegmentedControl(
  containerId: string,
  options: { value: string; label: string }[],
  active: string,
  onChange: (value: string) => void
): void {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.className = 'segmented-control';
  el.innerHTML = options.map(opt => `
    <button
      class="seg-btn ${opt.value === active ? 'seg-active' : ''}"
      data-seg-value="${opt.value}"
    >${opt.label}</button>
  `).join('');

  el.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      createRipple(e as MouseEvent, btn);
      el.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('seg-active'));
      btn.classList.add('seg-active');
      onChange(btn.dataset.segValue!);
    });
  });
}

// ── Анимация появления баланса ───────────────────────────────

export function animateNumber(el: HTMLElement, from: number, to: number, duration = 400): void {
  const start = performance.now();
  const diff = to - from;

  function step(now: number) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const val = from + diff * ease;
    el.textContent = `${fmt(Math.round(val))}$`;
    if (t < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

// ── Модальные окна ───────────────────────────────────────────

export function openModal(id: string): void {
  const m = document.getElementById(id);
  if (!m) return;
  m.style.display = 'flex';
  requestAnimationFrame(() => m.classList.add('modal-open'));
}

export function closeModal(id: string): void {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('modal-open');
  m.addEventListener('transitionend', () => { m.style.display = 'none'; }, { once: true });
}
