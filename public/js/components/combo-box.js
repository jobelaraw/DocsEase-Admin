// Text field with a suggestion dropdown.
//
//   html`${comboBox({ value, placeholder: 'e.g. Valid ID', items: ['Valid ID', ...] })}`
//   html`${comboBox({ source: 'destinations', strict: true })}`   // must pick a listed value
//
// Static suggestions come from `items`; live lists come from a named source
// registered with registerSource() (see office-picker.js). Typing filters the
// list, ▼ shows everything, arrow keys + Enter pick, Escape closes.
import { html } from '../core/dom.js';

const sources = new Map();
const norm = (s) => String(s || '').trim().toLowerCase();

// source = { items(): string[], ready(): boolean, emptyText?, loadingText? }
export function registerSource(name, source) {
  sources.set(name, source);
  refreshOpenMenus();
}

export function comboBox({ id = '', value = '', placeholder = '', items = [], source = '', strict = false, field = '', disabled = false, label = '' } = {}) {
  return html`
    <div class="combo-box" data-combo ${source ? html`data-source="${source}"` : ''} ${strict ? 'data-strict' : ''}>
      <input type="text" class="combo-input" ${id ? html`id="${id}"` : ''} ${field ? html`data-field="${field}"` : ''}
        value="${value || ''}" placeholder="${placeholder}" autocomplete="off" role="combobox"
        aria-autocomplete="list" aria-expanded="false" ${label ? html`aria-label="${label}"` : ''} ${disabled ? 'disabled' : ''} />
      <button type="button" class="combo-drop" tabindex="-1" aria-label="Show options" ${disabled ? 'disabled' : ''}>▼</button>
      <div class="combo-menu" role="listbox" hidden data-items="${JSON.stringify(items)}"></div>
    </div>`;
}

const comboOf = (el) => el && el.closest('[data-combo]');
const inputOf = (combo) => combo.querySelector('.combo-input');
const menuOf = (combo) => combo.querySelector('.combo-menu');

function itemsOf(combo) {
  const source = sources.get(combo.dataset.source);
  if (combo.dataset.source) return source ? source.items() : [];
  try { return JSON.parse(menuOf(combo).dataset.items || '[]'); } catch { return []; }
}

function message(menu, text) {
  const div = document.createElement('div');
  div.className = 'combo-empty';
  div.textContent = text;
  menu.appendChild(div);
}

function renderMenu(combo, showAll) {
  const menu = menuOf(combo);
  const q = norm(inputOf(combo).value);
  const all = itemsOf(combo);
  const exact = all.some((i) => norm(i) === q);
  const words = q.split(/\s+/).filter(Boolean);
  const list = showAll || !q || exact ? all : all.filter((i) => words.every((w) => norm(i).includes(w)));

  menu.replaceChildren();
  const source = sources.get(combo.dataset.source);
  if (combo.dataset.source && (!source || !source.ready())) return message(menu, (source && source.loadingText) || 'Loading...');
  if (!all.length) return message(menu, (source && source.emptyText) || 'No suggestions.');
  if (!list.length) return message(menu, combo.hasAttribute('data-strict') ? 'No match. Please pick one from the list.' : 'No suggestions.');
  list.forEach((text) => {
    const div = document.createElement('div');
    div.className = 'combo-item';
    div.setAttribute('role', 'option');
    div.textContent = text;
    menu.appendChild(div);
  });
}

function open(combo, showAll = false) {
  document.querySelectorAll('[data-combo] .combo-menu:not([hidden])').forEach((m) => {
    if (m !== menuOf(combo)) close(comboOf(m));
  });
  renderMenu(combo, showAll);
  menuOf(combo).hidden = false;
  inputOf(combo).setAttribute('aria-expanded', 'true');
}

function close(combo) {
  if (!combo) return;
  menuOf(combo).hidden = true;
  inputOf(combo).setAttribute('aria-expanded', 'false');
}

function choose(combo, text) {
  const input = inputOf(combo);
  input.value = text;
  combo.classList.remove('is-invalid');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  close(combo); // after the input event, which opens the menu while typing
}

export function refreshOpenMenus() {
  document.querySelectorAll('[data-combo] .combo-menu:not([hidden])').forEach((m) => renderMenu(comboOf(m), false));
}

// The listed spelling of a value, or null. For strict combos backed by a source.
export function matchItem(sourceName, value) {
  const source = sources.get(sourceName);
  if (!source) return null;
  const q = norm(value);
  return source.items().find((i) => norm(i) === q) || null;
}

export function markInvalid(combo, bad) {
  if (combo) combo.classList.toggle('is-invalid', !!bad);
}

// ---------- one set of document-level listeners for every combo box ----------
document.addEventListener('click', (e) => {
  const item = e.target.closest('[data-combo] .combo-item');
  if (item) return choose(comboOf(item), item.textContent);
  const drop = e.target.closest('[data-combo] .combo-drop');
  if (drop) {
    const combo = comboOf(drop);
    if (menuOf(combo).hidden) {
      open(combo, true);
      inputOf(combo).focus();
    } else close(combo);
    return;
  }
  if (!e.target.closest('[data-combo]')) {
    document.querySelectorAll('[data-combo] .combo-menu:not([hidden])').forEach((m) => close(comboOf(m)));
  }
});

document.addEventListener('input', (e) => {
  if (!e.target.classList.contains('combo-input')) return;
  const combo = comboOf(e.target);
  combo.classList.remove('is-invalid');
  if (document.activeElement === e.target) open(combo);
});

document.addEventListener('focusin', (e) => {
  if (!e.target.classList.contains('combo-input')) return;
  const combo = comboOf(e.target);
  if (combo.hasAttribute('data-strict')) open(combo);
});

document.addEventListener('focusout', (e) => {
  if (!e.target.classList.contains('combo-input')) return;
  const combo = comboOf(e.target);
  // Wait so a click on a menu item is handled first
  setTimeout(() => {
    if (combo.contains(document.activeElement)) return;
    close(combo);
    if (combo.hasAttribute('data-strict') && combo.dataset.source) {
      const value = inputOf(combo).value.trim();
      const source = sources.get(combo.dataset.source);
      markInvalid(combo, value && source && source.ready() && !matchItem(combo.dataset.source, value));
    }
  }, 200);
});

document.addEventListener('keydown', (e) => {
  if (!e.target.classList.contains('combo-input')) return;
  const combo = comboOf(e.target);
  const menu = menuOf(combo);
  const items = [...menu.querySelectorAll('.combo-item')];
  let idx = items.findIndex((i) => i.classList.contains('is-active'));

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (menu.hidden) return open(combo, true);
    if (!items.length) return;
    idx = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
    items.forEach((el, n) => el.classList.toggle('is-active', n === idx));
    items[idx].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && !menu.hidden && idx >= 0) {
    e.preventDefault();
    choose(combo, items[idx].textContent);
  } else if (e.key === 'Escape' && !menu.hidden) {
    e.stopPropagation();
    close(combo);
  }
});
