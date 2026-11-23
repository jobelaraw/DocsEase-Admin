// Services of an office (Firestore: offices/{officeId}/services/{serviceId}).
// Services in Deleted Records keep their document with isDeleted: true.
import { db } from '../core/firebase.js';
import { collection, doc, getDoc, onSnapshot } from '../core/sdk/firestore.js';

export const isActive = (data) => !!data && data.isDeleted !== true;

function serviceFrom(snap) {
  const data = snap.data() || {};
  return { id: snap.id, name: data.service_name || snap.id, ...data };
}

// Live list of an office's active services, sorted by name: callback(services)
export function watchServices(officeId, callback, onError) {
  return onSnapshot(collection(db, 'offices', officeId, 'services'), (snap) => {
    const services = snap.docs.map(serviceFrom).filter(isActive)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    callback(services);
  }, onError);
}

export async function getService(officeId, serviceId) {
  const snap = await getDoc(doc(db, 'offices', officeId, 'services', serviceId));
  return snap.exists() ? serviceFrom(snap) : null;
}

// Service document ID (same scheme the panel has always used).
export const serviceIdFor = (officeId, serviceName) =>
  `${officeId}-${String(serviceName).trim().toUpperCase().replace(/\s+/g, '-')}`;
