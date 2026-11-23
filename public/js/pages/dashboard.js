// Dashboard: totals, most-used services and the completion trend.
// The numbers come from one server call (adminApi.getStats), computed next to the
// database and cached for a few minutes, instead of downloading every record.
import { startPage } from '../core/page.js';
import { html, render, $ } from '../core/dom.js';
import { api } from '../core/api.js';
import { openOfficeForm } from '../components/office-form-modal.js';
import { rankListSkeleton, renderRankList } from '../components/rank-list.js';
import { lineChart, monthLabel } from '../components/chart.js';

const mostUsed = $('#most-used');
render(mostUsed, rankListSkeleton());

function tick() {
  const now = new Date();
  $('#banner-date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  $('#banner-time').textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
tick();
setInterval(tick, 10000);

function setStat(id, value) {
  render($(id), value == null ? '–' : Number(value).toLocaleString());
}

async function loadStats({ refresh = false } = {}) {
  try {
    const stats = await api.getStats({ refresh });
    setStat('#stat-offices', stats.offices);
    setStat('#stat-services', stats.services);
    setStat('#stat-users', stats.users);
    renderRankList(mostUsed, stats.history.mostUsed);
    await lineChart($('#trend-chart'), {
      labels: stats.history.trend.map((m) => monthLabel(m.start)),
      series: [
        { label: 'Completed', data: stats.history.trend.map((m) => m.completed), style: 'navy' },
        { label: 'In Progress', data: stats.history.trend.map((m) => m.inProgress), style: 'blue' }
      ]
    });
  } catch (error) {
    console.error('[dashboard] could not load stats:', error);
    ['#stat-offices', '#stat-services', '#stat-users'].forEach((id) => {
      if ($(id).querySelector('.skel')) setStat(id, null);
    });
    if (mostUsed.getAttribute('aria-busy')) renderRankList(mostUsed, [], { empty: "Couldn't load data." });
  } finally {
    $('#trend-skel')?.remove();
  }
}

const session = await startPage();
loadStats();

// Super Admins add offices here; normal admins add services to their office.
const actions = $('#actions');
if (session.role === 'super_admin') {
  render(actions, html`<button type="button" class="btn btn-cta" data-add-office><img src="assets/add_service.svg" alt="" /><span>Add New Office</span></button>`);
  actions.querySelector('[data-add-office]').addEventListener('click', () => openOfficeForm({ onSaved: () => loadStats({ refresh: true }) }));
} else if (session.officeId) {
  render(actions, html`<a class="btn btn-cta" href="service-form.html?officeId=${encodeURIComponent(session.officeId)}"><img src="assets/add_service.svg" alt="" /><span>Add New Service</span></a>`);
}
