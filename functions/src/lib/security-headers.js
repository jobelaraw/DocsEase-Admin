// Adds security headers to an onCall function's HTTP responses.
// onCall has no option for response headers, so this wraps the (req, res) handler
// it returns and copies over the deploy metadata (__endpoint, __trigger, run).
//
//   exports.adminApi = withSecurityHeaders(onCall({ ... }, handler));
const HEADERS = {
  // Browsers must use HTTPS for this host for 2 years (RFC 6797)
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff"
};

function withSecurityHeaders(fn) {
  const wrapped = (req, res) => {
    res.set(HEADERS);
    return fn(req, res);
  };
  for (const key of Object.getOwnPropertyNames(fn)) {
    if (key in wrapped && !["__endpoint", "__trigger", "__requiredAPIs", "run"].includes(key)) continue; // length, name, ...
    Object.defineProperty(wrapped, key, Object.getOwnPropertyDescriptor(fn, key));
  }
  return wrapped;
}

module.exports = { withSecurityHeaders };
