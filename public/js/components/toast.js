// Centered message dialogs + bottom snackbar.
//
//   await toast.success('Saved', 'Your changes were saved.');
//   toast.loading('Saving...', 'Please wait.');   toast.close();
//   if (await confirm({ title: 'Sign out?', msg: '...', confirmText: 'Sign Out' })) { ... }
//   if (await promptMatch({ title: 'Delete forever?', expected: name })) { ... }
//   snackbar('Office moved', { actionText: 'Undo', onAction: undo });

let overlay = null;
let resolveCurrent = null;
let lastFocus = null;

function ensure() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.className = 'toast-overlay';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'toast-title');
  overlay.innerHTML = `
    <div class="toast-box">
      <div class="toast-icon"></div>
      <div class="toast-title" id="toast-title"></div>
      <div class="toast-msg"></div>
      <input class="toast-input" type="text" autocomplete="off" hidden />
      <div class="toast-actions">
        <button class="toast-btn toast-btn-secondary" data-toast="cancel" type="button">Cancel</button>
        <button class="toast-btn" data-toast="ok" type="button">Continue</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('[data-toast="ok"]').addEventListener('click', () => finish(true));
  overlay.querySelector('[data-toast="cancel"]').addEventListener('click', () => finish(false));
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.dataset.kind !== 'loading') finish(false);
    if (e.key === 'Enter' && e.target.classList.contains('toast-input')) {
      const ok = overlay.querySelector('[data-toast="ok"]');
      if (!ok.disabled) finish(true);
    }
  });
  return overlay;
}

function finish(result) {
  if (!overlay || !overlay.classList.contains('show')) return;
  overlay.classList.remove('show');
  const resolve = resolveCurrent;
  resolveCurrent = null;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  if (resolve) resolve(result);
}

function open({ kind, type, title, msg, okText, cancelText, input }) {
  const el = ensure();
  // A dialog replacing another one resolves the previous one as "closed"
  if (resolveCurrent) {
    const previous = resolveCurrent;
    resolveCurrent = null;
    previous(false);
  }
  lastFocus = document.activeElement;
  el.dataset.kind = kind;

  const icon = el.querySelector('.toast-icon');
  icon.className = 'toast-icon ' + type;
  icon.innerHTML = type === 'loading' ? '<div class="toast-loading-spinner"></div>' : '';
  el.querySelector('.toast-title').textContent = title || '';
  el.querySelector('.toast-msg').textContent = msg || '';

  const ok = el.querySelector('[data-toast="ok"]');
  const cancel = el.querySelector('[data-toast="cancel"]');
  const field = el.querySelector('.toast-input');
  ok.textContent = okText || 'Continue';
  ok.hidden = kind === 'loading';
  ok.disabled = false;
  cancel.textContent = cancelText || 'Cancel';
  cancel.hidden = kind === 'alert' || kind === 'loading';

  field.hidden = !input;
  field.value = '';
  if (input) {
    field.placeholder = input.placeholder || '';
    ok.disabled = true;
    field.oninput = () => { ok.disabled = field.value.trim() !== input.expected; };
  }

  el.classList.add('show');
  requestAnimationFrame(() => (input ? field : (ok.hidden ? null : ok))?.focus());
  return new Promise((resolve) => { resolveCurrent = resolve; });
}

function alertOf(type) {
  return (title, msg, { button = 'Continue' } = {}) => open({ kind: 'alert', type, title, msg, okText: button });
}

export const toast = {
  success: alertOf('success'),
  error: alertOf('error'),
  warning: alertOf('warning'),
  info: alertOf('info'),
  loading: (title, msg) => { open({ kind: 'loading', type: 'loading', title, msg }); },
  close: () => finish(false)
};

// Resolves true when confirmed, false when cancelled.
export function confirm({ type = 'warning', title, msg, confirmText = 'Confirm', cancelText = 'Cancel' }) {
  return open({ kind: 'confirm', type, title, msg, okText: confirmText, cancelText });
}

// Second verification step: the confirm button unlocks only when the typed text matches `expected`.
export function promptMatch({ type = 'error', title, msg, expected, placeholder = 'Type the name to confirm', confirmText = 'Delete', cancelText = 'Cancel' }) {
  return open({ kind: 'confirm', type, title, msg, okText: confirmText, cancelText, input: { expected: String(expected).trim(), placeholder } });
}

let snack = null;
let snackTimer = null;

export function snackbar(message, { actionText = '', onAction = null, timeout = 6000 } = {}) {
  if (!snack) {
    snack = document.createElement('div');
    snack.className = 'snackbar';
    snack.setAttribute('role', 'status');
    document.body.appendChild(snack);
  }
  snack.innerHTML = '<span></span>';
  snack.firstChild.textContent = message;
  if (actionText && onAction) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = actionText;
    btn.addEventListener('click', () => {
      snack.classList.remove('show');
      onAction();
    });
    snack.appendChild(btn);
  }
  clearTimeout(snackTimer);
  requestAnimationFrame(() => snack.classList.add('show'));
  snackTimer = setTimeout(() => snack.classList.remove('show'), timeout);
}
