(function () {
  let toastCallback = null;
  let cancelToastCallback = null;

  function ensureToastExists() {
    if (document.getElementById('toast-overlay')) {
      const btn = document.getElementById('toast-btn');
      const cancelBtn = document.getElementById('toast-cancel-btn');

      if (btn && !btn.dataset.toastBound) {
        btn.addEventListener('click', closeToast);
        btn.dataset.toastBound = 'true';
      }
      if (cancelBtn && !cancelBtn.dataset.toastBound) {
        cancelBtn.addEventListener('click', closeCancelToast);
        cancelBtn.dataset.toastBound = 'true';
      }
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'toast-overlay';
    overlay.id = 'toast-overlay';
    overlay.innerHTML = `
      <div class="toast-box">
        <div class="toast-icon" id="toast-icon"></div>
        <div class="toast-title" id="toast-title"></div>
        <div class="toast-msg" id="toast-msg"></div>
        <div class="toast-actions">
          <button class="toast-btn toast-btn-secondary" id="toast-cancel-btn" type="button">Cancel</button>
          <button class="toast-btn" id="toast-btn" type="button">Continue</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const btn = document.getElementById('toast-btn');
    const cancelBtn = document.getElementById('toast-cancel-btn');
    if (btn) {
      btn.addEventListener('click', closeToast);
      btn.dataset.toastBound = 'true';
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeCancelToast);
      cancelBtn.dataset.toastBound = 'true';
    }
  }

  function showToast(type, title, msg, btnText, callback) {
    ensureToastExists();

    const overlay = document.getElementById('toast-overlay');
    const icon = document.getElementById('toast-icon');
    const titleEl = document.getElementById('toast-title');
    const msgEl = document.getElementById('toast-msg');
    const btn = document.getElementById('toast-btn');
    const cancelBtn = document.getElementById('toast-cancel-btn');

    icon.className = 'toast-icon ' + type;
    icon.innerHTML = type === 'loading' ? '<div class="toast-loading-spinner"></div>' : '';
    titleEl.textContent = title;
    msgEl.textContent = msg;
    btn.innerHTML = btnText || 'Continue';
    btn.disabled = type === 'loading';
    btn.style.display = btnText === '' ? 'none' : 'block';
    cancelBtn.style.display = 'none';

    toastCallback = callback || null;
    cancelToastCallback = null;
    overlay.classList.add('show');
  }

  function showConfirmToast({ type = 'info', title, msg, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel }) {
    ensureToastExists();

    const overlay = document.getElementById('toast-overlay');
    const icon = document.getElementById('toast-icon');
    const titleEl = document.getElementById('toast-title');
    const msgEl = document.getElementById('toast-msg');
    const btn = document.getElementById('toast-btn');
    const cancelBtn = document.getElementById('toast-cancel-btn');

    icon.className = 'toast-icon ' + type;
    icon.innerHTML = type === 'loading' ? '<div class="toast-loading-spinner"></div>' : '';
    titleEl.textContent = title;
    msgEl.textContent = msg;

    btn.innerHTML = confirmText;
    btn.disabled = false;
    btn.style.display = 'block';

    cancelBtn.textContent = cancelText;
    cancelBtn.style.display = 'block';

    toastCallback = onConfirm || null;
    cancelToastCallback = onCancel || null;
    overlay.classList.add('show');
  }

  function closeToast() {
    ensureToastExists();

    const overlay = document.getElementById('toast-overlay');
    overlay.classList.remove('show');

    if (toastCallback) {
      const cb = toastCallback;
      toastCallback = null;
      cancelToastCallback = null;
      cb();
    }
  }

  function closeCancelToast() {
    ensureToastExists();

    const overlay = document.getElementById('toast-overlay');
    overlay.classList.remove('show');

    if (cancelToastCallback) {
      const cb = cancelToastCallback;
      cancelToastCallback = null;
      toastCallback = null;
      cb();
    }
  }

  window.showToast = showToast;
  window.showConfirmToast = showConfirmToast;
  window.closeToast = closeToast;
  window.closeCancelToast = closeCancelToast;
})();