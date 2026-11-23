// Services of an office (Firestore: offices/{officeId}/services/{serviceId}).
// Services in Deleted Records keep their document with isDeleted: true.
import { db } from '../core/firebase.js';
import { collection, doc, getDoc, getDocs, setDoc, addDoc, query, where, serverTimestamp } from '../core/sdk/firestore.js';
import { newNotifyId } from '../core/api.js';
import { liveQuery } from './live.js';

export const isActive = (data) => !!data && data.isDeleted !== true;

function serviceFrom(snap) {
  const data = snap.data() || {};
  return { id: snap.id, name: data.service_name || snap.id, ...data };
}

// Live list of an office's active services, sorted by name: callback(services)
export function watchServices(officeId, callback, onError) {
  return liveQuery(collection(db, 'offices', officeId, 'services'), (snap) => {
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

// Saves the editable fields of a service. A new service gets a fresh document; an
// existing one keeps its other fields (translations, trash history, ...).
// notify: true stamps a new notify_id, which makes the server send the
// "new service" / "service changed" notification to citizens.
export async function saveService(officeId, serviceId, data, { isNew = false, notify = true } = {}) {
  const payload = {
    ...data,
    updated_at: serverTimestamp(),
    ...(isNew ? { created_at: serverTimestamp() } : {}),
    ...(notify ? { notify_id: newNotifyId() } : {})
  };
  await setDoc(doc(db, 'offices', officeId, 'services', serviceId), payload, { merge: !isNew });
}

// A normal admin asks the Super Admin to delete a service (Review Queue).
// -> 'requested' | 'already_requested'
export async function requestServiceDeletion({ session, officeId, officeName, serviceId, serviceName }) {
  const existing = await getDocs(query(
    collection(db, 'requests'),
    where('requested_by_uid', '==', session.uid),
    where('type', '==', 'delete_service'),
    where('service_id', '==', serviceId)
  ));
  if (existing.docs.some((d) => d.data().office_id === officeId)) return 'already_requested';

  await addDoc(collection(db, 'requests'), {
    type: 'delete_service',
    status: 'pending',
    requested_by_uid: session.uid,
    requested_by_name: session.name,
    requested_by_email: session.email,
    office_id: officeId,
    office_name: officeName || '',
    service_id: serviceId,
    service_name: serviceName || '',
    createdAt: serverTimestamp()
  });
  return 'requested';
}
