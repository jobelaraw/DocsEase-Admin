// Live Firestore listeners that never show a false "nothing here".
// With the offline cache on, a listener first answers from the cache; on a first
// visit that answer is empty. Such empty cache-only answers are skipped until the
// server has answered, so pages keep their skeleton instead of flashing "No ...".
import { onSnapshot } from '../core/sdk/firestore.js';

export function liveQuery(q, callback, onError) {
  let heardServer = false;
  let delivered = false;
  return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    if (!snap.metadata.fromCache) heardServer = true;
    if (!heardServer && snap.empty) return;                  // empty cache answer: wait for the server
    if (delivered && snap.docChanges().length === 0) return; // metadata-only change: nothing new to draw
    delivered = true;
    callback(snap);
  }, onError);
}

export function liveDoc(ref, callback, onError) {
  let heardServer = false;
  return onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
    if (!snap.metadata.fromCache) heardServer = true;
    if (!heardServer && !snap.exists()) return; // "not found" from the cache only: wait for the server
    callback(snap);
  }, onError);
}
