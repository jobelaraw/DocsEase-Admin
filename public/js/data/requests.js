// Review Queue requests.
//   requests/{id}            -> waiting for the Super Admin (status 'pending')
//   completed_requests/{id}  -> accepted ones (history)
// Types: new_admin (sign-up), delete_admin (admin deletes own account), delete_service.
import { db } from '../core/firebase.js';
import {
  collection, doc, getDoc, query, where, orderBy, limit, writeBatch, serverTimestamp, Timestamp
} from '../core/sdk/firestore.js';
import { periodStart } from '../core/dates.js';
import { liveQuery } from './live.js';

export const HISTORY_LIMIT = 100;

const withId = (d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) });

// Every open request, newest first (the collection only holds open requests).
export function watchPendingRequests(callback, onError) {
  return liveQuery(query(collection(db, 'requests'), orderBy('createdAt', 'desc')), (snap) => callback(snap.docs.map(withId)), onError);
}

// Accepted requests resolved in a date bucket: 'today' | 'week' (Monday until today) | 'earlier'.
// Only that slice is downloaded, instead of the whole history.
export function watchCompletedRequests(bucket, callback, onError) {
  const today = Timestamp.fromDate(periodStart('today'));
  const monday = Timestamp.fromDate(periodStart('week'));
  const col = collection(db, 'completed_requests');
  let q;
  if (bucket === 'today') q = query(col, where('resolvedAt', '>=', today), orderBy('resolvedAt', 'desc'));
  else if (bucket === 'week') q = query(col, where('resolvedAt', '>=', monday), where('resolvedAt', '<', today), orderBy('resolvedAt', 'desc'));
  else q = query(col, where('resolvedAt', '<', monday), orderBy('resolvedAt', 'desc'), limit(HISTORY_LIMIT));
  return liveQuery(q, (snap) => callback(snap.docs.map(withId)), onError);
}

function complete(batch, req, session) {
  const { id, ...data } = req;
  batch.set(doc(db, 'completed_requests', id), {
    ...data,
    status: 'completed',
    resolvedAt: serverTimestamp(),
    resolvedBy_uid: session.uid,
    resolvedBy_name: session.name
  });
  batch.delete(doc(db, 'requests', id));
}

// new_admin: the pending admin becomes active
export async function acceptAdminAccount(req, session) {
  const batch = writeBatch(db);
  if (req.target_admin_uid) {
    batch.update(doc(db, 'admin', req.target_admin_uid), {
      status: 'active',
      approvedAt: serverTimestamp(),
      approvedBy_uid: session.uid,
      updatedAt: serverTimestamp()
    });
  }
  complete(batch, req, session);
  await batch.commit();
}

// delete_admin: the admin record is removed (the login is removed through adminApi)
export async function acceptAdminDeletion(req, session) {
  const batch = writeBatch(db);
  if (req.target_admin_uid) batch.delete(doc(db, 'admin', req.target_admin_uid));
  complete(batch, req, session);
  await batch.commit();
}

// Declining removes the request (and the pending admin record of a declined sign-up).
export async function declineRequest(req) {
  const batch = writeBatch(db);
  if (req.type === 'new_admin' && req.target_admin_uid) batch.delete(doc(db, 'admin', req.target_admin_uid));
  batch.delete(doc(db, 'requests', req.id));
  await batch.commit();
}

export async function adminEmail(uid) {
  if (!uid) return '';
  try {
    const snap = await getDoc(doc(db, 'admin', uid));
    return snap.exists() ? snap.data().email || '' : '';
  } catch {
    return '';
  }
}
