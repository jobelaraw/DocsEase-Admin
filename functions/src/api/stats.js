// Dashboard + Analytics numbers, computed next to the database and cached briefly,
// so browsers no longer download every office, service, citizen and history record.
//
// Super Admins get every number. Normal admins only get their own office's slice
// (its services and the citizens who used them): see officeView().
const { db, Timestamp } = require("../lib/refs");
const { DAY_MS, toMillis, manilaParts, manilaMidnight } = require("../lib/time");

const CACHE_DOC = "stats/summary";
const CACHE_MS = 5 * 60 * 1000;

// Same status/name/date rules the dashboard and analytics pages used.
function historyFacts(data) {
  const step = data.completed_steps || {};
  const status = String(data.status || step.status || data.progress_status || "").trim().toLowerCase();
  const name = String(data.service_name || step.service_name || data.serviceName || "Unknown Service").trim() || "Unknown Service";
  const at = toMillis(data.last_updated || step.last_updated || data.updatedAt || data.createdAt);
  const completed = status === "completed" || status === "done";
  const inProgress = status.includes("in progress") || status.includes("in_progress") || status === "pending" || status === "processing";
  return { name, at, completed, inProgress };
}

// Counts how many timestamps fall in each [start, nextStart) window.
function countInWindows(windows, timestamps) {
  const counts = windows.map(() => 0);
  timestamps.forEach((t) => {
    for (let i = 0; i < windows.length; i++) {
      if (t >= windows[i].start && t < windows[i].end) { counts[i]++; break; }
    }
  });
  return counts;
}

function lastDays(now, n) {
  const p = manilaParts(now);
  return Array.from({ length: n }, (_, i) => {
    const start = manilaMidnight(p.year, p.month, p.day - (n - 1 - i));
    return { start, end: start + DAY_MS };
  });
}

function lastMonths(now, n) {
  const p = manilaParts(now);
  return Array.from({ length: n }, (_, i) => {
    const offset = n - 1 - i;
    return { start: manilaMidnight(p.year, p.month - offset, 1), end: manilaMidnight(p.year, p.month - offset + 1, 1) };
  });
}

function lastYears(now, n) {
  const { year } = manilaParts(now);
  return Array.from({ length: n }, (_, i) => {
    const y = year - (n - 1 - i);
    return { year: y, start: manilaMidnight(y, 0, 1), end: manilaMidnight(y + 1, 0, 1) };
  });
}

async function computeStats() {
  const now = Date.now();
  const [offices, services, users, history] = await Promise.all([
    db().collection("offices").select("office_name", "isDeleted").get(),
    db().collectionGroup("services").select("isDeleted").get(),
    db().collection("users").select("createdAt").get(),
    db().collectionGroup("service_history").select(
      "service_id", "status", "progress_status", "service_name", "serviceName", "last_updated", "updatedAt", "createdAt",
      "completed_steps.status", "completed_steps.service_name", "completed_steps.last_updated"
    ).get()
  ]);

  // Offices / services (trashed offices and their services are not counted)
  const activeOffices = new Map();
  offices.docs.forEach((o) => {
    const d = o.data() || {};
    if (d.isDeleted !== true) activeOffices.set(o.id, { name: d.office_name || o.id, count: 0 });
  });
  let activeServices = 0;
  const officeOfService = new Map(); // serviceId -> officeId (history records only store the service id)
  const perOffice = new Map(); // officeId -> { services }
  activeOffices.forEach((_, id) => perOffice.set(id, { services: 0 }));
  services.docs.forEach((s) => {
    const officeDoc = s.ref.parent.parent;
    if (!officeDoc || s.ref.parent.parent.parent.id !== "offices") return;
    officeOfService.set(s.id, officeDoc.id);
    const office = activeOffices.get(officeDoc.id);
    const d = s.data() || {};
    if (!office || d.isDeleted === true) return;
    office.count++;
    activeServices++;
    perOffice.get(officeDoc.id).services++;
  });
  const servicesPerOffice = [...activeOffices.values()].sort((a, b) => b.count - a.count);

  // Citizens + sign-ups (Manila calendar; week starts Monday)
  const signupTimes = users.docs.map((u) => toMillis((u.data() || {}).createdAt)).filter(Boolean);
  const p = manilaParts(now);
  const startOfToday = manilaMidnight(p.year, p.month, p.day);
  const startOfWeek = manilaMidnight(p.year, p.month, p.day - ((p.weekday + 6) % 7));
  const startOfMonth = manilaMidnight(p.year, p.month, 1);
  const days = lastDays(now, 7);
  const months = lastMonths(now, 12);
  const years = lastYears(now, 5);
  const dailyCounts = countInWindows(days, signupTimes);
  const monthlyCounts = countInWindows(months, signupTimes);
  const yearlyCounts = countInWindows(years, signupTimes);

  // Service history: most used + completion trend (last 12 months), for all
  // offices together and for each office on its own.
  const newHistoryTally = () => ({ total: 0, citizens: new Set(), byService: new Map(), completed: [], inProgress: [] });
  const all = newHistoryTally();
  const historyByOffice = new Map();
  history.docs.forEach((h) => {
    const d = h.data() || {};
    const f = historyFacts(d);
    const citizen = h.ref.parent.parent ? h.ref.parent.parent.id : null;
    const officeId = officeOfService.get(String(d.service_id || h.id));
    if (officeId && !historyByOffice.has(officeId)) historyByOffice.set(officeId, newHistoryTally());
    [all, officeId ? historyByOffice.get(officeId) : null].forEach((t) => {
      if (!t) return;
      t.total++;
      if (citizen) t.citizens.add(citizen);
      t.byService.set(f.name, (t.byService.get(f.name) || 0) + 1);
      if (f.at && f.completed) t.completed.push(f.at);
      if (f.at && f.inProgress) t.inProgress.push(f.at);
    });
  });
  const historySummary = (t) => {
    const completedCounts = countInWindows(months, t.completed);
    const inProgressCounts = countInWindows(months, t.inProgress);
    return {
      total: t.total,
      applicants: t.citizens.size,
      mostUsed: [...t.byService.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      trend: months.map((w, i) => ({ start: w.start, completed: completedCounts[i], inProgress: inProgressCounts[i] }))
    };
  };

  // Each active office's own numbers (normal admins only ever receive their office's entry)
  const byOffice = {};
  activeOffices.forEach((office, id) => {
    const counts = perOffice.get(id);
    byOffice[id] = {
      name: office.name,
      services: counts.services,
      history: historySummary(historyByOffice.get(id) || newHistoryTally())
    };
  });

  return {
    computedAt: now,
    offices: activeOffices.size,
    services: activeServices,
    users: users.size,
    newUsers: {
      today: signupTimes.filter((t) => t >= startOfToday).length,
      week: signupTimes.filter((t) => t >= startOfWeek).length,
      month: signupTimes.filter((t) => t >= startOfMonth).length
    },
    signups: {
      daily: days.map((w, i) => ({ start: w.start, count: dailyCounts[i] })),
      monthly: months.map((w, i) => ({ start: w.start, count: monthlyCounts[i] })),
      yearly: years.map((w, i) => ({ year: w.year, count: yearlyCounts[i] }))
    },
    servicesPerOffice,
    history: historySummary(all),
    byOffice
  };
}

const normalize = (name) => String(name || "").trim().toLowerCase();

// What a caller may see: everything for a Super Admin; for a normal admin only
// their own office (matched by the office name on their admin record).
function viewFor(caller, full) {
  const { byOffice, ...everything } = full;
  if (caller.role === "super_admin") return { scope: "all", ...everything };

  const entry = Object.entries(byOffice || {}).find(([, o]) => normalize(o.name) === normalize(caller.office));
  const [officeId, office] = entry || [null, null];
  return {
    scope: "office",
    computedAt: full.computedAt,
    office: office ? { id: officeId, name: office.name } : null,
    services: office ? office.services : 0,
    history: office ? office.history : {
      total: 0,
      applicants: 0,
      mostUsed: [],
      trend: full.history.trend.map((m) => ({ start: m.start, completed: 0, inProgress: 0 }))
    }
  };
}

// Any active admin (the dashboard is shown to every admin). { refresh: true } skips the cache.
// The cache holds every office's numbers; each caller only receives what viewFor() allows.
async function getStats(caller, { refresh } = {}) {
  const ref = db().doc(CACHE_DOC);
  if (!refresh) {
    const cached = await ref.get();
    const computedAt = cached.exists ? toMillis(cached.get("computedAt")) : null;
    const data = cached.exists ? cached.get("data") : null;
    // Copies saved before the per-office breakdown existed are recomputed.
    if (computedAt && Date.now() - computedAt < CACHE_MS && data && data.byOffice) return viewFor(caller, data);
  }
  const data = await computeStats();
  await ref.set({ computedAt: Timestamp.fromMillis(data.computedAt), data });
  return viewFor(caller, data);
}

module.exports = { getStats, computeStats, viewFor };
