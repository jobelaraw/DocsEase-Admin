// Profile menu in the top bar: dropdown, Edit Profile, Delete Account, Sign Out.
// The button itself is drawn by js/shell.js; this module adds the behavior.
import { auth, db, googleProvider } from '../core/firebase.js';
import { getSession, signOut } from '../core/session.js';
import {
  updateProfile, EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, deleteUser
} from '../core/sdk/auth.js';
import { doc, updateDoc, deleteDoc, collection, getDocs, writeBatch, serverTimestamp } from '../core/sdk/firestore.js';
import { html, render, $, $$, on } from '../core/dom.js';
import { openModal } from './modal.js';
import { toast, confirm } from './toast.js';

const shell = window.GaBayan;
let dropdown = null;

function closeDropdown() {
  if (!dropdown) return;
  dropdown.remove();
  dropdown = null;
  $$('[data-profile-toggle]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

function openDropdown(button) {
  closeDropdown();
  dropdown = document.createElement('div');
  dropdown.className = 'profile-dropdown';
  dropdown.setAttribute('role', 'menu');
  render(dropdown, html`
    <button type="button" class="dd-item" role="menuitem" data-profile-action="edit">Edit Profile</button>
    <div class="dd-divider"></div>
    <button type="button" class="dd-item logout" role="menuitem" data-profile-action="signout">Sign Out</button>`);
  button.parentElement.appendChild(dropdown);
  button.setAttribute('aria-expanded', 'true');
}

on(document, 'click', '[data-profile-toggle]', (event, button) => {
  event.stopPropagation();
  if (dropdown) closeDropdown();
  else openDropdown(button);
});

on(document, 'click', '[data-profile-action]', (event, item) => {
  event.stopPropagation();
  const action = item.dataset.profileAction;
  closeDropdown();
  if (action === 'edit') openEditProfile();
  if (action === 'signout') confirmSignOut();
});

// Clicking anywhere outside the profile area closes the menu
document.addEventListener('click', (e) => {
  if (!e.target.closest('.topbar-profile')) closeDropdown();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDropdown(); });

async function confirmSignOut() {
  const ok = await confirm({ type: 'warning', title: 'Sign out?', msg: 'Are you sure you want to sign out?', confirmText: 'Yes, Sign Out', cancelText: 'No' });
  if (ok) await signOut();
}

// ---------- Edit Profile ----------
const fileOf = (url) => String(url || '').split('/').pop().split('?')[0] || 'user_profile.png';

function openEditProfile() {
  const session = getSession();
  const user = auth.currentUser;
  if (!session || !user) return;

  const initialName = user.displayName || session.name || '';
  const initialAvatar = fileOf(user.photoURL) || 'user_profile.png';
  let selectedAvatar = initialAvatar;

  const dialog = openModal({
    title: 'Edit Profile',
    size: 'sm',
    body: html`
      <div class="profile-avatar-large"><img data-current-avatar src="${shell.avatarSrc(user.photoURL)}" alt="Selected avatar" /></div>
      <div class="profile-email">${user.email || session.email}</div>
      ${session.role !== 'super_admin' && session.office ? html`<div class="profile-office">${session.office}</div>` : ''}
      <div class="avatar-grid" role="radiogroup" aria-label="Choose an avatar">
        ${shell.AVATARS.map((file) => html`
          <button type="button" class="avatar-option ${file === initialAvatar ? 'selected' : ''}" data-avatar="${file}" role="radio" aria-checked="${file === initialAvatar}">
            <img src="assets/${file}" alt="" />
          </button>`)}
      </div>
      <div class="field">
        <label for="profile-name">Full name</label>
        <input class="input" id="profile-name" type="text" value="${initialName}" placeholder="Enter your full name" maxlength="80" />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
        <button type="button" class="btn btn-primary" data-save disabled>Save Changes</button>
      </div>
      <hr class="modal-divider" />
      <div class="delete-prompt">Do you want to delete your admin account?<button type="button" data-delete-account>Delete Account</button></div>`,
    beforeClose: async (reason) => {
      if (reason === 'saved' || !hasChanges()) return true;
      return confirm({ type: 'warning', title: 'Unsaved Changes', msg: 'You have unsaved changes. Are you sure you want to leave without saving?', confirmText: 'Leave', cancelText: 'Stay' });
    }
  });

  const box = dialog.el;
  const nameInput = $('#profile-name', box);
  const saveBtn = $('[data-save]', box);

  function hasChanges() {
    return nameInput.value.trim() !== initialName || selectedAvatar !== initialAvatar;
  }

  function refresh() {
    saveBtn.disabled = !(hasChanges() && nameInput.value.trim());
  }

  on(box, 'click', '[data-avatar]', (e, option) => {
    selectedAvatar = option.dataset.avatar;
    $$('[data-avatar]', box).forEach((o) => {
      o.classList.toggle('selected', o === option);
      o.setAttribute('aria-checked', String(o === option));
    });
    $('[data-current-avatar]', box).src = `assets/${selectedAvatar}`;
    refresh();
  });
  nameInput.addEventListener('input', refresh);

  saveBtn.addEventListener('click', async () => {
    const newName = nameInput.value.trim();
    if (!newName) return;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      const photoURL = new URL(`assets/${selectedAvatar}`, location.href).href;
      await updateProfile(auth.currentUser, { displayName: newName, photoURL });
      await updateDoc(doc(db, 'admin', auth.currentUser.uid), { full_name: newName, updatedAt: serverTimestamp() });
      shell.applySession({ ...getSession(), name: newName, photoURL, savedAt: Date.now() });
      await dialog.close('saved');
      toast.success('Profile Updated', 'Your changes have been saved.', { button: 'OK' });
    } catch (error) {
      console.error('[profile] update failed:', error);
      toast.error('Update Failed', 'Could not update profile.', { button: 'OK' });
      saveBtn.textContent = 'Save Changes';
      refresh();
    }
  });

  $('[data-delete-account]', box).addEventListener('click', async () => {
    const ok = await confirm({
      type: 'error',
      title: 'Delete Account?',
      msg: 'This action is irreversible. You will lose your credentials and completely delete your admin account.',
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    await dialog.close('force');
    openDeleteAccount();
  });
}

// ---------- Delete Account: verify identity -> final warning -> delete ----------
const AUTH_ERRORS = {
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-credential': 'Incorrect password.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Please check your internet connection.',
  'auth/user-mismatch': 'Please choose the Google account you are signed in with.',
  'auth/popup-closed-by-user': 'Verification was cancelled.',
  'auth/cancelled-popup-request': 'Verification was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the Google popup. Please allow popups and try again.'
};

function openDeleteAccount() {
  const user = auth.currentUser;
  if (!user) return;
  const usesPassword = user.providerData.some((p) => p.providerId === 'password');
  let busy = false;

  const dialog = openModal({
    title: 'Confirm Your Identity',
    size: 'sm',
    beforeClose: () => !busy,
    body: html`
      <div data-step="auth">
        <p class="modal-text">For your security, please verify your identity before deleting your admin account.</p>
        ${usesPassword ? html`
          <div class="field">
            <label for="del-password">Password</label>
            <div class="password-wrap">
              <input class="input" id="del-password" type="password" placeholder="Enter your password" autocomplete="current-password" autofocus />
              <button type="button" class="password-eye" data-eye aria-label="Show password"><img src="assets/eyeHide.svg" alt="" /></button>
            </div>
          </div>` : html`<p class="modal-text">This account signs in with Google. Click continue and choose the same Google account to verify it's you.</p>`}
        <div class="modal-error" data-error></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
          <button type="button" class="btn btn-primary" data-verify>Continue</button>
        </div>
      </div>
      <div data-step="final" hidden>
        <p class="modal-text">Once you confirm, your admin account and all associated data will be permanently deleted. <strong>This cannot be undone.</strong></p>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
          <button type="button" class="btn btn-danger" data-confirm-delete>Confirm Delete</button>
        </div>
      </div>
      <div data-step="progress" hidden style="text-align:center">
        <div class="del-spinner"></div>
        <strong>Deletion in progress</strong>
        <p class="modal-text">Please wait while we delete your account. Do not close this page.</p>
      </div>`
  });

  const box = dialog.el;
  const setError = (msg) => { $('[data-error]', box).textContent = msg || ''; };
  const step = (name) => {
    $$('[data-step]', box).forEach((s) => { s.hidden = s.dataset.step !== name; });
    $('.modal-title', box).textContent = name === 'final' ? 'Delete Permanently?' : name === 'progress' ? 'Deleting Account' : 'Confirm Your Identity';
  };

  const eye = $('[data-eye]', box);
  if (eye) {
    eye.addEventListener('click', () => {
      const input = $('#del-password', box);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eye.querySelector('img').src = show ? 'assets/eyeShow.svg' : 'assets/eyeHide.svg';
      eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
    $('#del-password', box).addEventListener('keydown', (e) => { if (e.key === 'Enter') $('[data-verify]', box).click(); });
  }

  $('[data-verify]', box).addEventListener('click', async (e) => {
    if (busy) return;
    const button = e.currentTarget;
    const password = usesPassword ? $('#del-password', box).value : '';
    if (usesPassword && !password) return setError('Please enter your password.');
    busy = true;
    button.disabled = true;
    button.textContent = 'Verifying...';
    setError('');
    try {
      if (usesPassword) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      else await reauthenticateWithPopup(user, googleProvider);
      step('final');
    } catch (error) {
      setError(AUTH_ERRORS[error.code] || 'Verification failed. Please try again.');
    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = 'Continue';
    }
  });

  $('[data-confirm-delete]', box).addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    step('progress');
    try {
      const logs = await getDocs(collection(db, 'admin', user.uid, 'activity_logs'));
      for (let i = 0; i < logs.docs.length; i += 400) {
        const batch = writeBatch(db);
        logs.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, 'admin', user.uid));
      await deleteUser(user);
      await signOut({ redirect: false });
      location.replace('login.html?accountDeleted=true');
    } catch (error) {
      console.error('[profile] delete failed:', error);
      busy = false;
      if (error.code === 'auth/requires-recent-login') {
        step('auth');
        setError('Your verification expired. Please confirm your identity again.');
      } else {
        await dialog.close('force');
        toast.error('Delete Failed', error.code === 'permission-denied'
          ? 'Missing permission to delete your admin record.'
          : 'Failed to delete account. Please try again.', { button: 'OK' });
      }
    }
  });
}

