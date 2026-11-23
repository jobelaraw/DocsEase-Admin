// Offices and other rooms (Firestore: offices/{officeId}, other_room/{roomId}).
// Offices in Deleted Records keep their document with isDeleted: true.
import { db } from '../core/firebase.js';
import { collection, doc, getDoc, getDocs, onSnapshot, query, where, limit } from '../core/sdk/firestore.js';

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
  return onSnapshot(doc(db, 'offices', officeId), (snap) => callback(snap.exists() ? officeFrom(snap) : null), onError);
}

export async function findOfficeByName(name) {
  const snap = await getDocs(query(collection(db, 'offices'), where('office_name', '==', name), limit(1)));
  return snap.empty ? null : officeFrom(snap.docs[0]);
}

// Live list of active offices, sorted by name: callback(offices)
export function watchOffices(callback, onError) {
  return onSnapshot(collection(db, 'offices'), (snap) => {
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
  return onSnapshot(collection(db, 'other_room'), (snap) => callback(snap.docs.map(roomFrom).sort(byName)), onError);
}

// Office document ID from its name (same scheme the panel has always used).
export const officeIdFromName = (name) => String(name).trim().toUpperCase().replace(/\s+/g, '-');
