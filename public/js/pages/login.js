// Login page: sign in, sign up (email or Google), forgot password.
// Forgot-password codes are created and checked by the server (adminAuth);
// the browser never sees the code.
import { auth, db, googleProvider } from '../core/firebase.js';
import { loadSession } from '../core/session.js';
import { recovery } from '../core/api.js';
import { logActivity } from '../core/activity-log.js';
import { checkPassword } from '../core/password.js';
import { sendRegistrationEmail, notifySuperAdminNewRequest } from '../core/email.js';
import { html, render, $, $$, on } from '../core/dom.js';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup,
  updateProfile, deleteUser, signOut
} from '../core/sdk/auth.js';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from '../core/sdk/firestore.js';
import { toast, confirm } from '../components/toast.js';
import { AdminAgreement } from '../components/admin-agreement.js';
import { listOffices } from '../data/offices.js';

const shell = window.GaBayan;
const wrapper = $('#wrapper');

// ---------- field errors ----------
function fieldWrap(id) {
  return document.getElementById(id)?.closest('.input-wrap');
}

function showFieldError(id, message) {
  const wrap = fieldWrap(id);
  if (wrap) {
    wrap.classList.remove('has-success');
    wrap.classList.add('has-error');
  }
  const err = document.getElementById(`err-${id}`);
  if (err) {
    err.textContent = message;
    err.style.display = 'block';
  }
}

function clearFieldError(id) {
  fieldWrap(id)?.classList.remove('has-error');
  const err = document.getElementById(`err-${id}`);
  if (err) {
    err.textContent = '';
    err.style.display = 'none';
  }
}

function clearAllErrors() {
  $$('.input-wrap').forEach((w) => w.classList.remove('has-error', 'has-success'));
  $$('.field-error').forEach((e) => { e.textContent = ''; e.style.display = 'none'; });
}

const value = (id) => (document.getElementById(id)?.value || '').trim();

// ---------- screens ----------
const FIELDS = ['si-email', 'si-password', 'su-name', 'su-email', 'su-password', 'su-confirm', 'recovery-email', 'recovery-code', 'new-password', 'confirm-new-password'];

// Clears one screen's fields, errors, password rules and eye toggles.
function resetForms(scope) {
  const inside = (el) => el && scope.contains(el);
  $$('.input-wrap', scope).forEach((w) => w.classList.remove('has-error', 'has-success'));
  $$('.field-error', scope).forEach((e) => { e.textContent = ''; e.style.display = 'none'; });
  FIELDS.forEach((id) => { const f = document.getElementById(id); if (inside(f)) f.value = ''; });
  
  const office = document.getElementById('su-office');
  if (inside(office)) office.value = '';
  
  ['#sign-in-btn', '#sign-up-btn'].forEach((sel) => { if (inside($(sel))) $(sel).disabled = true; });
  if (scope.id === 'screen-signup') AdminAgreement.reset();
  ['su-password-rules', 'reset-password-rules'].forEach((id) => { const r = document.getElementById(id); if (inside(r)) r.style.display = 'none'; });
  $$('.rule-item', scope).forEach((rule) => {
    rule.classList.remove('valid');
    const icon = rule.querySelector('.rule-icon');
    if (icon) icon.textContent = '✕';
  });
  $$('[data-eye]', scope).forEach((btn) => setEye(btn, false));
}

const SCREENS = { signin: 'wrapper', signup: 'wrapper signup-mode', forgotpass: 'wrapper forgotpass-mode', recoverycode: 'wrapper recoverycode-mode', resetpass: 'wrapper resetpass-mode' };
const NATURAL = Object.keys(SCREENS); // left-to-right order in login.html
const screenEl = (name) => document.getElementById(`screen-${name}`);
let current = 'signin';
let slideId = 0;

// ---------- strip order ----------
// The screens sit side by side on one strip and the strip slides. Sign In -> Sign Up
// moves one screen over, so the two form panels meet in the middle. Screens further
// apart (Sign In -> Forgot Password) would slide past the screens in between, so the
// target is first moved right next to the current screen - on the side it lies in
// the natural order - and every change becomes the same one-screen slide.
let strip = [...NATURAL];

function placeStrip() {
  strip.forEach((name, i) => { screenEl(name).style.order = i; });
}

function showPosition(name) {
  wrapper.style.transform = `translateX(-${strip.indexOf(name) * (100 / strip.length)}%)`;
}

// Puts `to` beside `from` (if it isn't already on the right side), without anything
// visible moving: the strip is re-shown at `from`'s new position in the same frame.
function bringBeside(from, to) {
  const side = NATURAL.indexOf(to) > NATURAL.indexOf(from) ? 1 : -1;
  if (strip.indexOf(to) === strip.indexOf(from) + side) return;
  strip = strip.filter((n) => n !== to);
  strip.splice(strip.indexOf(from) + (side > 0 ? 1 : 0), 0, to);
  wrapper.style.transition = 'none';
  placeStrip();
  showPosition(from);
  void wrapper.offsetWidth; // apply before the transition is turned back on
  wrapper.style.transition = '';
}
placeStrip();

// Only the screen on view can be focused or clicked: tabbing into an off-screen
// field would make the browser scroll the strip and jump the layout.
function setActiveScreen(name) {
  Object.keys(SCREENS).forEach((n) => { screenEl(n).inert = n !== name; });
}
setActiveScreen(current);

// Runs once the slide has finished (with a fallback in case transitionend never fires).
function afterSlide(fn) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    wrapper.removeEventListener('transitionend', onEnd);
    clearTimeout(timer);
    fn();
  };
  const onEnd = (e) => { if (e.target === wrapper && e.propertyName === 'transform') finish(); };
  wrapper.addEventListener('transitionend', onEnd);
  const timer = setTimeout(finish, 1000);
}

function go(screen, { keepValues = false, instant = false } = {}) {
  const from = current;
  current = screen;
  const id = ++slideId;
  setActiveScreen(screen);

  // Screens out of view are cleared now; the one sliding away is cleared once it is
  // off-screen, so its fields and errors don't visibly change mid-slide.
  if (!keepValues) {
    Object.keys(SCREENS).forEach((n) => { if (n !== from || from === screen) resetForms(screenEl(n)); });
  }

  wrapper.className = SCREENS[screen]; // which screen is showing (e.g. signup-mode)
  if (instant) {
    wrapper.style.transition = 'none';
    showPosition(screen);
    void wrapper.offsetWidth; // apply the jump before turning the transition back on
    wrapper.style.transition = '';
  } else if (from !== screen) {
    bringBeside(from, screen);
    showPosition(screen);
    wrapper.dataset.sliding = '';
    afterSlide(() => { if (id === slideId) delete wrapper.dataset.sliding; });
  }

  if (!keepValues && from !== screen) {
    const reset = () => { if (current !== from) resetForms(screenEl(from)); };
    if (instant) reset(); else afterSlide(reset);
  }
  if (screen === 'signup') loadOfficeOptions();
}

on(document, 'click', '[data-go]', (e, link) => {
  e.preventDefault();
  go(link.dataset.go);
});

// ---------- show / hide password ----------
function setEye(btn, show) {
  const input = document.getElementById(btn.dataset.eye);
  const img = btn.querySelector('img');
  input.type = show ? 'text' : 'password';
  img.src = show ? 'assets/eyeShow.svg' : 'assets/eyeHide.svg';
  img.alt = show ? 'Hide password' : 'Show password';
}
on(document, 'click', '[data-eye]', (e, btn) => setEye(btn, document.getElementById(btn.dataset.eye).type === 'password'));

// ---------- typewriter headlines ----------
function typewriter(elements, words) {
  let wi = 0;
  let ci = 0;
  let deleting = false;
  (function tick() {
    // Hold the headline still while the screens slide, so the slide never waits on a repaint.
    if ('sliding' in wrapper.dataset) { setTimeout(tick, 100); return; }
    const word = words[wi];
    const text = deleting ? word.substring(0, ci--) : word.substring(0, ci++);
    elements.forEach((el) => { if (el) el.textContent = text; });
    if (!deleting && ci > word.length) { deleting = true; setTimeout(tick, 1800); return; }
    if (deleting && ci < 0) { deleting = false; wi = (wi + 1) % words.length; }
    setTimeout(tick, deleting ? 60 : 100);
  })();
}
typewriter([$('#typewriter')], ['Citizens.', 'Applicants.', 'Biñanenses.']);
typewriter([$('#typewriter2')], ['Lead', 'Drive', 'Join']);
typewriter([$('#typewriter3'), $('#typewriter3b'), $('#typewriter3c')], ['Forgot', 'Recover', 'Lost']);

// ---------- office list (only needed for sign-up) ----------
let officesLoaded = null;
function loadOfficeOptions() {
  if (!officesLoaded) {
    officesLoaded = listOffices().then((offices) => {
      const options = html`<option value="" disabled selected>Select an office</option>${offices.map((o) => html`<option value="${o.name}">${o.name}</option>`)}`;
      render($('#su-office'), options);
      render($('#gs-office'), options);
    }).catch((error) => {
      console.error('[login] could not load offices:', error);
      officesLoaded = null;
      const failed = html`<option value="" disabled selected>Error loading offices</option>`;
      render($('#su-office'), failed);
      render($('#gs-office'), failed);
    });
  }
  return officesLoaded;
}

// ---------- password checklists ----------
function updateRules(prefix, pw) {
  const result = checkPassword(pw);
  ['length', 'symbol', 'capital', 'number'].forEach((rule) => {
    const el = document.getElementById(`${prefix}${rule}`);
    if (!el) return;
    el.classList.toggle('valid', result[rule]);
    const icon = el.querySelector('.rule-icon');
    if (icon) icon.textContent = result[rule] ? '✓' : '✕';
  });
  return result.ok;
}

function wirePasswordPair({ passwordId, confirmId, rulesId, rulePrefix, onChange }) {
  const pw = document.getElementById(passwordId);
  const cf = document.getElementById(confirmId);
  pw.addEventListener('input', () => {
    const wrap = fieldWrap(passwordId);
    const rules = document.getElementById(rulesId);
    if (!pw.value) {
      rules.style.display = 'none';
      wrap.classList.remove('has-error', 'has-success');
      clearFieldError(passwordId);
    } else {
      rules.style.display = 'block';
      const ok = updateRules(rulePrefix, pw.value);
      wrap.classList.toggle('has-success', ok);
      if (ok) clearFieldError(passwordId);
    }
    if (cf.value) cf.dispatchEvent(new Event('input'));
    if (onChange) onChange();
  });
  cf.addEventListener('input', () => {
    clearFieldError(confirmId);
    const wrap = fieldWrap(confirmId);
    if (!cf.value) wrap.classList.remove('has-success');
    else if (cf.value === pw.value) wrap.classList.add('has-success');
    else showFieldError(confirmId, 'Passwords do not match. Please try again.');
    if (onChange) onChange();
  });
}

// ---------- buttons enabled only when the form can be sent ----------
const SIGN_IN_FIELDS = ['si-email', 'si-password'];
const SIGN_UP_FIELDS = ['su-name', 'su-email', 'su-password', 'su-confirm'];
function refreshButtons() {
  // Passwords count spaces as content; other fields are trimmed
  const filled = (id) => (/password|confirm/.test(id) ? !!document.getElementById(id).value : !!value(id));
  const blocked = (ids) => ids.some((id) => !filled(id) || fieldWrap(id)?.classList.contains('has-error'));
  $('#sign-in-btn').disabled = blocked(SIGN_IN_FIELDS);
  $('#sign-up-btn').disabled = !AdminAgreement.isAgreed() || blocked(SIGN_UP_FIELDS);
}
document.addEventListener('agreement-change', refreshButtons);
SIGN_IN_FIELDS.forEach((id) => document.getElementById(id).addEventListener('input', () => {
  SIGN_IN_FIELDS.forEach(clearFieldError);
  refreshButtons();
}));
['su-name', 'su-email'].forEach((id) => document.getElementById(id).addEventListener('input', (e) => {
  clearFieldError(id);
  if (id === 'su-name') fieldWrap(id).classList.toggle('has-success', !!e.target.value.trim());
  else fieldWrap(id).classList.remove('has-success');
  refreshButtons();
}));
$('#su-office').addEventListener('change', () => clearFieldError('su-office'));
['recovery-email', 'recovery-code'].forEach((id) => document.getElementById(id).addEventListener('input', () => clearFieldError(id)));
wirePasswordPair({ passwordId: 'su-password', confirmId: 'su-confirm', rulesId: 'su-password-rules', rulePrefix: 'rule-', onChange: refreshButtons });
wirePasswordPair({ passwordId: 'new-password', confirmId: 'confirm-new-password', rulesId: 'reset-password-rules', rulePrefix: 'rule-reset-' });

// ---------- after sign-in ----------
async function enterApp(user) {
  const session = await loadSession(user);
  shell.saveSession(session); // the dashboard starts from it without another read
  location.replace('dashboard.html');
}

// ---------- sign-in lockout (5 wrong passwords = 10 minutes) ----------
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000;
const LOCK_KEY = 'gabayan_login_lockout';
const readLocks = () => { try { return JSON.parse(localStorage.getItem(LOCK_KEY)) || {}; } catch { return {}; } };
const writeLocks = (locks) => { try { localStorage.setItem(LOCK_KEY, JSON.stringify(locks)); } catch { /* ignore */ } };
const lockKey = (email) => email.trim().toLowerCase();

function lockRemaining(email) {
  const locks = readLocks();
  const entry = locks[lockKey(email)];
  if (!entry || !entry.lockedUntil) return 0;
  const left = entry.lockedUntil - Date.now();
  if (left <= 0) {
    delete locks[lockKey(email)];
    writeLocks(locks);
    return 0;
  }
  return left;
}

function failedAttempt(email) {
  const locks = readLocks();
  const entry = locks[lockKey(email)] || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) entry.lockedUntil = Date.now() + LOCKOUT_MS;
  locks[lockKey(email)] = entry;
  writeLocks(locks);
  return entry.count >= MAX_ATTEMPTS;
}

function lockFor(email) {
  const locks = readLocks();
  locks[lockKey(email)] = { count: MAX_ATTEMPTS, lockedUntil: Date.now() + LOCKOUT_MS };
  writeLocks(locks);
}

function clearAttempts(email) {
  const locks = readLocks();
  if (locks[lockKey(email)]) {
    delete locks[lockKey(email)];
    writeLocks(locks);
  }
}

function showLocked(email) {
  const minutes = Math.ceil(lockRemaining(email) / 60000);
  toast.error('Account Temporarily Locked', `Too many failed login attempts. Please try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`, { button: 'OK' });
}

// ---------- sign in ----------
async function handleSignIn() {
  clearAllErrors();
  const email = value('si-email');
  const password = $('#si-password').value;
  if (!email) showFieldError('si-email', 'Please fill the required field.');
  if (!password) showFieldError('si-password', 'Please fill the required field.');
  if (!email || !password) return;
  if (lockRemaining(email) > 0) return showLocked(email);

  const button = $('#sign-in-btn');
  button.disabled = true;
  toast.loading('Signing In...', 'Please wait while we sign you in.');
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    clearAttempts(email);
    const session = await loadSession(user);
    if (!session || session.status !== 'active') {
      await signOut(auth);
      toast.close();
      showFieldError('si-email', !session
        ? 'This account is not registered as an admin.'
        : session.status === 'deactivated'
          ? 'This account has been deactivated. Please contact the Super Admin.'
          : 'Your account is still awaiting Super Admin approval.');
      button.disabled = false;
      return;
    }
    shell.saveSession(session);
    location.replace('dashboard.html');
  } catch (error) {
    toast.close();
    button.disabled = false;
    if (error.code === 'auth/user-disabled') return showFieldError('si-email', 'This account has been deactivated. Please contact the Super Admin.');
    if (error.code === 'auth/network-request-failed') return showFieldError('si-email', 'No internet connection. Please check your network.');
    if (error.code === 'auth/too-many-requests') {
      lockFor(email);
      return showLocked(email);
    }
    if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-login-credentials'].includes(error.code) && failedAttempt(email)) {
      return showLocked(email);
    }
    showFieldError('si-email', 'Email or password is invalid.');
    showFieldError('si-password', 'Email or password is invalid.');
  }
}

// ---------- sign up ----------
async function submitRequest({ user, name, email, office, method }) {
  await setDoc(doc(db, 'admin', user.uid), {
    admin_id: user.uid,
    full_name: name,
    email,
    admin_office: office,
    role: 'admin',
    status: 'pending',
    sign_in_method: method,
    accepted_terms_version: AdminAgreement.version,
    accepted_terms_at: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await addDoc(collection(db, 'requests'), {
    type: 'new_admin',
    status: 'pending',
    requested_by_uid: user.uid,
    requested_by_name: name,
    requested_by_email: email,
    target_admin_uid: user.uid,
    office_name: office,
    createdAt: serverTimestamp()
  });
  // Written to the Super Admins' Activity Log before signing out
  await logActivity('admin_account_requested', { actor_name: name, office_name: office }, { uid: user.uid, name, role: 'admin' });
  sendRegistrationEmail(email, name, office, 'review');
  notifySuperAdminNewRequest(name, email, office);
  await signOut(auth);
}

async function requestSubmitted(name) {
  await toast.success('Request Submitted!', `Your admin account for ${name} has been created and is now awaiting Super Admin approval. You'll be able to sign in once it's approved.`, { button: 'Back to Sign In' });
  go('signin');
}

async function handleSignUp() {
  if (!AdminAgreement.isAgreed()) {
    await AdminAgreement.open('terms');
    return;
  }
  const name = value('su-name');
  const email = value('su-email');
  const office = $('#su-office').value;
  const password = $('#su-password').value;
  const confirmPw = $('#su-confirm').value;
  let missing = false;
  [['su-name', name], ['su-email', email], ['su-password', password], ['su-confirm', confirmPw]].forEach(([id, v]) => {
    if (!v) { showFieldError(id, 'Please fill the required field.'); missing = true; }
  });
  if (!office) { showFieldError('su-office', 'Please select an office.'); missing = true; }
  if (missing) return;
  if (password !== confirmPw) return showFieldError('su-confirm', 'Passwords do not match. Please try again.');
  if (!checkPassword(password).ok) return showFieldError('su-password', 'Please meet all the password requirements.');

  const button = $('#sign-up-btn');
  button.disabled = true;
  toast.loading('Signing Up...', 'Please wait while we create your account.');
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    // Start email accounts on one of the built-in avatars (saved the same way the profile menu saves a pick).
    const avatar = shell.AVATARS[Math.floor(Math.random() * shell.AVATARS.length)];
    const photoURL = new URL(`assets/${avatar}`, location.href).href;
    await updateProfile(user, { displayName: name, photoURL });
    await submitRequest({ user, name, email, office, method: 'email' });
    toast.close();
    requestSubmitted(name);
  } catch (error) {
    toast.close();
    button.disabled = false;
    const messages = {
      'auth/email-already-in-use': ['su-email', 'Email address already used.'],
      'auth/invalid-email': ['su-email', 'Please enter a valid email address.'],
      'auth/weak-password': ['su-password', 'Your password is too weak.']
    };
    const [field, message] = messages[error.code] || ['su-email', 'Sign up failed. Please try again.'];
    showFieldError(field, message);
  }
}

// ---------- Google sign in / sign up ----------
const GOOGLE_ERRORS = {
  'auth/popup-blocked': 'The sign in popup was blocked by your browser. Please allow popups and try again.',
  'auth/user-disabled': 'This account has been deactivated. Please contact the Super Admin.',
  'auth/network-request-failed': 'No internet connection. Please check your network.',
  'auth/unauthorized-domain': 'This domain is not authorized. Please contact support.',
  'auth/account-exists-with-different-credential': 'An account already exists with this email using a different provider. Please sign in with email/password first to link accounts.'
};
let pendingGoogleUser = null;

async function handleGoogle() {
  const signUp = wrapper.classList.contains('signup-mode');
  if (signUp && !AdminAgreement.isAgreed() && !(await AdminAgreement.open('terms'))) return;

  googleProvider.setCustomParameters({ prompt: 'select_account' });
  let result;
  try {
    result = await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'].includes(error.code)) return;
    toast.error(signUp ? 'Google Sign Up Failed' : 'Google Sign In Failed', GOOGLE_ERRORS[error.code] || 'Something went wrong. Please try again.');
    return;
  }

  toast.loading(signUp ? 'Signing Up...' : 'Signing In...', 'Please wait for a moment.');
  try {
    const user = result.user;
    const [citizen, adminSnap] = await Promise.all([getDoc(doc(db, 'users', user.uid)), getDoc(doc(db, 'admin', user.uid))]);
    if (citizen.exists()) {
      await signOut(auth);
      return toast.error(signUp ? 'Sign Up Error' : 'Sign In Error', 'This email address cannot be used.');
    }
    if (signUp) {
      if (adminSnap.exists()) {
        await signOut(auth);
        return toast.error('Already Signed In', 'This Google account is already signed in as an admin. Please continue in sign in instead.');
      }
      toast.close();
      return openGoogleProfile(user);
    }
    if (!adminSnap.exists()) {
      await signOut(auth);
      return toast.error('Account Not Found', 'Google account invalid or not used to create an account yet.');
    }
    const status = adminSnap.data().status;
    if (status !== 'active') {
      await signOut(auth);
      return status === 'deactivated'
        ? toast.error('Account Deactivated', 'This account has been deactivated. Please contact the Super Admin.')
        : toast.error('Pending Approval', 'Your account is still awaiting Super Admin approval.');
    }
    await setDoc(doc(db, 'admin', user.uid), { sign_in_method: 'google', updatedAt: serverTimestamp() }, { merge: true });
    await enterApp(user);
  } catch (error) {
    toast.error(signUp ? 'Google Sign Up Failed' : 'Google Sign In Failed', GOOGLE_ERRORS[error.code] || 'Something went wrong. Please try again.');
  }
}

function openGoogleProfile(user) {
  pendingGoogleUser = user;
  loadOfficeOptions();
  $('#gs-name').value = user.displayName || '';
  $('#gs-office').value = '';
  ['gs-name', 'gs-office'].forEach((id) => {
    fieldWrap(id)?.classList.remove('has-error');
    $(`#err-${id}`).textContent = '';
  });
  $('#gsignup-modal').classList.add('show');
}

async function cancelGoogleProfile() {
  $('#gsignup-modal').classList.remove('show');
  try {
    if (pendingGoogleUser) await deleteUser(pendingGoogleUser); // remove the unfinished login
  } catch (error) {
    console.error('[login] could not remove the cancelled Google sign-up:', error);
    await signOut(auth).catch(() => {});
  }
  pendingGoogleUser = null;
}

async function confirmGoogleProfile() {
  if (!pendingGoogleUser) return;
  const name = value('gs-name');
  const office = $('#gs-office').value;
  if (!name) { fieldWrap('gs-name')?.classList.add('has-error'); $('#err-gs-name').textContent = 'Please enter your full name.'; }
  if (!office) { fieldWrap('gs-office')?.classList.add('has-error'); $('#err-gs-office').textContent = 'Please select an office.'; }
  if (!name || !office) return;

  const button = $('#gs-confirm-btn');
  button.disabled = true;
  button.textContent = 'Submitting...';
  try {
    await updateProfile(pendingGoogleUser, { displayName: name });
    await submitRequest({ user: pendingGoogleUser, name, email: pendingGoogleUser.email, office, method: 'google' });
    $('#gsignup-modal').classList.remove('show');
    pendingGoogleUser = null;
    requestSubmitted(name);
  } catch (error) {
    console.error('[login] Google sign-up failed:', error);
    $('#err-gs-office').textContent = 'Something went wrong. Please try again.';
  } finally {
    button.disabled = false;
    button.textContent = 'Confirm & Submit';
  }
}

// ---------- forgot password (checked by the server) ----------
const RESEND_SECONDS = 60;
let recoveryEmail = '';
let verifiedCode = '';
let resendTimer = null;

function startResendTimer(seconds = RESEND_SECONDS) {
  const btn = $('#btn-resend');
  let left = seconds;
  btn.disabled = true;
  render(btn, html`Resend Code (<span id="resend-timer">${left}</span>s)`);
  clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    left -= 1;
    const timer = $('#resend-timer');
    if (timer) timer.textContent = left;
    if (left <= 0) {
      clearInterval(resendTimer);
      btn.disabled = false;
      btn.textContent = 'Resend Code';
    }
  }, 1000);
}

function recoveryError(error, field) {
  if (error.code === 'resource-exhausted' && error.details && error.details.retryAfterSeconds) {
    showFieldError(field, error.message);
    return;
  }
  showFieldError(field, error.message || 'Something went wrong. Please try again.');
}

async function handleSendCode() {
  clearFieldError('recovery-email');
  const email = value('recovery-email');
  if (!email) return showFieldError('recovery-email', 'Please fill the required field.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showFieldError('recovery-email', 'Please enter a valid email address.');

  toast.loading('Sending Code...', 'Checking your account and emailing a verification code.');
  try {
    const result = await recovery.sendCode(email);
    recoveryEmail = email;
    toast.close();
    $('#recovery-code').value = '';
    await toast.success('Verification Code Sent', 'A verification code has been sent to your registered email address.');
    go('recoverycode', { keepValues: true, instant: true });
    startResendTimer(result.resendAfterSeconds || RESEND_SECONDS);
  } catch (error) {
    toast.close();
    recoveryError(error, 'recovery-email');
  }
}

async function handleVerifyCode() {
  clearFieldError('recovery-code');
  const code = value('recovery-code');
  if (!code) return showFieldError('recovery-code', 'Please enter the 6-digit code.');
  toast.loading('Verifying...', 'Checking your code.');
  try {
    await recovery.verifyCode(recoveryEmail, code);
    verifiedCode = code;
    toast.close();
    await toast.success('Verified', 'Your recovery code has been verified successfully.');
    go('resetpass', { keepValues: true, instant: true });
  } catch (error) {
    toast.close();
    recoveryError(error, 'recovery-code');
  }
}

async function handleResendCode() {
  toast.loading('Resending Code...', 'Sending a new verification code.');
  try {
    const result = await recovery.sendCode(recoveryEmail);
    toast.close();
    toast.success('Code Resent', 'A new recovery code has been sent to your email address.', { button: 'OK' });
    startResendTimer(result.resendAfterSeconds || RESEND_SECONDS);
  } catch (error) {
    toast.close();
    recoveryError(error, 'recovery-code');
    if (error.details && error.details.retryAfterSeconds) startResendTimer(error.details.retryAfterSeconds);
  }
}

async function handleResetPassword() {
  clearFieldError('new-password');
  clearFieldError('confirm-new-password');
  const pw = $('#new-password').value;
  const cpw = $('#confirm-new-password').value;
  if (!pw) showFieldError('new-password', 'Please fill the required field.');
  if (!cpw) showFieldError('confirm-new-password', 'Please fill the required field.');
  if (!pw || !cpw) return;
  if (!checkPassword(pw).ok) return showFieldError('new-password', 'Please meet all the password requirements.');
  if (pw !== cpw) return showFieldError('confirm-new-password', 'Passwords do not match. Please try again.');
  if (!recoveryEmail || !verifiedCode) {
    toast.error('Session Expired', 'Your session has expired. Please start the password reset process again.');
    return go('forgotpass');
  }
  if (!(await confirm({ type: 'info', title: 'Confirm Password Change', msg: 'Are you sure you want to save your new password?', confirmText: 'Yes, Save' }))) return;

  toast.loading('Resetting Password...', 'Saving your new password.');
  try {
    await recovery.resetPassword(recoveryEmail, verifiedCode, pw);
    recoveryEmail = '';
    verifiedCode = '';
    toast.close();
    await toast.success('Password Reset!', 'Your password has been changed successfully. Please sign in with your new password.', { button: 'Sign In' });
    go('signin');
  } catch (error) {
    toast.close();
    toast.error('Reset Failed', error.message || 'Something went wrong while resetting your password. Please try again later.');
  }
}

// ---------- wiring ----------
const ACTIONS = {
  'sign-in': handleSignIn,
  'sign-up': handleSignUp,
  google: handleGoogle,
  'google-cancel': cancelGoogleProfile,
  'google-confirm': confirmGoogleProfile,
  'send-code': handleSendCode,
  'verify-code': handleVerifyCode,
  'resend-code': handleResendCode,
  'reset-password': handleResetPassword
};
on(document, 'click', '[data-action]', (e, btn) => {
  const run = ACTIONS[btn.dataset.action];
  if (run) {
    e.preventDefault();
    run();
  }
});

// Enter submits the visible form
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
  const id = e.target.id;
  if (SIGN_IN_FIELDS.includes(id) && !$('#sign-in-btn').disabled) handleSignIn();
  else if (id === 'recovery-email') handleSendCode();
  else if (id === 'recovery-code') handleVerifyCode();
  else if (id === 'confirm-new-password' || id === 'new-password') handleResetPassword();
});

if (new URLSearchParams(location.search).get('accountDeleted') === 'true') {
  history.replaceState({}, document.title, location.pathname);
  toast.success('Account Deleted', 'Your admin account has been permanently deleted.', { button: 'OK' });
}

// Already signed in as an active admin? Go straight to the dashboard.
const stopWatching = onAuthStateChanged(auth, async (user) => {
  stopWatching();
  if (!user || pendingGoogleUser) return;
  try {
    const session = await loadSession(user);
    if (session && session.status === 'active') {
      shell.saveSession(session);
      location.replace('dashboard.html');
    } else {
      await signOut(auth);
    }
  } catch {
    /* stay on the login page */
  }
});

refreshButtons();
