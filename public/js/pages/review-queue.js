// Review Queue (Super Admin): pending requests, accepted history, Deleted Records.
import { startPage } from '../core/page.js';
import { html, render, $, $$, on, debounce } from '../core/dom.js';
import { api } from '../core/api.js';
import { cached, writeCache, forgetCache, onTabReturn } from '../core/cache.js';
import { logActivity } from '../core/activity-log.js';
import { toDate, timeAgo, formatDate, periodStart, daysUntil } from '../core/dates.js';
import { TRASH_RETENTION_DAYS } from '../core/constants.js';
import { sendRegistrationEmail, sendRequestCompleted } from '../core/email.js';
import { toast, confirm, promptMatch } from '../components/toast.js';
import {
  watchPendingRequests, watchCompletedRequests, acceptAdminAccount, acceptAdminDeletion,
  declineRequest, adminEmail, HISTORY_LIMIT
} from '../data/requests.js';

const shell = window.GaBayan;
const grid = $('#grid');
const search = $('#search');

const TYPE_LABELS = {
  new_admin: { pending: 'Pending Admin Account', completed: 'Completed Admin Account' },
  delete_admin: { pending: 'Pending Admin Deleted Account', completed: 'Completed Admin Deleted Account' },
  delete_service: { pending: 'Pending Deleted Service', completed: 'Completed Deleted Service' }
};

const state = {
  tab: 'pending',        // pending | completed | deleted
  range: 'today',        // today | week | earlier (requests only)
  type: 'all',           // request type filter
  kind: 'all',           // all | office | service (Deleted Records)
  query: '',
  pending: null,         // live list
  completed: null,       // live slice for the chosen range
  deleted: null,         // { offices, services, retentionDays } once loaded
  deletedState: 'idle',  // idle | loading | ready | error
  busy: new Set()        // keys with an action in progress
};
let session = null;
let stopCompleted = null;

function cardSkeleton() {
  return html`${[0, 1, 2].map(() => html`
    <div class="rq-card" aria-hidden="true">
      <div class="rq-card-top">
        <span class="skel skel-circle" style="width:40px;height:40px"></span>
        <div class="skel-stack" style="flex:1;gap:6px"><span class="skel skel-text" style="width:55%"></span><span class="skel skel-text" style="width:30%;height:10px"></span></div>
        <span class="skel" style="width:90px;height:24px;border-radius:10px"></span>
      </div>
      <div class="skel-stack"><span class="skel skel-text"></span><span class="skel skel-text" style="width:85%"></span></div>
      <span class="skel" style="height:38px;border-radius:6px"></span>
    </div>`)}`;
}
render(grid, cardSkeleton());

// ---------- requests ----------
function bucketOf(date) {
  if (!date) return 'earlier';
  if (date >= periodStart('today')) return 'today';
  if (date >= periodStart('week')) return 'week';
  return 'earlier';
}

function describe(req, done) {
  const svc = req.service_name ? `"${req.service_name}"` : 'a service';
  switch (req.type) {
    case 'new_admin':
      return done
        ? `The admin account for the ${req.office_name || 'office'} was accepted.`
        : `A new admin account for the ${req.office_name || 'office'} is waiting. Come and check it out.`;
    case 'delete_admin':
      return done
        ? `The request of ${req.requested_by_name || 'this admin'} to delete their own admin account was accepted.`
        : `${req.requested_by_name || 'This admin'} requested to delete their own admin account.`;
    case 'delete_service':
      return done
        ? `The request to delete ${svc} in the office ${req.office_name || ''} was accepted.`
        : `Requested to delete ${svc} in the office ${req.office_name || ''}, still waiting to accept request.`;
    default:
      return 'A new request is waiting for review.';
  }
}

function requestCard(req, done) {
  const date = toDate(done ? req.resolvedAt : req.createdAt);
  const name = req.requested_by_name || 'Unknown';
  return html`
    <div class="rq-card">
      <div class="rq-card-top">
        <div class="rq-avatar" aria-hidden="true">${name.charAt(0).toUpperCase()}</div>
        <div class="rq-card-who"><div class="rq-name">${name}</div><div class="rq-role">Admin</div></div>
        <div class="rq-card-meta">
          <div class="rq-time">${timeAgo(date)}</div>
          <span class="rq-status ${done ? 'completed' : 'pending'}">${done ? 'Completed' : 'Pending'}</span>
        </div>
      </div>
      <div class="rq-card-desc">${describe(req, done)}</div>
      <div class="rq-office">
        <span>${req.office_name || 'No office'}</span>
        ${done ? html`<button type="button" class="btn-delete-record" data-action="delete-record" data-id="${req.id}" title="Delete this record" aria-label="Delete this record"><img src="assets/delete.svg" alt="" /></button>` : ''}
      </div>
      ${done ? '' : html`
        <div class="rq-actions">
          <button type="button" class="rq-btn decline" data-action="decline" data-id="${req.id}" ${state.busy.has(req.id) ? 'disabled' : ''}>Decline</button>
          <button type="button" class="rq-btn accept" data-action="accept" data-id="${req.id}" ${state.busy.has(req.id) ? 'disabled' : ''}>Accept</button>
        </div>`}
    </div>`;
}

function matches(req, status) {
  if (!state.query) return true;
  return [req.requested_by_name, req.requested_by_email, req.office_name, req.service_name, req.resolvedBy_name, TYPE_LABELS[req.type]?.[status]]
    .some((v) => String(v || '').toLowerCase().includes(state.query));
}

function drawRequests() {
  const done = state.tab === 'completed';
  const status = done ? 'completed' : 'pending';
  const source = done ? state.completed : state.pending;
  if (!source) {
    grid.setAttribute('aria-busy', 'true');
    return render(grid, cardSkeleton());
  }
  grid.removeAttribute('aria-busy');
  let items = done ? source : source.filter((r) => (r.status || 'pending') === 'pending' && bucketOf(toDate(r.createdAt)) === state.range);
  if (state.type !== 'all') items = items.filter((r) => r.type === state.type);
  items = items.filter((r) => matches(r, status));
  if (!items.length) {
    return render(grid, html`<p class="empty-state">${state.query ? `No ${status} requests match "${search.value.trim()}".` : `No ${status} requests here.`}</p>`);
  }
  const capped = done && state.range === 'earlier' && source.length >= HISTORY_LIMIT;
  render(grid, html`${items.map((r) => requestCard(r, done))}${capped ? html`<p class="empty-state">Showing the latest ${HISTORY_LIMIT} older records.</p>` : ''}`);
}

// ---------- Deleted Records ----------
const KINDS = {
  service: {
    label: 'Service',
    restore: (r) => api.restoreService(r.officeId, r.serviceId),
    purge: (r, name) => api.purgeService(r.officeId, r.serviceId, name),
    restoredLog: 'service_restored',
    purgedLog: 'service_purged',
    logDetails: (r) => ({ office_name: r.officeName, service_name: r.name }),
    recoverMsg: (r) => `Recover "${r.name}" to ${r.officeName}? It will appear again in Service Management.`,
    recoverLoading: 'Restoring the service to its office.',
    recoveredMsg: (r) => `"${r.name}" is back in ${r.officeName}.`,
    purgeMsg: (r) => `"${r.name}" (${r.officeName}) and all of its saved data will be permanently deleted. This cannot be recovered.`,
    purgeLoading: 'Permanently deleting the service and its data.'
  },
  office: {
    label: 'Office',
    restore: (r) => api.restoreOffice(r.officeId),
    purge: (r, name) => api.purgeOffice(r.officeId, name),
    restoredLog: 'office_restored',
    purgedLog: 'office_purged',
    logDetails: (r) => ({ office_name: r.name }),
    recoverMsg: (r) => `Recover "${r.name}"? It will appear again in Service Management with all of its services.`,
    recoverLoading: 'Restoring the office and its services.',
    recoveredMsg: (r, data) => `"${r.name}" is back in Service Management with all of its services.${data.hadMapSlot && !data.mapSlotRestored ? ' Its map room is now used by another office, so place it again in Map Management.' : ''}`,
    purgeMsg: (r) => `"${r.name}", its ${countLabel(r.serviceCount)} and all of their saved data will be permanently deleted. This cannot be recovered.`,
    purgeLoading: 'Permanently deleting the office, its services and all of their data.'
  }
};
const countLabel = (n) => (n === 1 ? '1 service' : `${n || 0} services`);

// Deleted Records: cached for this browser tab; downloaded again only when the
// trash changed (server version check) and right after this admin's own actions.
const DELETED_CACHE = { personal: true };

function useDeleted(data) {
  state.deleted = [
      ...(data.offices || []).map((o) => ({ ...o, kind: 'office', key: `office:${o.officeId}`, name: o.officeName })),
      ...(data.services || []).map((s) => ({ ...s, kind: 'service', key: `service:${s.officeId}/${s.serviceId}`, name: s.serviceName }))
    ].sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  state.retentionDays = data.retentionDays || TRASH_RETENTION_DAYS;
  state.deletedState = 'ready';
  if (state.tab === 'deleted') draw();
}

async function loadDeleted({ force = false } = {}) {
  if (state.deletedState !== 'ready') state.deletedState = 'loading';
  if (state.tab === 'deleted') draw();
  try {
    await cached('deleted', (version) => api.listDeleted(version), useDeleted, { ...DELETED_CACHE, force });
  } catch (error) {
    console.error('[review-queue] could not load deleted records:', error);
    state.deletedState = 'error';
    if (state.tab === 'deleted') draw();
  }
}

// After recover / purge: the list on screen is already right, so save it as the cached copy.
function saveDeleted() {
  const offices = state.deleted.filter((r) => r.kind === 'office');
  const services = state.deleted.filter((r) => r.kind === 'service');
  writeCache('deleted', { offices, services, retentionDays: state.retentionDays }, DELETED_CACHE);
}

function deletedCard(r) {
  const kind = KINDS[r.kind];
  const isOffice = r.kind === 'office';
  const left = r.permanentDeleteAt ? Math.max(0, daysUntil(r.permanentDeleteAt)) : null;
  const leftLabel = left === null ? 'Deleted' : left === 0 ? 'Deletes today' : `${left} ${left === 1 ? 'day' : 'days'} left`;
  const blocked = !isOffice && r.officeDeleted; // can't recover into an office that is itself deleted
  const busy = state.busy.has(r.key);
  return html`
    <div class="rq-card">
      <div class="rq-card-top">
        <div class="rq-avatar is-deleted ${isOffice ? 'is-office' : ''}" aria-hidden="true">${(r.name || '?').charAt(0).toUpperCase()}</div>
        <div class="rq-card-who">
          <div class="rq-name">${r.name} <span class="rq-kind ${r.kind}">${kind.label}</span></div>
          <div class="rq-role">${r.requestedByName ? `Deletion requested by ${r.requestedByName}` : `Deleted by ${r.deletedByName || 'Super Admin'}`}</div>
        </div>
        <div class="rq-card-meta">
          <div class="rq-time">Deleted ${timeAgo(r.deletedAt ? new Date(r.deletedAt) : null)}</div>
          <span class="rq-status deleted ${left !== null && left <= 3 ? 'expiring' : ''}">${leftLabel}</span>
        </div>
      </div>
      <div class="rq-card-desc">
        Deleted on ${formatDate(r.deletedAt, '-')}. It will be permanently deleted on <strong>${formatDate(r.permanentDeleteAt, '-')}</strong> unless recovered.
        ${isOffice ? ` Includes ${countLabel(r.serviceCount)}, which will be recovered or deleted with it.` : blocked ? ' Its office is also in Deleted Records. Recover the office first.' : ''}
      </div>
      <div class="rq-office"><span>${r.officeName}</span></div>
      <div class="rq-actions">
        <button type="button" class="rq-btn purge" data-action="purge" data-key="${r.key}" ${busy ? 'disabled' : ''}><img src="assets/delete.svg" alt="" /> Delete Permanently</button>
        <button type="button" class="rq-btn recover" data-action="recover" data-key="${r.key}" ${busy || blocked ? 'disabled' : ''} ${blocked ? 'title="Recover the office first"' : ''}>Recover ${kind.label}</button>
      </div>
    </div>`;
}

function drawDeleted() {
  if (state.deletedState === 'idle' || state.deletedState === 'loading') {
    grid.setAttribute('aria-busy', 'true');
    return render(grid, cardSkeleton());
  }
  grid.removeAttribute('aria-busy');
  if (state.deletedState === 'error') {
    return render(grid, html`<p class="empty-state">Couldn't load deleted records. <button type="button" class="link-button" data-action="retry">Try again</button></p>`);
  }
  let items = state.deleted;
  if (state.kind !== 'all') items = items.filter((r) => r.kind === state.kind);
  if (state.query) {
    items = items.filter((r) => [r.name, r.officeName, r.requestedByName, r.deletedByName, KINDS[r.kind].label]
      .some((v) => String(v || '').toLowerCase().includes(state.query)));
  }
  if (!items.length) {
    const what = state.kind === 'office' ? 'offices' : state.kind === 'service' ? 'services' : 'offices or services';
    return render(grid, html`<p class="empty-state">${state.query
      ? `No deleted records match "${search.value.trim()}".`
      : `No deleted ${what}. Offices and services you delete will stay here for ${state.retentionDays || TRASH_RETENTION_DAYS} days.`}</p>`);
  }
  render(grid, html`${items.map(deletedCard)}`);
}

// ---------- tabs and filters ----------
function drawFilters() {
  const deleted = state.tab === 'deleted';
  const status = state.tab === 'completed' ? 'completed' : 'pending';
  const filters = deleted
    ? [['all', 'All'], ['office', 'Deleted Offices'], ['service', 'Deleted Services']]
    : [['all', 'All'], ...Object.entries(TYPE_LABELS).map(([type, labels]) => [type, labels[status]])];
  const active = deleted ? state.kind : state.type;
  render($('#type-filters'), html`${filters.map(([value, label]) => html`
    <button type="button" class="pill-filter ${value === active ? 'active' : ''}" data-filter="${value}" aria-pressed="${value === active}">${label}</button>`)}`);
  $('#date-filters').hidden = deleted;
  $('#banner-title').textContent = deleted ? 'Deleted Records' : 'Review Request';
  $('#banner-sub').textContent = deleted
    ? `Deleted offices and services are kept for ${state.retentionDays || TRASH_RETENTION_DAYS} days. Recover them or delete them permanently.`
    : 'Manage request, accept or decline request admin.';
  search.placeholder = deleted ? 'Search deleted records...' : 'Search requests...';
}

function draw() {
  if (state.tab === 'deleted') drawDeleted();
  else drawRequests();
}

function watchCompleted() {
  if (stopCompleted) stopCompleted();
  state.completed = null;
  stopCompleted = watchCompletedRequests(state.range, (list) => {
    state.completed = list;
    if (state.tab === 'completed') draw();
  }, (error) => {
    console.error('[review-queue] could not load completed requests:', error);
    state.completed = [];
    if (state.tab === 'completed') render(grid, html`<p class="empty-state">Couldn't load requests. Please refresh.</p>`);
  });
}

on(document, 'click', '[data-tab]', (e, tab) => {
  state.tab = tab.dataset.tab;
  $$('[data-tab]').forEach((t) => {
    t.classList.toggle('active', t === tab);
    t.setAttribute('aria-selected', String(t === tab));
  });
  if (state.tab === 'completed' && !stopCompleted) watchCompleted();
  if (state.tab === 'deleted' && state.deletedState !== 'loading') loadDeleted();
  drawFilters();
  draw();
});

on(document, 'click', '[data-range]', (e, chip) => {
  state.range = chip.dataset.range;
  $$('[data-range]').forEach((c) => {
    c.classList.toggle('active', c === chip);
    c.setAttribute('aria-pressed', String(c === chip));
  });
  if (stopCompleted) watchCompleted();
  draw();
});

on($('#type-filters'), 'click', '[data-filter]', (e, chip) => {
  if (state.tab === 'deleted') state.kind = chip.dataset.filter;
  else state.type = chip.dataset.filter;
  drawFilters();
  draw();
});

search.addEventListener('input', debounce(() => {
  state.query = search.value.trim().toLowerCase();
  draw();
}, 150));

// ---------- actions ----------
const findRequest = (id) => (state.pending || []).find((r) => r.id === id);
const findDeleted = (key) => (state.deleted || []).find((r) => r.key === key);

async function withBusy(key, work) {
  if (state.busy.has(key)) return;
  state.busy.add(key);
  draw();
  try {
    await work();
  } finally {
    state.busy.delete(key);
    draw();
  }
}

async function accept(req) {
  if (!(await confirm({ type: 'info', title: 'Accept Request', msg: 'Are you sure you want to accept this request?', confirmText: 'Yes, Accept' }))) return;
  await withBusy(req.id, async () => {
    toast.loading('Processing...', 'Applying the request.');
    try {
      let message = 'The request has been processed successfully.';
      if (req.type === 'new_admin') {
        await acceptAdminAccount(req, session);
        sendRegistrationEmail(req.requested_by_email, req.requested_by_name, req.office_name, 'accepted');
        message = 'The admin account is now active and can sign in.';
      } else if (req.type === 'delete_service') {
        await api.trashService(req.office_id, req.service_id, req.id);
        state.deletedState = 'idle'; // Deleted Records reloads next time it opens
        forgetCache('deleted', DELETED_CACHE);
        sendRequestCompleted(req.requested_by_email, req.requested_by_name, 'service deletion', true,
          [['Service', req.service_name], ['Office', req.office_name]]);
        message = `The service was moved to Deleted Records. It can be recovered within ${state.retentionDays || TRASH_RETENTION_DAYS} days.`;
      } else if (req.type === 'delete_admin') {
        const email = req.requested_by_email || (await adminEmail(req.target_admin_uid));
        await acceptAdminDeletion(req, session);
        let loginRemoved = true;
        if (req.target_admin_uid) loginRemoved = await api.deleteAuthUser(req.target_admin_uid).then(() => true, () => false);
        sendRequestCompleted(email, req.requested_by_name, 'account deletion', true, [['Email', email]]);
        if (!loginRemoved) message += ' The login account could not be removed automatically.';
      }
      const logType = { new_admin: 'admin_account_accepted', delete_service: 'service_delete_accepted' }[req.type];
      if (logType) {
        logActivity(logType, {
          office_name: req.office_name || '',
          service_name: req.service_name || '',
          target_name: req.requested_by_name || '',
          recipient_uid: req.requested_by_uid || req.target_admin_uid || ''
        });
      }
      forgetCache('accounts:admins', { personal: true });
      toast.success('Request Accepted', message, { button: 'OK' });
    } catch (error) {
      console.error('[review-queue] accept failed:', error);
      toast.error('Action Failed', `Could not process this request (${error.message || error.code}).`, { button: 'OK' });
    }
  });
}

async function decline(req) {
  if (!(await confirm({ type: 'warning', title: 'Decline Request', msg: 'This request will be permanently removed. Continue?', confirmText: 'Yes, Decline' }))) return;
  await withBusy(req.id, async () => {
    toast.loading('Declining...', 'Removing the request.');
    try {
      const email = req.requested_by_email || (req.type === 'delete_admin' ? await adminEmail(req.target_admin_uid) : '');
      let loginRemoved = true;
      if (req.type === 'new_admin' && req.target_admin_uid) loginRemoved = await api.deleteAuthUser(req.target_admin_uid).then(() => true, () => false);
      await declineRequest(req);
      const logType = { new_admin: 'admin_account_declined', delete_service: 'service_delete_declined' }[req.type];
      if (logType) {
        logActivity(logType, {
          office_name: req.office_name || '',
          service_name: req.service_name || '',
          target_name: req.requested_by_name || '',
          recipient_uid: req.type === 'delete_service' ? req.requested_by_uid || '' : ''
        });
      }
      if (req.type === 'new_admin') sendRegistrationEmail(email, req.requested_by_name, req.office_name, 'rejected');
      else if (req.type === 'delete_service') sendRequestCompleted(email, req.requested_by_name, 'service deletion', false, [['Service', req.service_name], ['Office', req.office_name]]);
      else if (req.type === 'delete_admin') sendRequestCompleted(email, req.requested_by_name, 'account deletion', false, [['Email', email]]);
      forgetCache('accounts:admins', { personal: true });
      toast.success('Request Declined', loginRemoved
        ? 'The request has been removed.'
        : 'The request was removed, but the login account could not be removed automatically.', { button: 'OK' });
    } catch (error) {
      console.error('[review-queue] decline failed:', error);
      toast.error('Action Failed', `Could not decline this request (${error.message || error.code}).`, { button: 'OK' });
    }
  });
}

async function deleteRecord(id) {
  if (!(await confirm({ type: 'warning', title: 'Delete Record', msg: 'This will permanently remove this record from history. This cannot be undone.', confirmText: 'Yes, Delete' }))) return;
  toast.loading('Deleting...', 'Removing the record.');
  try {
    await api.deleteCompletedRequest(id);
    toast.success('Deleted', 'The record has been removed.', { button: 'OK' });
  } catch (error) {
    toast.error('Delete Failed', `Could not delete this record (${error.message}).`, { button: 'OK' });
  }
}

async function recover(r) {
  const kind = KINDS[r.kind];
  if (!(await confirm({ type: 'info', title: `Recover ${kind.label}`, msg: kind.recoverMsg(r), confirmText: 'Yes, Recover' }))) return;
  await withBusy(r.key, async () => {
    toast.loading('Recovering...', kind.recoverLoading);
    try {
      const data = await kind.restore(r);
      state.deleted = state.deleted.filter((x) => x !== r);
      // Services inside a recovered office can be recovered again
      if (r.kind === 'office') state.deleted.forEach((x) => { if (x.kind === 'service' && x.officeId === r.officeId) x.officeDeleted = false; });
      saveDeleted();
      logActivity(kind.restoredLog, kind.logDetails(r));
      toast.success(`${kind.label} Recovered`, kind.recoveredMsg(r, data), { button: 'OK' });
    } catch (error) {
      toast.error('Recover Failed', error.message, { button: 'OK' });
      loadDeleted({ force: true });
    }
  });
}

async function purge(r) {
  const kind = KINDS[r.kind];
  if (!(await confirm({ type: 'warning', title: 'Delete Permanently?', msg: kind.purgeMsg(r), confirmText: 'Continue' }))) return;
  const noun = kind.label.toLowerCase();
  const name = String(r.name).trim();
  // Second step: type the name (checked again on the server)
  if (!(await promptMatch({ title: 'Confirm Permanent Deletion', msg: `Type "${name}" to confirm.`, expected: name, placeholder: `Type the ${noun} name`, confirmText: 'Delete Permanently' }))) return;
  await withBusy(r.key, async () => {
    toast.loading('Deleting...', kind.purgeLoading);
    try {
      await kind.purge(r, name);
      // Deleting an office also removed its deleted services
      state.deleted = state.deleted.filter((x) => x !== r && !(r.kind === 'office' && x.kind === 'service' && x.officeId === r.officeId));
      saveDeleted();
      logActivity(kind.purgedLog, kind.logDetails(r));
      toast.success('Permanently Deleted', `"${r.name}" has been permanently deleted.`, { button: 'OK' });
    } catch (error) {
      toast.error('Delete Failed', error.message, { button: 'OK' });
      loadDeleted({ force: true });
    }
  });
}

on(grid, 'click', '[data-action]', (e, btn) => {
  const { action, id, key } = btn.dataset;
  if (action === 'accept' && findRequest(id)) accept(findRequest(id));
  if (action === 'decline' && findRequest(id)) decline(findRequest(id));
  if (action === 'delete-record') deleteRecord(id);
  if (action === 'recover' && findDeleted(key)) recover(findDeleted(key));
  if (action === 'purge' && findDeleted(key)) purge(findDeleted(key));
  if (action === 'retry') loadDeleted({ force: true });
});

// ---------- start ----------
drawFilters();
session = await startPage({ superAdminOnly: true, badge: false });
onTabReturn(() => { if (state.tab === 'deleted' && state.deletedState !== 'loading') loadDeleted(); });

// One requests listener for this page; it also drives the sidebar badge.
watchPendingRequests((list) => {
  state.pending = list;
  const count = list.filter((r) => (r.status || 'pending') === 'pending').length;
  shell.setBadge('pending', count);
  const badge = $('#pending-count');
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.hidden = !count;
  if (state.tab === 'pending') draw();
}, (error) => {
  console.error('[review-queue] could not load requests:', error);
  render(grid, html`<p class="empty-state">Couldn't load requests. Please refresh.</p>`);
});

// Keep "x minutes ago" fresh
setInterval(draw, 60000);
