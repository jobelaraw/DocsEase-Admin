// The signed-in admin, checked once per page and shared by everything on it.
//
//   const session = await requireAdmin();
//   session -> { uid, email, name, role, status, office, officeId, photoURL }
//
// Rules (same on every page): signed out, no admin record, pending or deactivated
// -> login page; a normal admin on a Super Admin page -> where shell.js says.
import { auth, db, clearLocalData } from './firebase.js';
import { onAuthStateChanged, signOut as firebaseSignOut } from './sdk/auth.js';
import { doc, getDoc, collection, query, where, limit, getDocs } from './sdk/firestore.js';
import { clearCache } from './cache.js';

const shell = window.GaBayan;
const FRESH_MS = 10 * 60 * 1000; // a cached session this recent is used while it is re-checked

let current = null;
const listeners = new Set();

export function getSession() {
  return current;
}

// Called with the session now and whenever it changes (e.g. after the background re-check).
export function onSession(callback) {
  listeners.add(callback);
  if (current) callback(current);
  return () => listeners.delete(callback);
}

function publish(session) {
  current = session;
  shell.applySession(session);
  listeners.forEach((cb) => cb(session));
}

function firstAuthState() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      resolve(user);
    });
  });
}

// Office ID for an admin's office name (admins are linked to offices by name).
async function officeIdFor(officeName) {
  if (!officeName) return '';
  const snap = await getDocs(query(collection(db, 'offices'), where('office_name', '==', officeName), limit(1)));
  return snap.empty ? '' : snap.docs[0].id;
}

// Reads admin/{uid} and builds the session (null = not an admin).
export async function loadSession(user) {
  const snap = await getDoc(doc(db, 'admin', user.uid));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  const previous = shell.readSession();
  const office = data.admin_office || '';
  const reuseOffice = previous && previous.uid === user.uid && previous.office === office && previous.officeId;
  return {
    uid: user.uid,
    email: user.email || data.email || '',
    name: data.full_name || user.displayName || user.email || 'Admin',
    role: data.role === 'super_admin' ? 'super_admin' : 'admin',
    status: data.status || 'pending',
    office,
    officeId: reuseOffice ? previous.officeId : (data.role === 'super_admin' ? '' : await officeIdFor(office)),
    photoURL: user.photoURL || '',
    savedAt: Date.now()
  };
}

function go(url) {
  location.replace(url);
  return new Promise(() => {}); // the page is leaving; never resolve
}

// Where this admin may not stay, or null if the page is fine.
function redirectFor(session, { superAdminOnly }) {
  if (!session || session.status !== 'active') return 'login.html';
  const page = shell.currentPage();
  const target = shell.SUPER_ADMIN_PAGES[page];
  const needsSuper = superAdminOnly || target !== undefined;
  if (needsSuper && session.role !== 'super_admin') {
    return target === 'office' ? shell.officeHref(session) : (target || 'dashboard.html');
  }
  return null;
}

async function leave(session) {
  if (!session || session.status !== 'active') {
    await signOut({ redirect: false });
    return go('login.html');
  }
  return go(redirectFor(session, {}));
}

// Waits for the signed-in admin and enforces page access. Resolves with the session.
// A recent cached session lets the page start immediately; it is re-checked in the
// background and the page is left if access was revoked meanwhile.
export async function requireAdmin({ superAdminOnly = false } = {}) {
  // Keep the page invisible until we know this is an allowed admin, so a signed-out
  // visitor never sees the protected layout. (Set through the DOM, which the CSP allows.)
  const root = document.documentElement;
  root.style.visibility = 'hidden';
  const reveal = () => { root.style.visibility = ''; };

  const user = await firstAuthState();
  if (!user) return go('login.html');

  const cached = shell.readSession();
  if (cached && cached.uid === user.uid && Date.now() - (cached.savedAt || 0) < FRESH_MS && !redirectFor(cached, { superAdminOnly })) {
    publish(cached);
    reveal();
    loadSession(user).then((fresh) => {
      if (redirectFor(fresh, { superAdminOnly })) return leave(fresh);
      if (JSON.stringify({ ...fresh, savedAt: 0 }) !== JSON.stringify({ ...cached, savedAt: 0 })) publish(fresh);
      else shell.saveSession({ ...cached, savedAt: Date.now() });
    }).catch((error) => console.warn('[session] background check failed:', error));
    return cached;
  }

  let session;
  try {
    session = await loadSession(user);
  } catch (error) {
    console.error('[session] could not load the admin record:', error);
    await signOut({ redirect: false });
    return go('login.html');
  }
  const redirect = redirectFor(session, { superAdminOnly });
  if (redirect) return leave(session);
  publish(session);
  reveal();
  return session;
}

// Signs out, forgets everything cached on this computer, then goes to the login page.
export async function signOut({ redirect = true } = {}) {
  shell.saveSession(null);
  clearCache();
  try {
    ['docsEase_avatar', 'docsEase_name', 'docsEase_role'].forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem('docsease_role_hint');
  } catch { /* storage unavailable */ }
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('[session] sign out failed:', error);
  }
  await clearLocalData();
  if (redirect) location.replace('login.html');
}