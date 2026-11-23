// Office opening hours, stored as one text field: "Mon-Fri, 8AM-5PM".

export const DAYS = [
  ['Mon', 'Monday'], ['Tue', 'Tuesday'], ['Wed', 'Wednesday'], ['Thu', 'Thursday'],
  ['Fri', 'Friday'], ['Sat', 'Saturday'], ['Sun', 'Sunday']
];

// "13:30" -> "1:30PM", "08:00" -> "8AM"
export function formatTime(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${suffix}` : `${h12}${suffix}`;
}

// (8, 30, 'PM') -> "20:30"
function to24(h, m, suffix) {
  let hh = Number(h) % 12;
  if (/pm/i.test(suffix)) hh += 12;
  return `${String(hh).padStart(2, '0')}:${String(m || '00').padStart(2, '0')}`;
}

export function buildSchedule(dayFrom, dayTo, openTime, closeTime) {
  const days = dayTo && dayTo !== dayFrom ? `${dayFrom}-${dayTo}` : dayFrom;
  return `${days}, ${formatTime(openTime)}-${formatTime(closeTime)}`;
}

// "Mon-Fri, 8AM-5PM" -> { dayFrom: 'Mon', dayTo: 'Fri', open: '08:00', close: '17:00' } (or null)
export function parseSchedule(text) {
  const m = String(text || '').match(/^\s*([A-Za-z]{3})(?:\s*-\s*([A-Za-z]{3}))?\s*,?\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*$/i);
  if (!m) return null;
  const cap = (d) => (d ? d.charAt(0).toUpperCase() + d.slice(1).toLowerCase() : '');
  return { dayFrom: cap(m[1]), dayTo: cap(m[2]), open: to24(m[3], m[4], m[5]), close: to24(m[6], m[7], m[8]) };
}
