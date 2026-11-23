// Bulk-adds the Office of the City Treasurer 2 services (from the 2026 Citizen's Charter)
// exactly the way the Add Service page would, one service at a time.
//
// HOW TO RUN (must be logged in as an admin):
//   1. Open any admin page (e.g. http://localhost:5500/dashboard.html) in the browser.
//   2. Open DevTools → Console and run:
//        const seed = await import('./tools/seed_treasurer2_services.js');
//        seed.preview();                 // review what will be added
//        await seed.run({ dryRun: true }); // check office + duplicates, writes nothing
//        await seed.run();                // actually add the services
//
// Options for run():
//   dryRun      – default false. true = report only, no writes.
//   overwrite   – default false. true = replace services that already exist (same doc ID).
//   notifyUsers – default false. true = send the "new service added" notification to every
//                 user for each service, like the form does. Off by default so citizens don't
//                 get 16 notifications at once.

import { auth, db } from '../js/firebase-config.js';
import {
  collection, getDocs, getDoc, doc, setDoc, addDoc, serverTimestamp, query, where, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { OFFICE_NAME, COMMON, SERVICES, serviceIdFor } from './treasurer2_services.data.js';

export function preview() {
  console.table(SERVICES.map(s => {
    const t = s.tabs[0];
    return {
      service: s.service_name,
      requirements: t.requirements.length,
      steps: t.procedures.length,
      total_fee: t.total_fee,
      total_time: t.total_processing_time
    };
  }));
  return SERVICES;
}

// --- activity log (same logic as the Add Service page) ---
let _actor = null;
async function logServiceAdded(serviceName) {
  try {
    const user = auth.currentUser;
    if (!_actor) {
      let name = user.displayName || user.email || 'Admin';
      let role = 'admin';
      const snap = await getDoc(doc(db, 'admin', user.uid));
      if (snap.exists()) {
        name = snap.data().full_name || name;
        role = snap.data().role || 'admin';
      }
      _actor = { uid: user.uid, name, role };
    }
    const sa = await getDoc(doc(db, 'app_settings', 'super_admin'));
    const recipients = sa.exists() ? (sa.data().uids || []) : [];
    if (!recipients.length) return;

    const batch = writeBatch(db);
    recipients.forEach(uid => batch.set(doc(collection(db, 'admin', uid, 'activity_logs')), {
      type: 'service_added',
      actor_uid: _actor.uid,
      actor_name: _actor.name,
      actor_role: _actor.role,
      office_name: OFFICE_NAME,
      service_name: serviceName,
      target_name: '',
      target_uid: '',
      createdAt: serverTimestamp()
    }));
    await batch.commit();
  } catch (err) {
    console.warn('[seed] activity log failed for', serviceName, err);
  }
}

async function notifyAllUsers(serviceName, serviceId) {
  const usersSnap = await getDocs(collection(db, 'users'));
  await Promise.all(usersSnap.docs.map(u =>
    addDoc(collection(db, 'users', u.id, 'notifications'), {
      title: 'Hi Citizen! A new service added.',
      body: `${serviceName} has been added to the ${OFFICE_NAME}.`,
      service_id: serviceId,
      is_read: false,
      timestamp: serverTimestamp()
    })
  ));
}

export async function run({ dryRun = false, overwrite = false, notifyUsers = false } = {}) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Not logged in. Log in to the admin panel first, then run again.');
  if (!(await getDoc(doc(db, 'admin', user.uid))).exists()) {
    throw new Error('The logged-in account is not an admin.');
  }

  const officeSnap = await getDocs(query(collection(db, 'offices'), where('office_name', '==', OFFICE_NAME)));
  if (officeSnap.empty) throw new Error(`Office "${OFFICE_NAME}" not found.`);
  const officeId = officeSnap.docs[0].id;

  // Existing services in this office, to avoid duplicates by ID or by name
  const existing = await getDocs(collection(db, 'offices', officeId, 'services'));
  const existingIds = new Set(existing.docs.map(d => d.id));
  const existingNames = new Set(existing.docs.map(d => String(d.data().service_name || '').trim().toLowerCase()));

  const results = [];
  for (const svc of SERVICES) {
    const serviceId = serviceIdFor(officeId, svc.service_name);
    const exists = existingIds.has(serviceId) || existingNames.has(svc.service_name.toLowerCase());

    if (exists && !overwrite) {
      results.push({ service: svc.service_name, status: 'skipped (already exists)' });
      continue;
    }
    if (dryRun) {
      results.push({ service: svc.service_name, status: exists ? 'would overwrite' : 'would add', id: serviceId });
      continue;
    }

    try {
      await setDoc(doc(db, 'offices', officeId, 'services', serviceId), {
        service_name: svc.service_name,
        description: svc.description,
        ...COMMON,
        tabs: svc.tabs,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      if (notifyUsers) await notifyAllUsers(svc.service_name, serviceId);
      await logServiceAdded(svc.service_name);
      results.push({ service: svc.service_name, status: exists ? 'overwritten' : 'added', id: serviceId });
    } catch (err) {
      console.error('[seed] failed:', svc.service_name, err);
      results.push({ service: svc.service_name, status: 'FAILED: ' + (err.code || err.message) });
    }
  }

  console.table(results);
  return results;
}
