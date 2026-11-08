import { auth, db } from '../Firebase/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Only offices on the first floor can be picked as a navigation destination.
const FLOOR_FIELD = 'floor';

// Matches "first_floor" (what Firestore stores). Also tolerates "1", "1st floor", "ground floor".
function isFirstFloor(value) {
  if (value === undefined || value === null) return false;
  const v = String(value).trim().toLowerCase().replace(/[_-]+/g, ' ');
  return /^(1|1st|first|ground|g)(\s*(floor|flr|fl))?$/.test(v);
}

let officeNames = [];
let officesReady = false;
let unsubscribe = null;

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

  const list = (showAll || !q || exact)
    ? officeNames
    : officeNames.filter((n) => words.every((w) => norm(n).includes(w)));

  menu.innerHTML = '';

  if (!officesReady) { addMessage(menu, 'Loading offices...'); return; }
  if (!officeNames.length) { addMessage(menu, 'No first-floor offices found.'); return; }
  if (!list.length) { addMessage(menu, 'No matching destination. Please pick one from the list.'); return; }

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
  input.dispatchEvent(new Event('input', { bubbles: true }));
  closeMenu(combo); // must come after the dispatch (the input handler opens the menu)
}

// A typed value only counts if it matches a listed destination (case-insensitive)
function matchDestination(value) {
  const q = norm(value);
  return officeNames.find((n) => norm(n) === q) || null;
}

function markInvalid(input, bad) {
  input.style.borderColor = bad ? 'red' : '';
  if (input.parentElement) input.parentElement.style.borderColor = bad ? 'red' : '';
}

// Used by the Edit page (data lives in memory, not only in the DOM).
// Empty is fine (the field is optional); anything else must be a listed destination.
window.isValidNavigateTo = function (value) {
  const v = String(value || '').trim();
  if (!v) return true;
  return officesReady && !!matchDestination(v);
};

// Used by the Add page: checks every "Navigate to" box, marks the bad ones red,
// switches to the tab / opens the step that has the first bad one.
window.validateNavigateInputs = function (scope = document) {
  let firstBad = null;
  scope.querySelectorAll('.step-navigate-input').forEach((input) => {
    const v = input.value.trim();
    const match = v ? matchDestination(v) : null;
    const ok = !v || (officesReady && !!match);
    markInvalid(input, !ok);
    if (ok && match && match !== input.value) input.value = match; // use the exact listed spelling
    if (!ok && !firstBad) firstBad = input;
  });

  if (firstBad) {
    const pane = firstBad.closest('.tab-pane');
    if (pane && !pane.classList.contains('active')) {
      const idx = [...document.querySelectorAll('.tab-pane')].indexOf(pane);
      const tabBtn = document.querySelectorAll('.tab-btn')[idx];
      if (tabBtn) tabBtn.click();
    }
    const card = firstBad.closest('.step-card');
    if (card) card.classList.add('open');
    firstBad.scrollIntoView({ block: 'center' });
  }
  return !firstBad;
};

// Events (delegated)
document.addEventListener('input', (e) => {
  if (!isNavInput(e.target)) return;
  markInvalid(e.target, false); // clear the red mark while the user is typing
  const combo = comboOf(e.target);
  if (combo) openMenu(combo);
});

// When the user leaves the box with text that is not a listed destination, mark it red
document.addEventListener('focusout', (e) => {
  if (!isNavInput(e.target)) return;
  const input = e.target;
  setTimeout(() => {
    const v = input.value.trim();
    if (!v || !officesReady) { markInvalid(input, false); return; }
    markInvalid(input, !matchDestination(v));
  }, 200); // wait, so clicking a dropdown item is handled first
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

// Live list of first-floor offices (`offices`) and rooms (`other_room`)
let unsubscribeRooms = null;
let officeList = [];
let roomList = [];

const nameOf = (d) => {
  const data = d.data();
  return String(data.office_name || data.room_name || data.name || d.id).trim();
};

function rebuildNames() {
  const names = [...officeList, ...roomList].filter(Boolean);
  officeNames = [...new Set(names)].sort((a, b) => a.localeCompare(b));
  officesReady = true;

  document.querySelectorAll('.nav-combo-menu.show').forEach((m) => {
    const combo = comboOf(m);
    if (combo) renderMenu(combo);
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user || unsubscribe) return;

  unsubscribe = onSnapshot(
    collection(db, 'offices'),
    (snap) => {
      officeList = snap.docs
        .filter((d) => isFirstFloor(d.data()[FLOOR_FIELD]))
        .map(nameOf);
      rebuildNames();
    },
    (err) => {
      console.error('[office-destinations] could not load offices:', err);
      officeList = [];
      rebuildNames();
    }
  );

  unsubscribeRooms = onSnapshot(
    collection(db, 'other_room'),
    (snap) => {
      roomList = snap.docs
        .filter((d) => isFirstFloor(d.data()[FLOOR_FIELD]))
        .map(nameOf);
      rebuildNames();
    },
    (err) => {
      console.error('[office-destinations] could not load rooms:', err);
      roomList = [];
      rebuildNames();
    }
  );
});