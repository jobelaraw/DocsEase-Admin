import { auth, db } from '../Firebase/firebase-config.js';
import {
  collection, doc, getDoc, getDocs, query, where,
  writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let cachedActor = null;
let cachedSuperAdmins = null;

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

async function getSuperAdminUids() {
  if (cachedSuperAdmins) return cachedSuperAdmins;
  try {
    const snap = await getDoc(doc(db, 'app_settings', 'super_admin'));
    cachedSuperAdmins = snap.exists() ? (snap.data().uids || []) : [];
  } catch (err) {
    console.error('[activity-log] could not read super admin list:', err);
    return [];
  }
  return cachedSuperAdmins;
}

async function getActiveAdminUids() {
  const snap = await getDocs(query(collection(db, 'admin'), where('status', '==', 'active')));
  return snap.docs.map(d => d.id);
}

export async function logActivity(type, details = {}) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const actor = await getActor(user);

    const recipients = new Set(await getSuperAdminUids());

    if (details.recipient_uid === 'all_admins') {
      if (actor.role === 'super_admin') {
        (await getActiveAdminUids()).forEach(uid => recipients.add(uid));
      }
    } else if (details.recipient_uid) {
      recipients.add(details.recipient_uid);
    }

    if (!recipients.size) return;

    const payload = {
      type,
      actor_uid: actor.uid,
      actor_name: details.actor_name || actor.name,
      actor_role: actor.role,
      office_name: details.office_name || '',
      service_name: details.service_name || '',
      target_name: details.target_name || '',
      target_uid: details.target_uid || '',
      createdAt: serverTimestamp()
    };

    // One copy per recipient, in chunks (batch limit is 500)
    const uids = [...recipients];
    for (let i = 0; i < uids.length; i += 400) {
      const batch = writeBatch(db);
      uids.slice(i, i + 400).forEach(uid => {
        batch.set(doc(collection(db, 'admin', uid, 'activity_logs')), payload);
      });
      await batch.commit();
    }
  } catch (err) {
    console.error('[activity-log] failed to log', type, err);
  }
}