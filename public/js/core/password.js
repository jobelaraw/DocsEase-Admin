// One password rule set for the live checklist and for submitting
// (the server checks the same rules: functions/src/auth-recovery.js).
export const PASSWORD_RULES = {
  length: (pw) => pw.length >= 8,
  symbol: (pw) => /[^A-Za-z0-9\s]/.test(pw),
  capital: (pw) => /[A-Z]/.test(pw),
  number: (pw) => /[0-9]/.test(pw)
};

// -> { length, symbol, capital, number, ok }
export function checkPassword(pw = '') {
  const result = {};
  Object.entries(PASSWORD_RULES).forEach(([name, test]) => { result[name] = test(pw); });
  result.ok = Object.values(result).every(Boolean);
  return result;
}
