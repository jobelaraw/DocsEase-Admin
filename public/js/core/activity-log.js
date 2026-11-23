// Activity Log writer. Each entry is copied into admin/{uid}/activity_logs of every
// Super Admin (listed in app_settings/super_admin), plus an optional extra recipient:
//   details.recipient_uid = '<uid>'        -> that admin also gets it
//   details.recipient_uid = 'all_admins'   -> every active admin (Super Admin actions only)
// Never throws and is never awaited before showing a success message.
import { auth, db } from './firebase.js';
import { getSession } from './session.js';
import { collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp } from './sdk/firestore.js';

let superAdminUids = null;

async function getSuperAdminUids() {
  if (!superAdminUids) {
    superAdminUids = getDoc(doc(db, 'app_settings', 'super_admin'))
      .then((snap) => (snap.exists() ? snap.data().uids || [] : []))
      .catch((error) => {
        superAdminUids = null;
        console.error('[activity-log] could not read the Super Admin list:', error);
        return [];
      });
  }
  return superAdminUids;
}

async function getActiveAdminUids() {
  const snap = await getDocs(query(collection(db, 'admin'), where('status', '==', 'active')));
  return snap.docs.map((d) => d.id);
}

// actor: defaults to the signed-in admin's session ({ uid, name, role });
// pass one explicitly where there is no session yet (sign-up).
export async function logActivity(type, details = {}, actor = null) {
  try {
    const user = auth.currentUser;
    const session = getSession();
    const who = actor || (session && { uid: session.uid, name: session.name, role: session.role }) ||
      (user && { uid: user.uid, name: user.displayName || user.email || 'Admin', role: 'admin' });
    if (!who) return;

    const recipients = new Set(await getSuperAdminUids());
    if (details.recipient_uid === 'all_admins') {
      if (who.role === 'super_admin') (await getActiveAdminUids()).forEach((uid) => recipients.add(uid));
    } else if (details.recipient_uid) {
      recipients.add(details.recipient_uid);
    }
    if (!recipients.size) {
      console.warn('[activity-log] no recipients - check app_settings/super_admin');
      return;
    }

    const payload = {
      type,
      actor_uid: who.uid,
      actor_name: details.actor_name || who.name,
      actor_role: who.role,
      office_name: details.office_name || '',
      service_name: details.service_name || '',
      target_name: details.target_name || '',
      target_uid: details.target_uid || '',
      createdAt: serverTimestamp()
    };

    const uids = [...recipients];
    for (let i = 0; i < uids.length; i += 400) {
      const batch = writeBatch(db);
      uids.slice(i, i + 400).forEach((uid) => batch.set(doc(collection(db, 'admin', uid, 'activity_logs')), payload));
      await batch.commit();
    }
  } catch (error) {
    console.error('[activity-log] failed to log', type, error);
  }
}
