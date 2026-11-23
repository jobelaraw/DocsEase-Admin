// Dashboard + Analytics numbers, computed next to the database and cached briefly,
// so browsers no longer download every office, service, citizen and history record.
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
    db().collectionGroup("services").select("isDeleted", "_translated").get(),
    db().collection("users").select("createdAt").get(),
    db().collectionGroup("service_history").select(
      "status", "progress_status", "service_name", "serviceName", "last_updated", "updatedAt", "createdAt",
      "completed_steps.status", "completed_steps.service_name", "completed_steps.last_updated"
    ).get()
  ]);

  // Offices / services (trashed offices and their services are not counted)
  const activeOffices = new Map();
  offices.docs.forEach((o) => {
    const d = o.data() || {};
    if (d.isDeleted !== true) activeOffices.set(o.id, { name: d.office_name || o.id, count: 0 });
  });
  let untranslatedServices = 0;
  let activeServices = 0;
  services.docs.forEach((s) => {
    const officeDoc = s.ref.parent.parent;
    if (!officeDoc || s.ref.parent.parent.parent.id !== "offices") return;
    const office = activeOffices.get(officeDoc.id);
    const d = s.data() || {};
    if (!office || d.isDeleted === true) return;
    office.count++;
    activeServices++;
    if (d._translated !== true) untranslatedServices++;
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

  // Service history: most used + completion trend (last 12 months)
  const countByService = new Map();
  const completedTimes = [];
  const inProgressTimes = [];
  history.docs.forEach((h) => {
    const f = historyFacts(h.data() || {});
    countByService.set(f.name, (countByService.get(f.name) || 0) + 1);
    if (f.at && f.completed) completedTimes.push(f.at);
    if (f.at && f.inProgress) inProgressTimes.push(f.at);
  });
  const mostUsed = [...countByService.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const completedCounts = countInWindows(months, completedTimes);
  const inProgressCounts = countInWindows(months, inProgressTimes);

  return {
    computedAt: now,
    offices: activeOffices.size,
    services: activeServices,
    untranslatedServices,
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
    history: {
      total: history.size,
      mostUsed,
      trend: months.map((w, i) => ({ start: w.start, completed: completedCounts[i], inProgress: inProgressCounts[i] }))
    }
  };
}

// Any active admin (the dashboard is shown to every admin). { refresh: true } skips the cache.
async function getStats(caller, { refresh } = {}) {
  const ref = db().doc(CACHE_DOC);
  if (!refresh) {
    const cached = await ref.get();
    const computedAt = cached.exists ? toMillis(cached.get("computedAt")) : null;
    if (computedAt && Date.now() - computedAt < CACHE_MS) return cached.get("data");
  }
  const data = await computeStats();
  await ref.set({ computedAt: Timestamp.fromMillis(data.computedAt), data });
  return data;
}

module.exports = { getStats, computeStats };
