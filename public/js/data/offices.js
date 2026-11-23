// Offices and other rooms (Firestore: offices/{officeId}, other_room/{roomId}).
// Offices in Deleted Records keep their document with isDeleted: true.
import { db } from '../core/firebase.js';
import { collection, doc, getDoc, getDocs, query, where, limit, setDoc, updateDoc, serverTimestamp, writeBatch, deleteField } from '../core/sdk/firestore.js';
import { newNotifyId } from '../core/api.js';
import { liveQuery, liveDoc } from './live.js';
import { OFFICE_CATEGORY } from '../core/constants.js';

export const isActive = (data) => !!data && data.isDeleted !== true;
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

function officeFrom(snap) {
  const data = snap.data() || {};
  return { id: snap.id, name: data.office_name || snap.id, ...data };
}

function roomFrom(snap) {
  const data = snap.data() || {};
  return { id: snap.id, name: data.room_name || snap.id, ...data };
}

export async function getOffice(officeId) {
  const snap = await getDoc(doc(db, 'offices', officeId));
  return snap.exists() ? officeFrom(snap) : null;
}

// Live office doc: callback(office | null)
export function watchOffice(officeId, callback, onError) {
  return liveDoc(doc(db, 'offices', officeId), (snap) => callback(snap.exists() ? officeFrom(snap) : null), onError);
}

export async function findOfficeByName(name) {
  const snap = await getDocs(query(collection(db, 'offices'), where('office_name', '==', name), limit(1)));
  return snap.empty ? null : officeFrom(snap.docs[0]);
}

// Live list of active offices, sorted by name: callback(offices)
export function watchOffices(callback, onError) {
  return liveQuery(collection(db, 'offices'), (snap) => {
    callback(snap.docs.map(officeFrom).filter(isActive).sort(byName));
  }, onError);
}

export async function listOffices({ includeDeleted = false } = {}) {
  const snap = await getDocs(collection(db, 'offices'));
  return snap.docs.map(officeFrom).filter((o) => includeDeleted || isActive(o)).sort(byName);
}

export async function listRooms() {
  const snap = await getDocs(collection(db, 'other_room'));
  return snap.docs.map(roomFrom).sort(byName);
}

export function watchRooms(callback, onError) {
  return liveQuery(collection(db, 'other_room'), (snap) => callback(snap.docs.map(roomFrom).sort(byName)), onError);
}

// Office document ID from its name (same scheme the panel has always used).
export const officeIdFromName = (name) => String(name).trim().toUpperCase().replace(/\s+/g, '-');

// Finds an office or room with the same ID or name (deleted offices included,
// because a new office with the same ID would overwrite the one in Deleted Records).
export async function findDuplicate(name, { ignore = null } = {}) {
  const id = officeIdFromName(name);
  const [offices, rooms] = await Promise.all([
    getDocs(collection(db, 'offices')).catch(() => ({ docs: [] })),
    getDocs(collection(db, 'other_room')).catch(() => ({ docs: [] }))
  ]);
  const wanted = String(name).trim().toLowerCase();
  const match = [...offices.docs, ...rooms.docs].find((d) => {
    if (ignore && d.id === ignore) return false;
    const data = d.data() || {};
    return (!ignore && d.id === id) || String(data.office_name || data.room_name || d.id).trim().toLowerCase() === wanted;
  });
  return match ? { id: match.id, deleted: (match.data() || {}).isDeleted === true } : null;
}

// Adds an office (category regular_service -> offices) or another room (-> other_room).
// New offices carry a notify_id so the server tells citizens about them.
export async function createOfficeOrRoom({ name, description, floor, category, schedule }) {
  const isOffice = category === OFFICE_CATEGORY;
  const id = officeIdFromName(name);
  await setDoc(doc(db, isOffice ? 'offices' : 'other_room', id), {
    [isOffice ? 'office_name' : 'room_name']: name,
    description,
    floor,
    category,
    schedule,
    created_at: serverTimestamp(),
    ...(isOffice ? { notify_id: newNotifyId() } : {})
  });
  return { id, isOffice };
}

export function updateOfficeOrRoom(collectionName, id, patch) {
  return updateDoc(doc(db, collectionName, id), patch);
}

// ---------- Map (first-floor rooms) ----------
// map_slot = room on the floor plan; map_slot_v = numbering version (2 = current).
export const SLOT_VERSION = 2;

const slotFields = (slot) => (slot
  ? { map_slot: slot, map_slot_v: SLOT_VERSION }
  : { map_slot: deleteField(), map_slot_v: deleteField() });

// changes: [{ collection, id, slot }] (slot null = take it off the map), saved together
export async function saveMapSlots(changes) {
  const batch = writeBatch(db);
  changes.forEach(({ collection: coll, id, slot }) => batch.update(doc(db, coll, id), slotFields(slot)));
  await batch.commit();
}

// Saves the editable details of an office/room (the name is changed through
// api.renameOffice so admins and "Navigate to" steps follow it).
export function saveOfficeDetails(collectionName, id, { description, floor, category, schedule }, { clearSlot = false } = {}) {
  return updateDoc(doc(db, collectionName, id), {
    description, floor, category, schedule,
    open_time: deleteField(),
    close_time: deleteField(),
    ...(clearSlot ? slotFields(null) : {})
  });
}
