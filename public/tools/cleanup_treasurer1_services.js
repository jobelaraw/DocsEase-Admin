// Removes every service from "Office of the City Treasurer 1" EXCEPT the ones in KEEP,
// using the same delete flow as the Edit Service page:
//   - Super Admin  → service is deleted immediately (logged as "service_deleted")
//   - Normal admin → a deletion request is sent to the Review Queue (logged as "service_delete_requested")
//
// Before deleting, run() downloads a JSON backup of every service it is about to remove.
//
// HOW TO RUN (logged in as an admin, site served over http):
//   1. Open http://localhost:5500/office-services.html (as an admin of that office, or any page as Super Admin)
//   2. DevTools → Console:
//        const cleanup = await import('./tools/cleanup_treasurer1_services.js');
//        await cleanup.preview();   // table of KEEP / DELETE, changes nothing
//        await cleanup.run();       // backup download, then delete
//   3. Reload the page to see the result.

import { auth, db } from '../js/core/firebase.js';
import { collection, getDocs, getDoc, doc, query, where } from '../js/core/sdk/firestore.js';
import { requireAdmin } from '../js/core/session.js';
import { deleteOrRequestDeletion } from '../js/data/services.js';
import { logActivity } from '../js/core/activity-log.js';

const OFFICE_NAME = 'Office of the City Treasurer 1';

// Services to keep (matched by service_name, case-insensitive).
// Note: "Online Payment of Local Business Tax" is not its own service – it is the "Online" tab
// inside "Payment of Local Business Tax", so keeping that service keeps both.
const KEEP = [
  'Payment of Local Business Tax',
  'Payment of 2% Gross Income Tax (PEZA)',
  'Payment of Amusement Tax',
  'Payment of Franchise Tax'
];

const norm = s => String(s || '').trim().toLowerCase();

async function plan() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Not logged in. Log in to the admin panel first, then run again.');
  if (!(await getDoc(doc(db, 'admin', user.uid))).exists()) throw new Error('The logged-in account is not an admin.');

  const officeSnap = await getDocs(query(collection(db, 'offices'), where('office_name', '==', OFFICE_NAME)));
  if (officeSnap.empty) throw new Error(`Office "${OFFICE_NAME}" not found.`);
  const officeId = officeSnap.docs[0].id;

  const services = (await getDocs(collection(db, 'offices', officeId, 'services'))).docs;
  const keepSet = new Set(KEEP.map(norm));

  // Safety: refuse to run if any service we mean to keep is missing (e.g. it was renamed),
  // so a name mismatch never causes the wrong services to be deleted.
  const present = new Set(services.map(d => norm(d.data().service_name)));
  const missing = KEEP.filter(n => !present.has(norm(n)));
  if (missing.length) throw new Error('These services to keep were not found, aborting: ' + missing.join(', '));

  const keep = services.filter(d => keepSet.has(norm(d.data().service_name)));
  const remove = services.filter(d => !keepSet.has(norm(d.data().service_name)));
  return { officeId, keep, remove };
}

export async function preview() {
  const { keep, remove } = await plan();
  console.table([
    ...keep.map(d => ({ action: 'KEEP', id: d.id, service: d.data().service_name })),
    ...remove.map(d => ({ action: 'DELETE', id: d.id, service: d.data().service_name }))
  ]);
  console.log(`${keep.length} to keep, ${remove.length} to delete.`);
}

function downloadBackup(officeId, docs) {
  const toPlain = v => (v && typeof v.toDate === 'function') ? v.toDate().toISOString()
    : Array.isArray(v) ? v.map(toPlain)
    : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toPlain(x)]))
    : v;
  const data = { office_id: officeId, office_name: OFFICE_NAME, exported_at: new Date().toISOString(),
    services: docs.map(d => ({ id: d.id, data: toPlain(d.data()) })) };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `backup_${officeId}_services_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function run() {
  const { officeId, keep, remove } = await plan();
  if (!remove.length) { console.log('Nothing to delete.'); return []; }

  downloadBackup(officeId, remove);
  console.log(`Backup downloaded. Keeping ${keep.length}, processing ${remove.length}...`);

  const results = [];
  for (const d of remove) {
    const serviceName = d.data().service_name || '';
    try {
      const mode = await deleteOrRequestDeletion({ session: await requireAdmin(), officeId, officeName: OFFICE_NAME, serviceId: d.id, serviceName });
      if (mode === 'deleted') await logActivity('service_deleted', { office_name: OFFICE_NAME, service_name: serviceName });
      if (mode === 'requested') await logActivity('service_delete_requested', { office_name: OFFICE_NAME, service_name: serviceName });
      results.push({ service: serviceName, id: d.id, result: mode });
    } catch (err) {
      console.error('[cleanup] failed:', serviceName, err);
      results.push({ service: serviceName, id: d.id, result: 'FAILED: ' + (err.code || err.message) });
    }
  }
  console.table(results);
  return results;
}
