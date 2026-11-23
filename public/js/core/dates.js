// Date helpers shared by the lists (one definition of "this week": it starts on Monday).

// Firestore Timestamp / Date / millis / ISO string -> Date (or null)
export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "just now", "5 mins ago", "3 hours ago", "2 days ago", then "Nov 3, 2026"
export function timeAgo(date) {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(date);
}

export function formatDate(date, fallback = '—') {
  const d = toDate(date);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : fallback;
}

export function formatDateTime(date, fallback = '—') {
  const d = toDate(date);
  return d ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : fallback;
}

// Start of a period in local time: 'today' | 'week' (Monday) | 'month' | 'year'; null for 'all'
export function periodStart(period, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'today') return today;
  if (period === 'week') {
    const d = new Date(today);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'year') return new Date(now.getFullYear(), 0, 1);
  return null;
}

// Whole days from now until a date (negative = past)
export function daysUntil(date) {
  const d = toDate(date);
  return d ? Math.ceil((d.getTime() - Date.now()) / 86400000) : null;
}
