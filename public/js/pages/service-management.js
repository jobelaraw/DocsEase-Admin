// Service Management (Super Admin): every office as a tile; add or delete offices.
// Normal admins never land here - shell.js sends them to their own office page.
import { startPage } from '../core/page.js';
import { html, render, $, $$, on, debounce } from '../core/dom.js';
import { api } from '../core/api.js';
import { logActivity } from '../core/activity-log.js';
import { markStatsStale } from '../core/cache.js';
import { TRASH_RETENTION_DAYS } from '../core/constants.js';
import { skeleton } from '../components/skeleton.js';
import { toast, confirm } from '../components/toast.js';
import { openOfficeForm } from '../components/office-form-modal.js';
import { watchOffices } from '../data/offices.js';

const grid = $('#offices');
const status = $('#status');
const search = $('#search');

render(grid, skeleton.tiles(6));

function showStatus(message) {
  status.textContent = message;
  status.hidden = !message;
}

function applySearch() {
  const q = search.value.trim().toLowerCase();
  const tiles = $$('.tile[data-name]', grid);
  let visible = 0;
  tiles.forEach((tile) => {
    tile.hidden = !tile.dataset.name.includes(q);
    if (!tile.hidden) visible++;
  });
  if (tiles.length) showStatus(visible ? '' : 'No offices found.');
}
search.addEventListener('input', debounce(applySearch, 120));

function showOffices(offices) {
  grid.removeAttribute('aria-busy');
  if (!offices.length) {
    render(grid, '');
    return showStatus('No offices found. Add one to get started!');
  }
  render(grid, html`${offices.map((o) => html`
    <div class="tile tile-light" data-name="${o.name.toLowerCase()}">
      <a class="tile-link" href="office-services.html?officeId=${encodeURIComponent(o.id)}">${o.name}</a>
      <button type="button" class="tile-action" data-action="trash" data-id="${o.id}" data-name="${o.name}" title="Delete office" aria-label="Delete ${o.name}">
        <img src="assets/delete.svg" alt="" />
      </button>
    </div>`)}`);
  applySearch();
}

on(grid, 'click', '[data-action="trash"]', async (event, button) => {
  const { id, name } = button.dataset;
  const ok = await confirm({
    type: 'warning',
    title: 'Delete Office Category?',
    msg: `"${name}" and all of its services will be moved to Deleted Records in the Review Queue. You can recover it within ${TRASH_RETENTION_DAYS} days.`,
    confirmText: 'Yes, Delete',
    cancelText: 'No'
  });
  if (!ok) return;
  button.disabled = true;
  toast.loading('Deleting Office Category', 'The office category is being moved to Deleted Records.');
  try {
    await api.trashOffice(id);
    markStatsStale();
    logActivity('office_deleted', { office_name: name });
    toast.success('Moved to Deleted Records', `"${name}" was moved to Deleted Records. You can recover it from the Review Queue within ${TRASH_RETENTION_DAYS} days.`, { button: 'OK' });
  } catch (error) {
    console.error('[service-management] delete failed:', error);
    button.disabled = false;
    toast.error('Delete Failed', error.message || 'The office category could not be deleted. Please try again.', { button: 'OK' });
  }
});

$('#add-office').addEventListener('click', () => openOfficeForm());

await startPage();

watchOffices(showOffices, (error) => {
  console.error('[service-management] could not load offices:', error);
  grid.removeAttribute('aria-busy');
  render(grid, '');
  showStatus('Failed to load offices. Ensure you have admin access.');
});
