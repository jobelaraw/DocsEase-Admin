// Small browser cache for server answers that main pages need on every visit
// (dashboard stats, account lists, Deleted Records). "Show the last copy now,
// download again only if the data changed":
//
//   cached(STATS_KEY, (version) => api.getStats({ version }), (data, { fresh }) => draw(data));
//
// - The saved copy is drawn immediately (no skeleton on revisits).
// - The server is always asked, with the version of the saved copy. It answers
//   "unchanged" unless the data changed since (versions are bumped by Firestore
//   triggers: functions/src/lib/versions.js), so there are no refresh timers.
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

// Without a version (a page saving its own edits), the next request downloads in full.
export function writeCache(key, data, { personal = false, version = null } = {}) {
  try {
    storeFor(personal).setItem(fullKey(key), JSON.stringify({ savedAt: Date.now(), version, data }));
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

// Draws the saved copy (if any), then asks the server whether it is still current.
// fetcher(knownVersion) calls an adminApi action that answers
//   { version, unchanged: true }  - the saved copy is still right (one cheap read), or
//   { version, data }             - new data.
// Resolves with the newest data. A failed request keeps the saved copy on screen;
// with nothing saved, the error is thrown so the page can show its error state.
//   force:    download in full (right after this admin's own change, before the server trigger ran)
//   maxAgeMs: download in full once the copy is this old (for values no trigger sees,
//             e.g. "last active" in Account Management); Infinity by default
export async function cached(key, fetcher, onData, { personal = false, force = false, maxAgeMs = Infinity } = {}) {
  const entry = readCache(key, { personal });
  if (entry) onData(entry.data, { fresh: false, savedAt: entry.savedAt });
  const usable = entry && !force && entry.version && Date.now() - entry.savedAt < maxAgeMs;
  try {
    const result = await fetcher(usable ? entry.version : null);
    if (result.unchanged && entry) return entry.data;
    writeCache(key, result.data, { personal, version: result.version });
    onData(result.data, { fresh: true, savedAt: Date.now() });
    return result.data;
  } catch (error) {
    if (entry) {
      console.warn(`[cache] could not refresh "${key}", showing the saved copy:`, error);
      return entry.data;
    }
    throw error;
  }
}

// ---------- dashboard / analytics numbers ----------
// v2: the server answer depends on the admin's office (scope "all" / "office");
// copies saved under the old key are never shown.
// Pages ask on every visit and whenever the tab is shown again (onTabReturn).
export const STATS_KEY = 'stats-v3';

// Calls fn when the admin comes back to this tab (switching tabs or windows).
export function onTabReturn(fn) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') fn();
  });
}
