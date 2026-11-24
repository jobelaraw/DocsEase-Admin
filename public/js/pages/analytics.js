// Analytics: sign-ups, offices/services and service history — all from one server
// summary (adminApi.getStats) instead of downloading users, conversations and history.
// Super Admins see every office (scope "all"); normal admins get only their own
// office's numbers from the server (scope "office") and the page hides the rest
// (data-scope in analytics.html).
import { startPage } from '../core/page.js';
import { render, $, $$, on } from '../core/dom.js';
import { api } from '../core/api.js';
import { cached, takeStatsStale, STATS_KEY } from '../core/cache.js';
import { skeleton } from '../components/skeleton.js';
import { toast } from '../components/toast.js';
import { rankListSkeleton, renderRankList } from '../components/rank-list.js';
import { lineChart, monthLabel, weekdayLabel } from '../components/chart.js';

$$('[data-skel]').forEach((el) => render(el, skeleton.number(80, 36)));
render($('#per-office'), rankListSkeleton());
render($('#most-used'), rankListSkeleton());

let stats = null;
let period = 'weekly';

// Services per Office: the top offices only, until the card is expanded.
const PER_OFFICE_TOP = 5;
const perOffice = $('#per-office');
const perOfficeToggle = $('#per-office-toggle');
let perOfficeExpanded = false;

function drawPerOffice() {
  const offices = stats.servicesPerOffice;
  renderRankList(perOffice, offices);
  $$('.rank-item', perOffice).forEach((row, i) => { row.hidden = !perOfficeExpanded && i >= PER_OFFICE_TOP; });
  perOfficeToggle.hidden = offices.length <= PER_OFFICE_TOP;
  perOfficeToggle.setAttribute('aria-expanded', String(perOfficeExpanded));
  perOfficeToggle.textContent = perOfficeExpanded ? 'Show less' : `Show all ${offices.length} offices`;
}

perOfficeToggle.addEventListener('click', () => {
  perOfficeExpanded = !perOfficeExpanded;
  drawPerOffice();
});

function setStat(id, value) {
  render($(id), value == null ? '–' : Number(value).toLocaleString());
}

function signupSeries() {
  const s = stats.signups;
  if (period === 'monthly') return { labels: s.monthly.map((b) => monthLabel(b.start)), data: s.monthly.map((b) => b.count) };
  if (period === 'yearly') return { labels: s.yearly.map((b) => String(b.year)), data: s.yearly.map((b) => b.count) };
  return { labels: s.daily.map((b) => weekdayLabel(b.start)), data: s.daily.map((b) => b.count) };
}

function drawSignups() {
  const { labels, data } = signupSeries();
  return lineChart($('#signup-chart'), { labels, series: [{ label: 'New Sign-ups', data, style: 'signup', fill: true }], legend: false });
}

on(document, 'click', '[data-period]', (e, chip) => {
  period = chip.dataset.period;
  $$('[data-period]').forEach((c) => {
    c.classList.toggle('active', c === chip);
    c.setAttribute('aria-pressed', String(c === chip));
  });
  if (stats && stats.scope !== 'office') drawSignups();
});

await startPage();

function drawStats(data) {
  stats = data;
  const allOffices = stats.scope !== 'office';
  if (allOffices) {
    setStat('#stat-users', stats.users);
    setStat('#stat-today', stats.newUsers.today);
    setStat('#stat-week', stats.newUsers.week);
    setStat('#stat-month', stats.newUsers.month);
    setStat('#stat-offices', stats.offices);
    drawPerOffice();
  } else {
    const name = stats.office ? stats.office.name : 'Your Office';
    $('#office-heading').textContent = name;
    $('#office-sub').textContent = stats.office
      ? `${name}: its services and how citizens are using them.`
      : 'Your office was not found. Please contact the Super Admin.';
  }
  setStat('#stat-applicants', stats.history.applicants);
  setStat('#stat-services', stats.services);
  setStat('#stat-untranslated', stats.untranslatedServices);
  setStat('#stat-history', stats.history.total);
  renderRankList($('#most-used'), stats.history.mostUsed);
  $$('[data-chart-skel]').forEach((el) => el.remove());
  return Promise.all([
    allOffices ? drawSignups() : null,
    lineChart($('#trend-chart'), {
      labels: stats.history.trend.map((m) => monthLabel(m.start)),
      series: [
        { label: 'Completed', data: stats.history.trend.map((m) => m.completed), style: 'navy' },
        { label: 'In Progress', data: stats.history.trend.map((m) => m.inProgress), style: 'blue' }
      ]
    })
  ]);
}

// Last numbers show at once (shared with the Dashboard); refreshed when older than a minute.
try {
  const refresh = takeStatsStale();
  await cached(STATS_KEY, () => api.getStats({ refresh }), drawStats, { maxAgeMs: 60000, force: refresh });
} catch (error) {
  console.error('[analytics] could not load stats:', error);
  $$('[data-skel]').forEach((el) => { if (el.querySelector('.skel')) setStat(`#${el.id}`, null); });
  ['#per-office', '#most-used'].forEach((id) => {
    if ($(id).getAttribute('aria-busy')) renderRankList($(id), [], { empty: "Couldn't load data." });
  });
  toast.error('Analytics Error', error.message || 'Could not load analytics data.', { button: 'OK' });
} finally {
  $$('[data-chart-skel]').forEach((el) => el.remove());
}
