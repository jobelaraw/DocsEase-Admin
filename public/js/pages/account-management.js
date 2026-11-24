// Account Management (Super Admin): mobile users and web admins, with
// deactivate / reactivate. Lists come from adminApi.listAccounts (it merges the
// Firebase Auth login times, which the browser cannot read).
import { startPage } from '../core/page.js';
import { html, render, $, $$, on, debounce } from '../core/dom.js';
import { api } from '../core/api.js';
import { cached, writeCache, onTabReturn } from '../core/cache.js';
import { logActivity } from '../core/activity-log.js';
import { formatDate } from '../core/dates.js';
import { toast } from '../components/toast.js';
import { openModal } from '../components/modal.js';

const INACTIVE_DAYS = 90;
const DAY_MS = 86400000;
const STATUS_LABEL = { active: 'Active', inactive: 'Inactive', deactivated: 'Deactivated', pending: 'Pending' };

const list = $('#accounts');
const state = {
  section: 'users',               // users | admins
  status: 'all',
  query: '',
  selfUid: null,
  data: { users: null, admins: null },
  failed: { users: null, admins: null }
};

$('#inactive-hint').textContent = `Inactive = no login or app activity in the last ${INACTIVE_DAYS} days.`;

// Deactivated > Pending (admins) > Inactive (no activity for 90 days) > Active
function withStatus(acct) {
  let computed;
  if (acct.status === 'deactivated' || acct.disabled) computed = 'deactivated';
  else if (acct.status === 'pending') computed = 'pending';
  else {
    const lastSeen = acct.lastActive || acct.createdAt;
    computed = lastSeen && Date.now() - lastSeen > INACTIVE_DAYS * DAY_MS ? 'inactive' : 'active';
  }
  return { ...acct, computed };
}

function relative(ms) {
  if (!ms) return 'Never';
  const days = Math.floor((Date.now() - ms) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDate(ms);
}

const isAdmins = () => state.section === 'admins';

function skeletonRows(count = 6) {
  return html`${Array.from({ length: count }, (_, i) => html`
    <div class="acct-row ${isAdmins() ? 'is-admins' : ''}" aria-hidden="true">
      <div class="acct-person">
        <span class="skel skel-circle" style="width:36px;height:36px"></span>
        <div class="skel-stack" style="flex:1;gap:6px"><span class="skel skel-text" style="width:${[60, 75, 50, 70, 55, 65][i]}%"></span><span class="skel skel-text" style="width:80%;height:10px"></span></div>
      </div>
      ${isAdmins() ? html`<span class="skel skel-text" style="width:75%"></span>` : ''}
      <span class="skel skel-text" style="width:70%"></span>
      <span class="skel skel-text" style="width:55%"></span>
      <span class="skel skel-pill" style="width:72px;height:22px"></span>
      <span class="skel skel-pill" style="width:120px;justify-self:end"></span>
    </div>`)}`;
}

function actionsFor(a) {
  if (a.uid === state.selfUid) return html`<span class="acct-note">You</span>`;
  if (a.role === 'super_admin') return html`<span class="acct-note">Super Admin</span>`;
  if (a.computed === 'pending') return html`<a class="acct-note" href="review-queue.html">Review Queue</a>`;
  return a.computed === 'deactivated'
    ? html`<button type="button" class="btn-row btn-reactivate" data-action="reactivate" data-uid="${a.uid}">Reactivate</button>`
    : html`<button type="button" class="btn-row btn-deactivate" data-action="deactivate" data-uid="${a.uid}">Deactivate</button>`;
}

function row(a) {
  const initials = (a.name || a.email || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const deactivated = a.computed === 'deactivated' && a.deactivatedAt
    ? `Deactivated ${formatDate(a.deactivatedAt)}${a.deactivatedBy ? ` by ${a.deactivatedBy}` : ''}${a.deactivationReason ? ` · ${a.deactivationReason}` : ''}`
    : '';
  return html`
    <div class="acct-row ${isAdmins() ? 'is-admins' : ''}">
      <div class="acct-person">
        <div class="acct-avatar" aria-hidden="true">${initials}</div>
        <div class="acct-person-text">
          <span class="acct-name">${a.name || 'Unnamed account'}</span>
          <span class="acct-sub">${a.email || 'No email'}</span>
          ${deactivated ? html`<span class="acct-sub">${deactivated}</span>` : ''}
        </div>
      </div>
      ${isAdmins() ? html`<div class="acct-cell" data-label="Office">${a.office || '—'}</div>` : ''}
      <div class="acct-cell" data-label="Registered">${formatDate(a.createdAt)}</div>
      <div class="acct-cell" data-label="Last login" title="${a.lastActive ? new Date(a.lastActive).toLocaleString() : ''}">${relative(a.lastActive)}</div>
      <div class="acct-cell" data-label="Status"><span class="status-badge status-${a.computed}">${STATUS_LABEL[a.computed]}</span></div>
      <div class="acct-actions">${actionsFor(a)}</div>
    </div>`;
}

function draw() {
  $$('[data-section]').forEach((b) => {
    b.classList.toggle('active', b.dataset.section === state.section);
    b.setAttribute('aria-selected', String(b.dataset.section === state.section));
  });
  ['users', 'admins'].forEach((s) => { $(`#count-${s}`).textContent = state.data[s] ? state.data[s].length : '–'; });

  const accounts = state.data[state.section];
  const counts = { all: 0, active: 0, inactive: 0, deactivated: 0, pending: 0 };
  (accounts || []).forEach((a) => { counts.all++; counts[a.computed]++; });
  const statuses = isAdmins() ? ['all', 'active', 'inactive', 'deactivated', 'pending'] : ['all', 'active', 'inactive', 'deactivated'];
  render($('#status-tabs'), html`${statuses.map((s) => html`
    <button type="button" class="tab ${s === state.status ? 'active' : ''}" data-status="${s}" role="tab" aria-selected="${s === state.status}">
      ${s === 'all' ? 'All' : STATUS_LABEL[s]}${accounts ? html` <span class="tab-count">${counts[s]}</span>` : ''}
    </button>`)}`);

  const head = $('#table-head');
  head.className = `acct-table-head ${isAdmins() ? 'is-admins' : ''}`;
  render(head, html`<span>Name</span>${isAdmins() ? html`<span>Office</span>` : ''}<span>Registered</span><span>Last Login</span><span>Status</span><span class="col-actions">Actions</span>`);

  if (state.failed[state.section]) {
    list.removeAttribute('aria-busy');
    return render(list, html`<p class="empty-state">Could not load accounts. ${state.failed[state.section]}</p>`);
  }
  if (!accounts) {
    list.setAttribute('aria-busy', 'true');
    return render(list, skeletonRows());
  }
  list.removeAttribute('aria-busy');
  const rows = accounts
    .filter((a) => state.status === 'all' || a.computed === state.status)
    .filter((a) => !state.query || [a.name, a.email, a.office].some((v) => String(v || '').toLowerCase().includes(state.query)))
    .sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email)));
  if (!rows.length) return render(list, html`<p class="empty-state">${state.query ? 'No accounts match your search.' : 'No accounts in this list.'}</p>`);
  render(list, html`${rows.map(row)}`);
}

// Lists hold names and emails: cached for this browser tab only. Downloaded again
// when an account changes (server version check), and every 10 minutes for
// "Last login"/"Last active", which come from Firebase Auth and bump no version.
const CACHE = { maxAgeMs: 10 * 60 * 1000, personal: true };

async function load(section) {
  state.failed[section] = null;
  try {
    await cached(`accounts:${section}`, (version) => api.listAccounts(section, version), (result) => {
      state.data[section] = result.accounts.map(withStatus);
      state.selfUid = result.selfUid;
      draw();
    }, CACHE);
  } catch (error) {
    console.error('[accounts] could not load:', error);
    state.failed[section] = error.message;
    draw();
  }
}

// Keeps the saved copy in step with changes made on this page
function saveSection(section) {
  writeCache(`accounts:${section}`, { accounts: state.data[section], selfUid: state.selfUid }, CACHE);
}

// ---------- deactivate / reactivate ----------
function openStatusDialog(acct, action) {
  const user = state.section === 'users';
  const who = user ? 'mobile user' : 'admin';
  const deactivate = action === 'deactivate';
  const points = deactivate ? [
    html`This ${who} will be signed out and <strong>can no longer sign in</strong> to ${user ? 'the GaBayan mobile app' : 'the GaBayan web admin'}.`,
    html`Their account record and history are <strong>kept</strong>, not deleted.`,
    html`You can reactivate the account at any time from the Deactivated tab.`
  ] : [
    html`This ${who} will be able to <strong>sign in again</strong> with their existing credentials.`,
    user ? html`Their previous data and history are restored as they were.` : html`They will regain access to ${acct.office || 'their office'} only.`
  ];
  const section = state.section;
  const dialog = openModal({
    title: deactivate ? 'Deactivate account?' : 'Reactivate account?',
    size: 'sectioned',
    body: html`
      <div class="modal-scroll">
        <div class="status-target">
          <span class="acct-name">${acct.name || 'Unnamed account'}</span>
          <span class="acct-sub">${acct.email}${acct.office ? ` · ${acct.office}` : ''}</span>
          <span class="status-badge status-${acct.computed}">${STATUS_LABEL[acct.computed]}</span>
        </div>
        <ul class="status-explain">${points.map((p) => html`<li>${p}</li>`)}</ul>
        ${deactivate ? html`
          <div class="field">
            <label for="status-reason">Reason <span class="label-hint">(optional, kept with the record)</span></label>
            <textarea class="textarea" id="status-reason" rows="3" maxlength="500" placeholder="e.g. No activity for over 90 days">${acct.computed === 'inactive' ? `No activity for over ${INACTIVE_DAYS} days` : ''}</textarea>
          </div>` : ''}
        <p class="field-error" data-error role="alert"></p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
        <button type="button" class="btn ${deactivate ? 'btn-danger' : 'btn-primary'}" data-submit>${deactivate ? 'Deactivate' : 'Reactivate'}</button>
      </div>`
  });

  const submit = $('[data-submit]', dialog.el);
  submit.addEventListener('click', async () => {
    const label = submit.textContent;
    submit.disabled = true;
    submit.textContent = deactivate ? 'Deactivating…' : 'Reactivating…';
    try {
      const reason = deactivate ? $('#status-reason', dialog.el).value : '';
      const result = await api.setAccountStatus(section, acct.uid, action, reason);
      // Update the row in place instead of downloading the whole list again
      Object.assign(acct, deactivate
        ? { status: 'deactivated', disabled: true, deactivatedAt: Date.now(), deactivationReason: reason.trim(), deactivatedBy: 'You' }
        : { status: result.status || 'active', disabled: false, deactivatedAt: null, deactivationReason: '', deactivatedBy: '' });
      Object.assign(acct, withStatus(acct));
      saveSection(section);
      await dialog.close('force');
      draw();
      toast.success(deactivate ? 'Account Deactivated' : 'Account Reactivated', `${acct.name || acct.email} has been ${deactivate ? 'deactivated' : 'reactivated'}.`, { button: 'OK' });
      logActivity(`${section === 'admins' ? 'admin' : 'user'}_account_${action}d`, {
        target_name: acct.name || acct.email,
        target_uid: acct.uid,
        office_name: section === 'admins' ? acct.office : ''
      });
    } catch (error) {
      $('[data-error]', dialog.el).textContent = error.message;
      submit.disabled = false;
      submit.textContent = label;
    }
  });
}

// ---------- events ----------
on(document, 'click', '[data-section]', (e, btn) => {
  if (state.section === btn.dataset.section) return;
  state.section = btn.dataset.section;
  if (state.section === 'users' && state.status === 'pending') state.status = 'all';
  draw();
});
on($('#status-tabs'), 'click', '[data-status]', (e, btn) => {
  state.status = btn.dataset.status;
  draw();
});
$('#search').addEventListener('input', debounce((e) => {
  state.query = e.target.value.trim().toLowerCase();
  draw();
}, 150));
on(list, 'click', '[data-action]', (e, btn) => {
  const acct = (state.data[state.section] || []).find((a) => a.uid === btn.dataset.uid);
  if (acct) openStatusDialog(acct, btn.dataset.action);
});

draw();
await startPage({ superAdminOnly: true });
// Both lists load in parallel (one warm server instance answers both)
load('users');
load('admins');
onTabReturn(() => { load('users'); load('admins'); });
