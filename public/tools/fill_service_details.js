// Fills EMPTY Transaction Details, Step-by-Step Guide and Location/Contact fields of existing
// services across all offices, using the 2026 Citizen's Charter (see fill_service_details.data.js).
// Existing values are never changed.
//
// HOW TO RUN (logged in as an admin, site served over http, e.g. python3 -m http.server 5500):
//   1. Open http://localhost:5500/service-management.html
//   2. DevTools → Console:
//        const fill = await import('./tools/fill_service_details.js');
//        await fill.preview();   // what would change, writes nothing
//        await fill.run();       // backup download, then update
//
// Each updated service is logged as "service_updated" in the Activity Log.
// No citizen notifications are sent.

import { auth, db } from '../js/firebase-config.js';
import { collection, getDocs, getDoc, doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { logActivity } from '../js/activity-log.js';
import { planFill } from './fill_service_details.core.js';

async function buildPlan() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Not logged in. Log in to the admin panel first, then run again.');
  if (!(await getDoc(doc(db, 'admin', user.uid))).exists()) throw new Error('The logged-in account is not an admin.');

  const plan = [];
  const offices = await getDocs(collection(db, 'offices'));
  for (const office of offices.docs) {
    const services = await getDocs(collection(db, 'offices', office.id, 'services'));
    for (const s of services.docs) {
      const p = planFill(office.id, s.id, s.data());
      if (p.warnings.length) console.warn(`[fill] ${office.id}/${s.id}:`, p.warnings.join('; '));
      if (p.changes.length) {
        plan.push({ officeId: office.id, officeName: office.data().office_name || office.id,
          serviceId: s.id, serviceName: s.data().service_name || s.id, original: s.data(), ...p });
      }
    }
  }
  return plan;
}

const summarize = plan => plan.map(p => ({
  office: p.officeId, service: p.serviceName, source: p.source || 'office contacts',
  fields_filled: p.changes.length,
  contact: p.changes.filter(c => !c.startsWith('tab')).join(', '),
  transaction: p.changes.filter(c => /^tab\d+\.[a-z_]+$/.test(c)).length,
  steps: p.changes.filter(c => c.includes('.step')).length
}));

export async function preview() {
  const plan = await buildPlan();
  console.table(summarize(plan));
  console.log(`${plan.length} service(s) would be updated. Inspect one with: (await fill.details())[0]`);
  return plan.length;
}

// Full before/after detail per service, for spot-checking.
export async function details() {
  return (await buildPlan()).map(p => ({ key: `${p.officeId}/${p.serviceId}`, changes: p.changes, patch: p.patch }));
}

function downloadBackup(plan) {
  const toPlain = v => (v && typeof v.toDate === 'function') ? v.toDate().toISOString()
    : Array.isArray(v) ? v.map(toPlain)
    : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toPlain(x)]))
    : v;
  const data = { exported_at: new Date().toISOString(),
    services: plan.map(p => ({ office_id: p.officeId, id: p.serviceId, data: toPlain(p.original) })) };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `backup_services_before_fill_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function run() {
  const plan = await buildPlan();
  if (!plan.length) { console.log('Nothing to fill.'); return []; }

  downloadBackup(plan);
  console.log(`Backup downloaded. Updating ${plan.length} service(s)...`);

  const results = [];
  for (const p of plan) {
    try {
      await updateDoc(doc(db, 'offices', p.officeId, 'services', p.serviceId), { ...p.patch, updated_at: serverTimestamp() });
      await logActivity('service_updated', { office_name: p.officeName, service_name: p.serviceName });
      results.push({ office: p.officeId, service: p.serviceName, result: `updated (${p.changes.length} fields)` });
    } catch (err) {
      console.error('[fill] failed:', p.serviceName, err);
      results.push({ office: p.officeId, service: p.serviceName, result: 'FAILED: ' + (err.code || err.message) });
    }
  }
  console.table(results);
  return results;
}
