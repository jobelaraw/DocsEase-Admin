// functions/admin-agreement.js
//
// Terms & Conditions / Privacy Policy agreement for the web admin sign-up.
// Same flow as the mobile app:
//   - Tapping the checkbox (when unchecked) opens the modal.
//   - "I Agree"  -> box becomes checked.
//   - "Not now"  -> box becomes unchecked.
//   - Clicking outside the dialog or pressing Esc -> no change.
//   - Unchecking never opens the modal.
//   - The blue links open the modal on that tab.
//
// Exposes window.AdminAgreement = { version, isAgreed(), open(tab), reset() }
// and fires a document-level "agreement-change" event whenever the state changes.

import { ADMIN_LEGAL as L } from './admin_legal_content.js';

let agreed = false;
let overlay = null;
let docEl = null;
let tabButtons = [];
let pendingResolve = null;
let lastFocus = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContent = no HTML injection
  return node;
}

function syncCheckbox() {
  const cb = document.getElementById('agr-checkbox');
  if (cb) cb.setAttribute('aria-checked', String(agreed));
}

function setAgreed(value) {
  if (agreed === value) return;
  agreed = value;
  syncCheckbox();
  document.dispatchEvent(new CustomEvent('agreement-change', { detail: { agreed } }));
}

function renderDoc(index) {
  const isTerms = index === 0;
  const intro = isTerms ? L.termsIntro : L.privacyIntro;
  const sections = isTerms ? L.terms : L.privacy;

  docEl.replaceChildren();
  docEl.append(el('p', 'agr-intro', intro));

  sections.forEach((section, n) => {
    const wrap = el('div', 'agr-sec');
    const head = el('div', 'agr-sec-head');
    head.append(el('span', 'agr-num', String(n + 1)), el('h4', 'agr-sec-title', section.heading));
    wrap.append(head, el('p', 'agr-sec-body', section.body));
    docEl.append(wrap);
  });

  docEl.append(el('p', 'agr-version', `Version ${L.version} · Effective ${L.effectiveDate}`));
  docEl.scrollTop = 0;
}

function selectTab(index) {
  tabButtons.forEach((btn, i) => btn.setAttribute('aria-selected', String(i === index)));
  renderDoc(index);
}

function buildModal() {
  overlay = document.createElement('div');
  overlay.className = 'agr-overlay';
  overlay.innerHTML = `
    <div class="agr-dialog" role="dialog" aria-modal="true" aria-label="Terms and Privacy">
      <div class="agr-tabs-wrap">
        <div class="agr-tabs" role="tablist">
          <button type="button" class="agr-tab" role="tab" aria-selected="true">Terms &amp; Conditions</button>
          <button type="button" class="agr-tab" role="tab" aria-selected="false">Privacy Policy</button>
        </div>
      </div>
      <div class="agr-doc" tabindex="0"></div>
      <div class="agr-footer">
        <p class="agr-consent">By clicking "I Agree", you confirm that you have read and accept both the Terms &amp; Conditions and the Privacy Policy.</p>
        <button type="button" class="agr-btn-agree">I Agree</button>
        <button type="button" class="agr-btn-decline">Not now</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  docEl = overlay.querySelector('.agr-doc');
  tabButtons = [...overlay.querySelectorAll('.agr-tab')];
  tabButtons.forEach((btn, i) => btn.addEventListener('click', () => selectTab(i)));

  overlay.querySelector('.agr-btn-agree').addEventListener('click', () => close(true));
  overlay.querySelector('.agr-btn-decline').addEventListener('click', () => close(false));

  // Click on the dark backdrop = dismiss without changing anything.
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close(null);
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close(null);
      return;
    }
    if (e.key !== 'Tab') return;

    // Keep keyboard focus inside the dialog.
    const focusable = [...overlay.querySelectorAll('button, [tabindex="0"]')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

/** Opens the modal. Resolves true only if the user clicked "I Agree". */
function open(tab = 'terms') {
  if (pendingResolve) return Promise.resolve(false); // already open
  if (!overlay) buildModal();

  lastFocus = document.activeElement;
  selectTab(tab === 'privacy' ? 1 : 0);
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  overlay.querySelector('.agr-btn-agree').focus();

  return new Promise((resolve) => {
    pendingResolve = resolve;
  });
}

/** result: true = I Agree, false = Not now, null = dismissed (no change) */
function close(result) {
  if (!overlay) return;
  overlay.classList.remove('show');
  document.body.style.overflow = '';

  if (result === true) setAgreed(true);
  else if (result === false) setAgreed(false);

  if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();

  const resolve = pendingResolve;
  pendingResolve = null;
  if (resolve) resolve(result === true);
}

function init() {
  const checkbox = document.getElementById('agr-checkbox');
  if (checkbox) {
    checkbox.addEventListener('click', () => {
      if (agreed) setAgreed(false); // unchecking never opens the modal
      else open('terms');
    });
  }

  document.querySelectorAll('[data-agr-tab]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      open(link.dataset.agrTab);
    });
  });

  syncCheckbox();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.AdminAgreement = {
  version: L.version,
  isAgreed: () => agreed,
  open,
  reset: () => setAgreed(false),
};