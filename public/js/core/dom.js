// Safe HTML building and small DOM helpers.
//
//   render(list, html`<li data-id="${id}">${name}</li>`);
// Every ${value} is escaped, so names from the database can never inject markup.
// Wrap markup you built yourself with raw() (or nest html`` results) to keep it.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

class SafeHtml {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

export const raw = (markup) => new SafeHtml(String(markup));

function piece(value) {
  if (value == null || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(piece).join('');
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => {
    out += piece(value) + strings[i + 1];
  });
  return new SafeHtml(out);
}

// Replaces an element's content. Plain strings are inserted as text.
export function render(el, content) {
  if (!el) return;
  if (content instanceof SafeHtml) el.innerHTML = content.value;
  else el.textContent = content == null ? '' : String(content);
}

export const $ = (selector, rootEl = document) => rootEl.querySelector(selector);
export const $$ = (selector, rootEl = document) => Array.from(rootEl.querySelectorAll(selector));

// Event delegation: on(list, 'click', '[data-action="delete"]', (event, button) => ...)
export function on(rootEl, type, selector, handler) {
  rootEl.addEventListener(type, (event) => {
    const target = event.target.closest(selector);
    if (target && rootEl.contains(target)) handler(event, target);
  });
}

// Builds an element from html`` markup (first element).
export function toElement(content) {
  const template = document.createElement('template');
  template.innerHTML = content instanceof SafeHtml ? content.value : escapeHtml(content);
  return template.content.firstElementChild;
}

export function debounce(fn, wait = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

// Reveals content that fades in once its data is ready (.page-fade -> .is-ready).
export function reveal(el) {
  if (el) requestAnimationFrame(() => el.classList.add('is-ready'));
}

export function sameText(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}
