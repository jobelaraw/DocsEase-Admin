// Activity Log: the signed-in admin's own copies of activity entries (live).
// Super Admins see everything that happened; normal admins see what concerns them.
import { startPage } from '../core/page.js';
import { html, render, $, $$, on, debounce } from '../core/dom.js';
import { timeAgo, periodStart } from '../core/dates.js';
import { toast, confirm } from '../components/toast.js';
import { watchActivity, deleteActivity } from '../data/activity.js';

const list = $('#log-list');
const deleteSelectedBtn = $('#delete-selected');
const selected = new Set();
let logs = [];
let period = 'all';
let term = '';
let session = null;

render(list, html`${Array.from({ length: 8 }, (_, i) => html`
  <div class="log-row" aria-hidden="true">
    <span class="skel" style="width:15px;height:15px;border-radius:4px"></span>
    <span class="skel skel-text" style="width:${[65, 80, 50, 72, 58, 85, 45, 68][i]}%"></span>
    <span class="skel skel-text" style="width:70px;height:10px"></span><span></span>
  </div>`)}`);

// ---------- wording ----------
function forAdmin(log) {
  const office = log.office_name ? `the ${log.office_name}` : 'an office';
  const svc = log.service_name ? `"${log.service_name}"` : 'a service';
  switch (log.type) {
    case 'office_added': return ['Hi there! A new office was added.', `The Super Admin added ${office} successfully. Check it out.`];
    case 'admin_account_accepted': return ['Hi there! Your request was accepted.', `The Super Admin accepted your admin account request for ${office}. Welcome aboard!`];
    case 'service_delete_accepted': return ['Hi there! Your request was accepted.', `The Super Admin accepted your request to delete ${svc} in ${office}.`];
    case 'service_delete_declined': return ['Hi there! Your request was declined.', `The Super Admin declined your request to delete ${svc} in ${office}.`];
    default: return ['Hi there! New activity.', ''];
  }
}

function forSuperAdmin(log) {
  const isMe = log.actor_uid === session.uid;
  const name = log.actor_name || 'An admin';
  const who = isMe ? 'You' : name;
  const admin = isMe ? 'You' : `Admin ${name}`;
  const office = log.office_name ? `the ${log.office_name}` : 'an office';
  const svc = log.service_name ? `"${log.service_name}"` : 'a service';
  const target = log.target_name || 'an admin';
  const forOffice = log.office_name ? ` for ${office}` : '';
  switch (log.type) {
    case 'service_added': return ['Hi there! A new service added.', `${admin} added ${log.service_name ? svc : 'a new service'} in ${office}. Check it out.`];
    case 'service_updated': return ['Hi there! A service was updated.', `${admin} updated ${svc} in ${office}.`];
    case 'service_deleted': return ['Hi there! A service has been deleted.', `${admin} deleted ${svc} in ${office}.`];
    case 'service_delete_requested': return ['Hi there! A delete request was sent.', `${admin} requested to delete ${svc} in ${office}.`];
    case 'service_delete_accepted': return ['Hi there! Accepted a request.', `${who} accepted the deletion of ${svc} in ${office}.`];
    case 'service_delete_declined': return ['Hi there! Declined a request.', `${who} declined the request to delete ${svc} in ${office}.`];
    case 'service_restored': return ['Hi there! A service was recovered.', `${who} recovered ${svc} in ${office} from Deleted Records.`];
    case 'service_purged': return ['Hi there! A service was permanently deleted.', `${who} permanently deleted ${svc} in ${office}.`];
    case 'office_added': return ['Hi there! Added an office.', `${who} added ${office} successfully. Check it out.`];
    case 'office_deleted': return ['Hi there! Deleted an office.', `${who} moved ${office} to Deleted Records.`];
    case 'office_restored': return ['Hi there! An office was recovered.', `${who} recovered ${office} and its services from Deleted Records.`];
    case 'office_purged': return ['Hi there! An office was permanently deleted.', `${who} permanently deleted ${office} and all of its services.`];
    case 'admin_account_requested': return ['Hi there! New admin request.', `${name} requested an admin account for ${office}.`];
    case 'admin_account_accepted': return ['Hi there! Accepted a request.', `${who} accepted a new admin account named ${target} for ${office}.`];
    case 'admin_account_declined': return ['Hi there! Declined a request.', `${who} declined the admin account request of ${target} for ${office}.`];
    case 'user_account_deactivated': return ['Hi there! Deactivated a user.', `${who} deactivated the mobile user account of ${log.target_name || 'a user'}.`];
    case 'user_account_reactivated': return ['Hi there! Reactivated a user.', `${who} reactivated the mobile user account of ${log.target_name || 'a user'}.`];
    case 'admin_account_deactivated': return ['Hi there! Deactivated an admin.', `${who} deactivated the admin account of ${target}${forOffice}.`];
    case 'admin_account_reactivated': return ['Hi there! Reactivated an admin.', `${who} reactivated the admin account of ${target}${forOffice}.`];
    default: return ['Hi there! New activity.', ''];
  }
}

const describe = (log) => (session.role === 'super_admin' ? forSuperAdmin(log) : forAdmin(log));

// ---------- drawing ----------
function visibleLogs() {
  const start = periodStart(period);
  const q = term.trim().toLowerCase();
  return logs.filter((log) => {
    if (start && (!log._date || log._date < start)) return false;
    return !q || describe(log).join(' ').toLowerCase().includes(q);
  });
}

function draw() {
  const items = visibleLogs();
  list.removeAttribute('aria-busy');
  if (!items.length) {
    render(list, html`<div class="empty-state">${logs.length ? 'No activity matches your filters.' : 'No activity yet.'}</div>`);
  } else {
    render(list, html`${items.map((log) => {
      const [title, desc] = describe(log);
      const isSelected = selected.has(log.id);
      return html`
        <div class="log-row ${isSelected ? 'selected' : ''}" data-id="${log.id}">
          <input type="checkbox" class="log-check" aria-label="Select log" ${isSelected ? 'checked' : ''} />
          <div class="log-text"><span class="log-title">${title}</span><span class="log-desc">${desc}</span></div>
          <div class="log-time">${timeAgo(log._date)}</div>
          <button type="button" class="log-row-delete" data-delete title="Delete log" aria-label="Delete log"><img src="assets/delete.svg" alt="" /></button>
        </div>`;
    })}`);
  }
  deleteSelectedBtn.classList.toggle('active', selected.size > 0);
}

// ---------- deleting ----------
async function remove(ids) {
  ids = ids.filter((id) => logs.some((l) => l.id === id));
  if (!ids.length) return;
  const many = ids.length > 1;
  const ok = await confirm({
    type: 'warning',
    title: many ? 'Delete Activity Logs?' : 'Delete Activity Log?',
    msg: many ? `This will permanently delete ${ids.length} activity logs.` : 'This will permanently delete this activity log.',
    confirmText: 'Yes, Delete'
  });
  if (!ok) return;
  toast.loading('Deleting', 'Removing the selected activity logs.');
  try {
    await deleteActivity(session.uid, ids);
    ids.forEach((id) => selected.delete(id));
    toast.success('Deleted', many ? `${ids.length} activity logs were deleted.` : 'The activity log was deleted.', { button: 'OK' });
  } catch (error) {
    console.error('[activity-log] delete failed:', error);
    toast.error('Delete Failed', `The activity log could not be deleted (${error.code || error.message}).`, { button: 'OK' });
  }
}

// ---------- events ----------
on(document, 'click', '[data-period]', (e, tab) => {
  period = tab.dataset.period;
  $$('[data-period]').forEach((t) => {
    t.classList.toggle('active', t === tab);
    t.setAttribute('aria-selected', String(t === tab));
  });
  draw();
});
$('#search').addEventListener('input', debounce((e) => { term = e.target.value; draw(); }, 150));
on(list, 'click', '[data-delete]', (e, btn) => remove([btn.closest('.log-row').dataset.id]));
on(list, 'change', '.log-check', (e, box) => {
  const row = box.closest('.log-row');
  if (box.checked) selected.add(row.dataset.id);
  else selected.delete(row.dataset.id);
  row.classList.toggle('selected', box.checked);
  deleteSelectedBtn.classList.toggle('active', selected.size > 0);
});
deleteSelectedBtn.addEventListener('click', () => {
  if (!selected.size) return toast.info('Nothing Selected', 'Tick the logs you want to delete first.', { button: 'OK' });
  remove([...selected]);
});

session = await startPage();

watchActivity(session.uid, (next) => {
  logs = next;
  for (const id of [...selected]) if (!logs.some((l) => l.id === id)) selected.delete(id);
  draw();
}, (error) => {
  console.error('[activity-log] could not load:', error);
  list.removeAttribute('aria-busy');
  render(list, html`<div class="empty-state">Couldn't load the activity log. Please refresh.</div>`);
});

// Keep "x mins ago" fresh
setInterval(draw, 60000);
