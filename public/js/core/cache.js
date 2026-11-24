// Small browser cache for server answers that main pages need on every visit
// (dashboard stats, account lists, Deleted Records). "Show the last copy now,
// refresh in the background":
//
//   cached('stats', () => api.getStats(), (data, { fresh }) => draw(data), { maxAgeMs: 60000 });
//
// - The saved copy is drawn immediately (no skeleton on revisits).
// - If it is older than maxAgeMs (or missing), the server is asked and the
//   callback runs again with the new data.
// - Entries belong to the signed-in admin and are wiped on sign-out.
// - personal: true keeps the entry only for this browser tab (sessionStorage),
//   for lists with names/emails; otherwise it survives new tabs (localStorage).
const PREFIX = 'gabayan_cache:';

function uid() {
  const session = window.GaBayan && window.GaBayan.readSession();
  return session ? session.uid : 'anon';
}

const storeFor = (personal) => (personal ? sessionStorage : localStorage);
const fullKey = (key) => `${PREFIX}${uid()}:${key}`;

export function readCache(key, { personal = false } = {}) {
  try {
    const entry = JSON.parse(storeFor(personal).getItem(fullKey(key)));
    return entry && 'data' in entry ? entry : null;
  } catch {
    return null;
  }
}

export function writeCache(key, data, { personal = false } = {}) {
  try {
    storeFor(personal).setItem(fullKey(key), JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* storage full or blocked: caching is optional */
  }
}

export function forgetCache(key, { personal = false } = {}) {
  try { storeFor(personal).removeItem(fullKey(key)); } catch { /* ignore */ }
}

// Removes every cached entry (all admins) - called on sign-out.
export function clearCache() {
  [localStorage, sessionStorage].forEach((store) => {
    try {
      Object.keys(store).filter((k) => k.startsWith(PREFIX)).forEach((k) => store.removeItem(k));
    } catch { /* ignore */ }
  });
}

// Draws the saved copy (if any), then refreshes it when it is older than maxAgeMs.
// Resolves with the newest data. A failed refresh keeps the saved copy on screen;
// with nothing saved, the error is thrown so the page can show its error state.
export async function cached(key, fetcher, onData, { maxAgeMs = 60000, personal = false, force = false } = {}) {
  const entry = readCache(key, { personal });
  if (entry) onData(entry.data, { fresh: false, savedAt: entry.savedAt });
  if (entry && !force && Date.now() - entry.savedAt < maxAgeMs) return entry.data;
  try {
    const data = await fetcher();
    writeCache(key, data, { personal });
    onData(data, { fresh: true, savedAt: Date.now() });
    return data;
  } catch (error) {
    if (entry) {
      console.warn(`[cache] could not refresh "${key}", showing the saved copy:`, error);
      return entry.data;
    }
    throw error;
  }
}

// ---------- dashboard / analytics numbers ----------
const STATS_STALE = 'gabayan_stats_stale';

// Call after adding/removing offices or services: the next Dashboard/Analytics
// visit fetches fresh numbers (skipping both this cache and the server's).
export function markStatsStale() {
  forgetCache('stats');
  try { localStorage.setItem(STATS_STALE, '1'); } catch { /* ignore */ }
}

// True once after markStatsStale(); clears the flag.
export function takeStatsStale() {
  try {
    const stale = localStorage.getItem(STATS_STALE) === '1';
    localStorage.removeItem(STATS_STALE);
    return stale;
  } catch {
    return false;
  }
}
