// Activity log copies of one admin (Firestore: admin/{uid}/activity_logs).
// Entries are written by js/core/activity-log.js.
import { db } from '../core/firebase.js';
import { collection, doc, query, orderBy, limit, writeBatch } from '../core/sdk/firestore.js';
import { toDate } from '../core/dates.js';
import { liveQuery } from './live.js';

export const MAX_LOGS = 300;

// Live list, newest first: callback(logs) with log._date set
export function watchActivity(uid, callback, onError) {
  const q = query(collection(db, 'admin', uid, 'activity_logs'), orderBy('createdAt', 'desc'), limit(MAX_LOGS));
  return liveQuery(q, (snap) => {
    const logs = snap.docs.map((d) => {
      const data = d.data({ serverTimestamps: 'estimate' });
      return { id: d.id, ...data, _date: toDate(data.createdAt) };
    });
    logs.sort((a, b) => (b._date ? b._date.getTime() : Infinity) - (a._date ? a._date.getTime() : Infinity));
    callback(logs);
  }, onError);
}

export async function deleteActivity(uid, ids) {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach((id) => batch.delete(doc(db, 'admin', uid, 'activity_logs', id)));
    await batch.commit();
  }
}
