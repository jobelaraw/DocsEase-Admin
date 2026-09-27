import { auth, db } from '../Firebase/firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Pages allowed for admin
const ADMIN_ALLOWED_PAGES = [
  'dashboard.html',
  'service_management.html',
  'category_list.html',
  'add_service.html',
  'edit_service.html',
  'analytics.html',
  'activity_log.html',
];

// Redirect target for blocked admins
const DASHBOARD_URL = new URL('../Sidebar/dashboard.html', import.meta.url).href;

// Cached role hint (re-verified below)
const ROLE_HINT_KEY = 'docsease_role_hint';

const root = document.documentElement;

function fileNameOf(url) {
  try {
    return new URL(url, location.href).pathname.split('/').pop() || '';
  } catch {
    return '';
  }
}

function readHint() {
  try { return sessionStorage.getItem(ROLE_HINT_KEY); } catch { return null; }
}

function writeHint(role) {
  try {
    if (role) sessionStorage.setItem(ROLE_HINT_KEY, role);
    else sessionStorage.removeItem(ROLE_HINT_KEY);
  } catch { /* storage unavailable - ignore */ }
}

const currentPage = fileNameOf(location.href) || 'dashboard.html';
const pageAllowedForAdmin = ADMIN_ALLOWED_PAGES.includes(currentPage);

console.log('[role-guard] loaded on', currentPage);

// Hides page until role is verified
const bodyStyle = document.createElement('style');
bodyStyle.textContent = 'body { display: none !important; }';

// Fail closed by default
if (readHint() === 'super_admin') {
  root.classList.add('is-super-admin');
} else if (!pageAllowedForAdmin) {
  document.head.appendChild(bodyStyle);
}

// Removes restricted nav links
function removeRestrictedLinks() {
  document.querySelectorAll('.sidebar a.nav-item').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const page = fileNameOf(href);
    if (page.endsWith('.html') && !ADMIN_ALLOWED_PAGES.includes(page)) {
      link.remove();
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  // Not signed in
  if (!user) {
    writeHint(null);
    root.classList.remove('is-super-admin');
    return;
  }

  let role = 'admin'; // restricted by default
  try {
    const snap = await getDoc(doc(db, 'admin', user.uid));
    if (snap.exists() && snap.data().role === 'super_admin') role = 'super_admin';
    console.log('[role-guard] role in Firestore =', snap.exists() ? snap.data().role : '(no admin doc)', '-> treated as', role);
  } catch (err) {
    console.error('[role-guard] Could not read admin role, keeping restrictions:', err);
  }

  writeHint(role);

  // Super Admin: full access
  if (role === 'super_admin') {
    root.classList.add('is-super-admin');
    bodyStyle.remove();
    return;
  }

  // Normal Admin
  root.classList.remove('is-super-admin');

  if (!pageAllowedForAdmin) {
    document.head.appendChild(bodyStyle); // keep page hidden
    window.location.replace(DASHBOARD_URL);
    return;
  }

  bodyStyle.remove();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeRestrictedLinks);
  } else {
    removeRestrictedLinks();
  }
});