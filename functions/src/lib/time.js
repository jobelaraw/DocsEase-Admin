const DAY_MS = 24 * 60 * 60 * 1000;

// Manila has no daylight saving, so a fixed +8h offset is exact.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// Firestore Timestamp, Date, ISO string or millis -> millis (or null)
function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// Calendar parts of a moment as seen in Manila.
function manilaParts(ms) {
  const d = new Date(ms + MANILA_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), weekday: d.getUTCDay() };
}

// Millis at Manila midnight of the given calendar date (month/day may overflow, like Date.UTC).
function manilaMidnight(year, month, day) {
  return Date.UTC(year, month, day) - MANILA_OFFSET_MS;
}

module.exports = { DAY_MS, toMillis, manilaParts, manilaMidnight };
