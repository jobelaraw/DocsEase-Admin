// Map Management (Super Admin): which office sits in which first-floor room,
// plus editing an office's or room's details.
import { startPage } from '../core/page.js';
import { $ } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast, confirm, snackbar } from '../components/toast.js';
import { openOfficeForm } from '../components/office-form-modal.js';
import { createFloorPlan, OLD_TO_NEW } from '../components/floor-plan.js';
import { listOffices, listRooms, saveMapSlots, saveOfficeDetails, SLOT_VERSION } from '../data/offices.js';

const FLOOR = 'first_floor';
const FIXED_IDS = new Set(['ELEVATOR']); // drawn as a fixed label, not a movable office

let records = []; // every active office and room (all floors)
const onThisFloor = () => records.filter((r) => r.floor === FLOOR);

function failToast(step, error) {
  console.error(`[map] failed while ${step}:`, error);
  toast.error('Action Failed', error.code === 'permission-denied'
    ? `You do not have permission for this (${step}).`
    : `Something went wrong while ${step}. ${error.message || 'Please try again.'}`, { button: 'OK' });
}

const plan = createFloorPlan({
  svg: $('#mm-map'),
  tray: $('#mm-tray'),
  trayCard: $('.mm-tray-card'),
  trayTitle: $('#mm-tray-title'),
  onEdit: (rec) => editRecord(rec),
  onChange: (changes, label) => commitLayout(changes, label)
});

function toRecord(item, collection) {
  let slot = item.map_slot || null;
  let oldNumbering = false;
  if (slot && item.map_slot_v !== SLOT_VERSION) {
    slot = OLD_TO_NEW[slot] || null;
    oldNumbering = true;
  }
  return {
    key: `${collection}/${item.id}`,
    collection,
    docId: item.id,
    name: item.name,
    description: item.description || '',
    floor: item.floor || '',
    category: item.category || '',
    schedule: item.schedule || '',
    openTime: item.open_time || '',
    closeTime: item.close_time || '',
    slot,
    oldNumbering
  };
}

async function load() {
  try {
    const [offices, rooms] = await Promise.all([listOffices(), listRooms()]);
    records = [
      ...offices.filter((o) => !FIXED_IDS.has(o.id)).map((o) => toRecord(o, 'offices')),
      ...rooms.filter((r) => !FIXED_IDS.has(r.id)).map((r) => toRecord(r, 'other_room'))
    ];
    plan.setRecords(onThisFloor());
    // One-time: save the new room numbers for offices placed with the old numbering
    const toConvert = records.filter((r) => r.oldNumbering);
    if (toConvert.length) {
      saveMapSlots(toConvert.map((r) => ({ collection: r.collection, id: r.docId, slot: r.slot })))
        .then(() => {
          toConvert.forEach((r) => { r.oldNumbering = false; });
          snackbar(`Updated ${toConvert.length} ${toConvert.length > 1 ? 'offices' : 'office'} to the new room numbers`);
        })
        .catch((error) => failToast('updating to the new room numbers', error));
    }
  } catch (error) {
    failToast('loading offices and rooms', error);
    plan.setRecords([]);
  } finally {
    $('#mm-map-skel')?.remove();
  }
}

// Saves a layout change optimistically; reverts and reports if saving fails.
async function commitLayout(changes, label, allowUndo = true) {
  const before = changes.map(([rec]) => [rec, rec.slot]);
  changes.forEach(([rec, slot]) => { rec.slot = slot; });
  plan.redraw();
  try {
    await saveMapSlots(changes.map(([rec, slot]) => ({ collection: rec.collection, id: rec.docId, slot })));
    snackbar(label, allowUndo ? { actionText: 'Undo', onAction: () => commitLayout(before, 'Undone', false) } : {});
  } catch (error) {
    before.forEach(([rec, slot]) => { rec.slot = slot; });
    plan.redraw();
    failToast('saving the new layout', error);
  }
}

$('#mm-autofill').addEventListener('click', async () => {
  const free = plan.freeSlots();
  const list = plan.unplaced();
  const n = Math.min(free.length, list.length);
  if (!n) return snackbar('There are no empty rooms, or nothing left to place.');
  const ok = await confirm({
    type: 'warning',
    title: 'Auto-fill empty rooms?',
    msg: `${n} unplaced ${n > 1 ? 'offices' : 'office'} will be placed in empty rooms, in alphabetical order. You can swap them afterwards.`,
    confirmText: 'Yes, fill',
    cancelText: 'No'
  });
  if (ok) commitLayout(free.slice(0, n).map((s, i) => [list[i], s.id]), `Placed ${n} ${n > 1 ? 'offices' : 'office'}`);
});

function editRecord(rec) {
  openOfficeForm({
    record: rec,
    onSubmit: async (values, { showError }) => {
      if (records.some((r) => r !== rec && r.name.toLowerCase() === values.name.toLowerCase())) {
        showError('An office or room with this name already exists.', 'name');
        return false;
      }
      // Renaming goes through the server so admins and "Navigate to" steps follow the new name
      if (values.name !== rec.name) await api.renameOffice(rec.collection, rec.docId, values.name);
      const leavesMap = values.floor !== FLOOR && !!rec.slot;
      await saveOfficeDetails(rec.collection, rec.docId, values, { clearSlot: leavesMap });
      Object.assign(rec, {
        name: values.name, description: values.description, floor: values.floor,
        category: values.category, schedule: values.schedule, openTime: '', closeTime: ''
      });
      if (leavesMap) rec.slot = null;
      plan.setRecords(onThisFloor());
      const noun = rec.collection === 'offices' ? 'Office' : 'Room';
      toast.success(`${noun} Updated`, values.floor !== FLOOR
        ? `"${values.name}" has been saved. It is on another floor now, so it is no longer on this map.`
        : `"${values.name}" has been saved.`, { button: 'OK' });
      return true;
    }
  });
}

await startPage({ superAdminOnly: true });
load();
