import { auth, db } from './firebase-config.js';
import { collection, onSnapshot, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const STYLE_ID = 'nav-notif-badge-style';
const BADGE_ID = 'nav-review-badge';

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .sidebar-nav .nav-item { position: relative; }
    .nav-notif-badge {
      position: absolute; top: 4px; right: 8px;
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box;
      border-radius: 999px; background: #e53935; color: #fff;
      font-family: 'Inter', sans-serif; font-size: 0.68rem; font-weight: 800; line-height: 1;
      box-shadow: 0 0 0 2px #fff; pointer-events: none;
      animation: nav-badge-pop 0.3s ease;
    }
    .nav-notif-badge[hidden] { display: none; }
    @keyframes nav-badge-pop { 0% { transform: scale(0.6); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
  `;
  document.head.appendChild(style);
}

function getBadge() {
  let badge = document.getElementById(BADGE_ID);
  if (badge) return badge;
  const link = document.querySelector('a.nav-item[href*="review-queue"], .sidebar a[href*="review-queue"]');
  if (!link) return null; // this page/role has no Review Queue link
  badge = document.createElement('span');
  badge.id = BADGE_ID;
  badge.className = 'nav-notif-badge';
  badge.hidden = true;
  link.appendChild(badge);
  return badge;
}

let lastCount = 0;

function setCount(count) {
  lastCount = count;
  const badge = getBadge();
  if (!badge) return;
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.hidden = count === 0;
  badge.setAttribute('aria-label', count + ' pending request' + (count === 1 ? '' : 's'));
}

// If the sidebar is injected after this script runs, attach the badge as soon as the link appears
new MutationObserver(() => {
  if (!document.getElementById(BADGE_ID) && document.querySelector('a[href*="review-queue"]')) {
    setCount(lastCount);
  }
}).observe(document.documentElement, { childList: true, subtree: true });

let unsubscribe = null;

onAuthStateChanged(auth, async (user) => {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (!user) return;
  try {
    const snap = await getDoc(doc(db, 'admin', user.uid));
    if (!snap.exists() || snap.data().role !== 'super_admin') {
      console.log('[review-badge] not a super_admin, skipping');
      return;
    }

    injectStyle();
    unsubscribe = onSnapshot(collection(db, 'requests'), (qs) => {
      const count = qs.docs.filter(d => (d.data().status || 'pending') === 'pending').length;
      console.log('[review-badge] pending requests:', count);
      setCount(count);
    }, (err) => console.error('[review-badge] listener failed:', err));
  } catch (err) {
    console.error('[review-badge] setup failed:', err);
  }
});