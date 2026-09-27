// Deletes a service (Super Admin) or files a deletion request for approval (normal admin).
// deleteOrRequestServiceDeletion({ officeId, officeName, serviceId, serviceName })
// -> { mode: 'requested' | 'already_requested' | 'deleted' }

import { auth, db } from '../Firebase/firebase-config.js';
import {
  collection, addDoc, getDocs, query, where,
  doc, getDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export async function deleteOrRequestServiceDeletion({ officeId, officeName, serviceId, serviceName }) {
  const user = auth.currentUser;
  if (!user) throw new Error('You are not signed in.');
  if (!officeId || !serviceId) throw new Error('Missing office or service id.');

  const adminSnap = await getDoc(doc(db, 'admin', user.uid));
  if (!adminSnap.exists()) throw new Error('This account is not an admin.');
  const admin = adminSnap.data();

  // Super admin: delete immediately
  if (admin.role === 'super_admin') {
    await deleteDoc(doc(db, 'offices', officeId, 'services', serviceId));
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
    createdAt: serverTimestamp() // used for Review Queue ordering
  });

  return { mode: 'requested' };
}