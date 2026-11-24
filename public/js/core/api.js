// Calls to the admin Cloud Functions (functions/src). One callable, many actions.
//   import { api } from '../core/api.js';
//   const { data: { accounts } } = await api.listAccounts('admins');
// Errors are thrown as Error with the server's user-friendly message and a .code
// ('permission-denied', 'not-found', 'invalid-argument', ...).
import { functions } from './firebase.js';
import { httpsCallable } from './sdk/functions.js';

const adminApi = httpsCallable(functions, 'adminApi', { timeout: 540000 });
const adminAuth = httpsCallable(functions, 'adminAuth');

async function call(fn, action, data = {}) {
  try {
    const result = await fn({ action, data });
    return result.data;
  } catch (error) {
    const code = String(error.code || '').replace(/^functions\//, '') || 'internal';
    const friendly = code === 'internal' || code === 'unavailable' || code === 'deadline-exceeded'
      ? (error.message && error.message !== 'internal' ? error.message : 'Could not reach the server. Please check your connection and try again.')
      : error.message;
    const wrapped = new Error(friendly);
    wrapped.code = code;
    wrapped.details = error.details;
    throw wrapped;
  }
}

export const api = {
  // Account Management (Super Admin)
  listAccounts: (type, version = null) => call(adminApi, 'listAccounts', { type, version }),
  setAccountStatus: (type, uid, action, reason = '') => call(adminApi, 'setAccountStatus', { type, uid, action, reason }),
  deleteAuthUser: (uid) => call(adminApi, 'deleteAuthUser', { uid }),

  // Deleted Records (Super Admin)
  trashService: (officeId, serviceId, requestId) => call(adminApi, 'trashService', { officeId, serviceId, ...(requestId ? { requestId } : {}) }),
  trashOffice: (officeId) => call(adminApi, 'trashOffice', { officeId }),
  listDeleted: (version = null) => call(adminApi, 'listDeleted', { version }),
  restoreService: (officeId, serviceId) => call(adminApi, 'restoreService', { officeId, serviceId }),
  restoreOffice: (officeId) => call(adminApi, 'restoreOffice', { officeId }),
  purgeService: (officeId, serviceId, confirmName) => call(adminApi, 'purgeService', { officeId, serviceId, confirmName }),
  purgeOffice: (officeId, confirmName) => call(adminApi, 'purgeOffice', { officeId, confirmName }),

  // Offices (Super Admin): rename everywhere it is referenced
  renameOffice: (collection, officeId, name) => call(adminApi, 'renameOffice', { collection, officeId, name }),

  // Review Queue history (Super Admin)
  deleteCompletedRequest: (requestId) => call(adminApi, 'deleteCompletedRequest', { requestId }),

  // Dashboard + Analytics numbers (any admin)
  getStats: ({ version = null, refresh = false } = {}) => call(adminApi, 'getStats', { version, refresh })
};

// Login page "Forgot password" (no sign-in needed)
export const recovery = {
  sendCode: (email) => call(adminAuth, 'sendRecoveryCode', { email }),
  verifyCode: (email, code) => call(adminAuth, 'verifyRecoveryCode', { email, code }),
  resetPassword: (email, code, newPassword) => call(adminAuth, 'resetPasswordWithCode', { email, code, newPassword })
};

// Random ID the server uses to notify citizens about a save (functions/src/triggers/citizen-notify.js).
export function newNotifyId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
