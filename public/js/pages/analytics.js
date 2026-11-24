// Analytics: sign-ups, offices/services and service history — all from one server
// summary (adminApi.getStats) instead of downloading users, conversations and history.
import { startPage } from '../core/page.js';
import { render, $, $$, on } from '../core/dom.js';
import { api } from '../core/api.js';
import { cached, takeStatsStale } from '../core/cache.js';
import { skeleton } from '../components/skeleton.js';
import { toast } from '../components/toast.js';
import { rankListSkeleton, renderRankList } from '../components/rank-list.js';
import { lineChart, monthLabel, weekdayLabel } from '../components/chart.js';

$$('[data-skel]').forEach((el) => render(el, skeleton.number(80, 36)));
render($('#per-office'), rankListSkeleton());
render($('#most-used'), rankListSkeleton());

let stats = null;
let period = 'weekly';

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
  if (stats) drawSignups();
});

await startPage();

function drawStats(data) {
  stats = data;
  setStat('#stat-users', stats.users);
  setStat('#stat-today', stats.newUsers.today);
  setStat('#stat-week', stats.newUsers.week);
  setStat('#stat-month', stats.newUsers.month);
  setStat('#stat-offices', stats.offices);
  setStat('#stat-services', stats.services);
  setStat('#stat-untranslated', stats.untranslatedServices);
  setStat('#stat-history', stats.history.total);
  renderRankList($('#per-office'), stats.servicesPerOffice);
  renderRankList($('#most-used'), stats.history.mostUsed);
  $$('[data-chart-skel]').forEach((el) => el.remove());
  return Promise.all([
    drawSignups(),
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
  await cached('stats', () => api.getStats({ refresh }), drawStats, { maxAgeMs: 60000, force: refresh });
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
