// functions/office-destinations.js
//
// Makes every ".nav-combo" "Navigate to" field a searchable dropdown.
//  - Options come live from the Firestore `offices` collection (onSnapshot),
//    so offices added/renamed/deleted later appear automatically.
//  - Typing filters the list (every typed word must match, any order).
//  - Free text is still allowed (the field is optional and may be a room).
//  - Uses event delegation, so it also works for steps added dynamically
//    (add_service.html addStep) and re-rendered (edit_service.html renderSteps).
//
// Expected markup (see instructions):
//   <div class="combo-box nav-combo">
//     <input type="text" class="step-navigate-input" ... />
//     <button type="button" class="btn-drop nav-drop">▼</button>
//     <div class="combo-menu nav-combo-menu"></div>
//   </div>

import { auth, db } from '../Firebase/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let officeNames = [];
let officesReady = false;
let unsubscribe = null;

// Small style additions so we don't have to touch your CSS files.
const style = document.createElement('style');
style.textContent = `
  .nav-combo-menu { max-height: 220px; overflow-y: auto; }
  .nav-combo-menu .combo-item.nav-active { background: #eef3ff; }
  .nav-combo-menu .combo-empty { cursor: default; color: #888; font-style: italic; }
`;
document.head.appendChild(style);

const norm = (s) => (s || '').trim().toLowerCase();
const comboOf = (el) => el.closest('.nav-combo');
const inputOf = (combo) => combo.querySelector('.step-navigate-input');
const menuOf = (combo) => combo.querySelector('.nav-combo-menu');
const isNavInput = (el) => el && el.classList && el.classList.contains('step-navigate-input');

function addMessage(menu, text) {
  const div = document.createElement('div');
  div.className = 'combo-item combo-empty';
  div.textContent = text; // textContent = safe against odd characters in office names
  menu.appendChild(div);
}

function renderMenu(combo, showAll = false) {
  const input = inputOf(combo);
  const menu = menuOf(combo);
  const q = norm(input.value);
  const words = q.split(/\s+/).filter(Boolean);
  const exact = officeNames.some((n) => norm(n) === q);

  // If the box is empty, or already holds an exact office, show everything.
  const list = (showAll || !q || exact)
    ? officeNames
    : officeNames.filter((n) => words.every((w) => norm(n).includes(w)));

  menu.innerHTML = '';

  if (!officesReady) { addMessage(menu, 'Loading offices...'); return; }
  if (!officeNames.length) { addMessage(menu, 'No offices found. You can still type a destination.'); return; }
  if (!list.length) { addMessage(menu, 'No matching office. What you typed will be used as-is.'); return; }

  list.forEach((name) => {
    const div = document.createElement('div');
    div.className = 'combo-item nav-combo-item';
    div.textContent = name;
    menu.appendChild(div);
  });
}

function openMenu(combo, showAll = false) {
  const menu = menuOf(combo);
  document.querySelectorAll('.combo-menu.show').forEach((m) => { if (m !== menu) m.classList.remove('show'); });
  renderMenu(combo, showAll);
  menu.classList.add('show');
}

function closeMenu(combo) {
  menuOf(combo).classList.remove('show');
}

function choose(combo, name) {
  const input = inputOf(combo);
  input.value = name;
  // Lets edit_service.html's own "input" listener save the value into its state.
  input.dispatchEvent(new Event('input', { bubbles: true }));
  closeMenu(combo); // must come after the dispatch (the input handler opens the menu)
}

// ---- Events (delegated) ----
document.addEventListener('input', (e) => {
  if (!isNavInput(e.target)) return;
  const combo = comboOf(e.target);
  if (combo) openMenu(combo);
});

document.addEventListener('focusin', (e) => {
  if (!isNavInput(e.target)) return;
  const combo = comboOf(e.target);
  if (combo) openMenu(combo);
});

document.addEventListener('click', (e) => {
  const item = e.target.closest('.nav-combo-item');
  if (item) {
    const combo = comboOf(item);
    if (combo) choose(combo, item.textContent);
    return;
  }

  const drop = e.target.closest('.nav-drop');
  if (drop) {
    const combo = comboOf(drop);
    if (!combo) return;
    if (menuOf(combo).classList.contains('show')) closeMenu(combo);
    else openMenu(combo, true);
    return;
  }

  if (isNavInput(e.target)) {
    const combo = comboOf(e.target);
    if (combo) openMenu(combo);
    return;
  }

  // Click anywhere else closes any open "Navigate to" menu.
  if (!e.target.closest('.nav-combo')) {
    document.querySelectorAll('.nav-combo-menu.show').forEach((m) => m.classList.remove('show'));
  }
});

document.addEventListener('keydown', (e) => {
  if (!isNavInput(e.target)) return;
  const combo = comboOf(e.target);
  if (!combo) return;

  const menu = menuOf(combo);
  const open = menu.classList.contains('show');
  const items = [...menu.querySelectorAll('.nav-combo-item')];
  let idx = items.findIndex((i) => i.classList.contains('nav-active'));

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!open) { openMenu(combo, true); return; }
    if (!items.length) return;
    idx = e.key === 'ArrowDown'
      ? (idx + 1) % items.length
      : (idx - 1 + items.length) % items.length;
    items.forEach((el, n) => el.classList.toggle('nav-active', n === idx));
    items[idx].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    if (open && idx >= 0) {
      e.preventDefault();
      choose(combo, items[idx].textContent);
    }
  } else if (e.key === 'Escape') {
    closeMenu(combo);
  }
});

// ---- Live office list ----
onAuthStateChanged(auth, (user) => {
  if (!user || unsubscribe) return;

  unsubscribe = onSnapshot(
    collection(db, 'offices'),
    (snap) => {
      const names = snap.docs
        .map((d) => String(d.data().office_name || d.id).trim())
        .filter(Boolean);
      officeNames = [...new Set(names)].sort((a, b) => a.localeCompare(b));
      officesReady = true;

      // If a menu is open right now, refresh it with the new list.
      document.querySelectorAll('.nav-combo-menu.show').forEach((m) => {
        const combo = comboOf(m);
        if (combo) renderMenu(combo);
      });
    },
    (err) => {
      console.error('[office-destinations] could not load offices:', err);
      officeNames = [];
      officesReady = true;
    }
  );
});