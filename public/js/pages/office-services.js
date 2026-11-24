// Office Services: the services of one office as tiles.
// Super Admins arrive from Service Management with ?officeId=…;
// normal admins always see their own office.
import { startPage } from '../core/page.js';
import { html, render, $, $$, debounce } from '../core/dom.js';
import { skeleton } from '../components/skeleton.js';
import { watchOffice, findOfficeByName } from '../data/offices.js';
import { watchServices } from '../data/services.js';

const grid = $('#services');
const status = $('#status');
const title = $('#page-title');
const subtitle = $('#page-subtitle');
const addLink = $('#add-service');

render(grid, skeleton.tiles(6));

function showStatus(message) {
  // The office name never arrived: replace the title skeleton with a generic heading.
  if (title.querySelector('.skel')) {
    title.textContent = 'Office Services';
    subtitle.textContent = 'Monitor and manage service items.';
  }
  grid.hidden = true;
  grid.removeAttribute('aria-busy');
  status.textContent = message;
  status.hidden = false;
}

function setOfficeName(name) {
  title.textContent = `${name} Services`;
  subtitle.textContent = `Monitor and manage service items listed under ${name}.`;
  document.title = `GaBayan – ${name}`;
}

const search = $('#search');
function applySearch() {
  const q = search.value.trim().toLowerCase();
  let visible = 0;
  $$('.tile[data-name]', grid).forEach((tile) => {
    const show = tile.dataset.name.includes(q);
    tile.hidden = !show;
    if (show) visible++;
  });
  const searching = q && !grid.hidden;
  status.hidden = !searching || visible > 0;
  if (searching && !visible) status.textContent = 'No services found.';
}
search.addEventListener('input', debounce(applySearch, 120));

function showServices(officeId, services) {
  grid.removeAttribute('aria-busy');
  if (!services.length) return showStatus('No services found for this office yet.');
  grid.hidden = false;
  status.hidden = true;
  render(grid, html`${services.map((s) => html`
    <a class="tile" data-name="${s.name.toLowerCase()}"
       href="service-form.html?officeId=${encodeURIComponent(officeId)}&serviceId=${encodeURIComponent(s.id)}">${s.name}</a>`)}`);
  applySearch();
}

function openOffice(officeId) {
  addLink.href = `service-form.html?officeId=${encodeURIComponent(officeId)}`;
  let stopServices = null;
  watchOffice(officeId, (office) => {
    if (!office) {
      if (stopServices) { stopServices(); stopServices = null; }
      return showStatus('Office not found in the database.');
    }
    setOfficeName(office.name);
    if (office.isDeleted === true) {
      if (stopServices) { stopServices(); stopServices = null; }
      return showStatus('This office is in Deleted Records. A Super Admin can recover it from the Review Queue.');
    }
    if (!stopServices) {
      stopServices = watchServices(officeId, (services) => showServices(officeId, services), (error) => {
        console.error('[office-services] could not load services:', error);
        showStatus('Failed to load services. Check your permissions.');
      });
    }
  }, (error) => {
    console.error('[office-services] could not load the office:', error);
    showStatus('Failed to load this office. Check your permissions.');
  });
}

const params = new URLSearchParams(location.search);
let officeId = params.get('officeId');

// Super Admins can start loading straight from the URL while the session is checked.
const cached = window.GaBayan.readSession();
const cachedRole = cached?.role;
// Normal admins always see their own office, so its name can go up before the session is confirmed.
if (cached && cachedRole !== 'super_admin' && cached.office) setOfficeName(cached.office);
if (officeId && cachedRole === 'super_admin') openOffice(officeId);
const startedEarly = !!(officeId && cachedRole === 'super_admin');

const session = await startPage();

if (session.role !== 'super_admin') {
  // Normal admins only ever see their own office
  if (!session.officeId) {
    showStatus(session.office
      ? `Your office "${session.office}" was not found. Please contact the Super Admin.`
      : 'Your account has no office assigned yet. Please contact the Super Admin.');
  } else {
    setOfficeName(session.office);
    if (officeId !== session.officeId) history.replaceState(null, '', `office-services.html?officeId=${encodeURIComponent(session.officeId)}`);
    officeId = session.officeId;
    openOffice(officeId);
  }
} else if (!startedEarly) {
  // Old links used the office name (?office=…)
  if (!officeId && params.get('office')) {
    const office = await findOfficeByName(params.get('office')).catch(() => null);
    if (office) {
      officeId = office.id;
      history.replaceState(null, '', `office-services.html?officeId=${encodeURIComponent(officeId)}`);
    }
  }
  if (officeId) openOffice(officeId);
  else showStatus('No office selected. Choose an office in Service Management.');
}

