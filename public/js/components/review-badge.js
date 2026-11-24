// Pending-requests count on the sidebar's Review Queue link (Super Admins only).
// Listens to pending requests only, not the whole collection.
import { db } from '../core/firebase.js';
import { collection, query, where, onSnapshot } from '../core/sdk/firestore.js';

const shell = window.GaBayan;

export function startReviewBadge(session) {
  if (!session || session.role !== 'super_admin') {
    shell.setBadge('pending', 0);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'requests'), where('status', '==', 'pending')),
    (snap) => shell.setBadge('pending', snap.size),
    (error) => console.error('[review-badge] listener failed:', error)
  );
}
