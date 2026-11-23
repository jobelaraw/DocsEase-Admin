// Moves a service to Deleted Records (Super Admin) or files a deletion request for approval (normal admin).
// -> { mode: 'requested' | 'already_requested' | 'deleted' }

import { auth, db } from './firebase-config.js';
import {
  collection, addDoc, getDocs, query, where,
  doc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { notifySuperAdminDeleteRequest } from './email-service.js';

const FUNCTIONS_BASE = 'https://us-central1-docsease-efacc.cloudfunctions.net/';

// Calls a Super Admin trash Cloud Function; the function itself checks the caller is a Super Admin.
async function callTrashFunction(name, body) {
  const user = auth.currentUser;
  if (!user) throw new Error('You are not signed in.');
  const res = await fetch(FUNCTIONS_BASE + name, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await user.getIdToken() },
    body: JSON.stringify(body)
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* non-JSON error */ }
  if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
  return data;
}

// Soft-deletes a service (isDeleted: true, recoverable for 30 days).
export function trashServiceAsSuperAdmin(officeId, serviceId) {
  return callTrashFunction('adminTrashService', { officeId, serviceId });
}

// Soft-deletes an office (isDeleted: true, recoverable for 30 days). Its services are left untouched.
export function trashOfficeAsSuperAdmin(officeId) {
  return callTrashFunction('adminTrashOffice', { officeId });
}

export async function deleteOrRequestServiceDeletion({ officeId, officeName, serviceId, serviceName }) {
  const user = auth.currentUser;
  if (!user) throw new Error('You are not signed in.');
  if (!officeId || !serviceId) throw new Error('Missing office or service id.');

  const adminSnap = await getDoc(doc(db, 'admin', user.uid));
  if (!adminSnap.exists()) throw new Error('This account is not an admin.');
  const admin = adminSnap.data();

  // Super admin: move to Deleted Records immediately
  if (admin.role === 'super_admin') {
    await trashServiceAsSuperAdmin(officeId, serviceId);
    return { mode: 'deleted' };
  }

  // Normal admin: submit request instead
  // Prevent duplicate requests
  const existing = await getDocs(query(
    collection(db, 'requests'),
    where('requested_by_uid', '==', user.uid),
    where('type', '==', 'delete_service'),
    where('service_id', '==', serviceId)
  ));
  if (existing.docs.some(d => d.data().office_id === officeId)) {
    return { mode: 'already_requested' };
  }

  const requesterName = admin.full_name || user.displayName || user.email;

  await addDoc(collection(db, 'requests'), {
    type: 'delete_service',
    status: 'pending',
    requested_by_uid: user.uid,
    requested_by_name: admin.full_name || user.displayName || user.email,
    requested_by_email: user.email,
    office_id: officeId,
    office_name: officeName || '',
    service_id: serviceId,
    service_name: serviceName || '',
    createdAt: serverTimestamp()
  });

  await notifySuperAdminDeleteRequest(requesterName, serviceName, officeName);

  return { mode: 'requested' };
}