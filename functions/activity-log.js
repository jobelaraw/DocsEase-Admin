import { auth, db } from '../Firebase/firebase-config.js';
import { collection, addDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let cachedActor = null;

async function getActor(user) {
  if (cachedActor && cachedActor.uid === user.uid) return cachedActor;

  let name = user.displayName || user.email || 'Admin';
  let role = 'admin';
  try {
    const snap = await getDoc(doc(db, 'admin', user.uid));
    if (snap.exists()) {
      const data = snap.data();
      name = data.full_name || name;
      role = data.role || 'admin';
    }
  } catch (err) {
    console.error('[activity-log] could not read actor profile:', err);
  }

  cachedActor = { uid: user.uid, name, role };
  return cachedActor;
}

export async function logActivity(type, details = {}) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const actor = await getActor(user);
    await addDoc(collection(db, 'activity_logs'), {
      type,
      actor_uid: actor.uid,
      actor_name: details.actor_name || actor.name,
      actor_role: actor.role,
      office_name: details.office_name || '',
      service_name: details.service_name || '',
      target_name: details.target_name || '',
      // admin uid | 'all_admins' | '' (super admin only)
      recipient_uid: details.recipient_uid || '',
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error('[activity-log] failed to log', type, err);
  }
}