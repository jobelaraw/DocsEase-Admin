// Live office lists for combo boxes:
//   'offices'      -> every active office (choose the office of a new service)
//   'destinations' -> first-floor offices and rooms (a step's "Navigate to"; the
//                     mobile app can only guide citizens around the first floor)
// Call startOfficePicker() once on pages that use them.
import { watchOffices, watchRooms } from '../data/offices.js';
import { registerSource, refreshOpenMenus, matchItem } from './combo-box.js';

// Matches "first_floor" (what Firestore stores); also "1", "1st floor", "ground floor".
function isFirstFloor(value) {
  if (value === undefined || value === null) return false;
  const v = String(value).trim().toLowerCase().replace(/[_-]+/g, ' ');
  return /^(1|1st|first|ground|g)(\s*(floor|flr|fl))?$/.test(v);
}

let offices = [];
let rooms = [];
let officesReady = false;
let roomsReady = false;
let started = false;

const uniqueSorted = (names) => [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b));

export const destinationsReady = () => officesReady && roomsReady;

export function startOfficePicker() {
  if (started) return;
  started = true;

  registerSource('offices', {
    items: () => offices.map((o) => o.name),
    ready: () => officesReady,
    loadingText: 'Loading offices...',
    emptyText: 'No offices found.'
  });
  registerSource('destinations', {
    items: () => uniqueSorted([
      ...offices.filter((o) => isFirstFloor(o.floor)).map((o) => o.name),
      ...rooms.filter((r) => isFirstFloor(r.floor)).map((r) => r.name)
    ]),
    ready: destinationsReady,
    loadingText: 'Loading offices...',
    emptyText: 'No first-floor offices found.'
  });

  watchOffices((list) => {
    offices = list;
    officesReady = true;
    refreshOpenMenus();
  }, (error) => {
    console.error('[office-picker] could not load offices:', error);
    officesReady = true;
  });
  watchRooms((list) => {
    rooms = list;
    roomsReady = true;
    refreshOpenMenus();
  }, (error) => {
    console.error('[office-picker] could not load rooms:', error);
    roomsReady = true;
  });
}

// Empty is fine (optional field); otherwise it must be a listed destination.
// Returns the listed spelling so saved values always match an office name.
export function checkDestination(value) {
  const v = String(value || '').trim();
  if (!v) return { ok: true, value: '' };
  const match = destinationsReady() ? matchItem('destinations', v) : null;
  return { ok: !!match, value: match || v };
}

// The active office with this name (case-insensitive), or null.
export function officeNamed(name) {
  const q = String(name || '').trim().toLowerCase();
  return offices.find((o) => o.name.trim().toLowerCase() === q) || null;
}

// Resolves once both lists have loaded.
export function whenOfficesLoaded() {
  return new Promise((resolve) => {
    const check = () => (destinationsReady() ? resolve() : setTimeout(check, 50));
    check();
  });
}
