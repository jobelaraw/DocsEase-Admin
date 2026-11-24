// Websites allowed to call the admin Cloud Functions from a browser (CORS).
// onCall functions default to allowing every origin; this limits them to the admin panel.
// Native apps (the mobile app) don't send an Origin header, so CORS doesn't affect them.
//
// Add the admin panel's domain here when it is served from somewhere new.
const ALLOWED_ORIGINS = [
  // Admin panel on Vercel (production)
  "https://gabayan-admin-portal-m4q9.vercel.app",
  "https://docsease-efacc.web.app",
  "https://docsease-efacc.firebaseapp.com",
  // Local testing (any port), e.g. Live Server or the Firebase emulators
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
];

module.exports = { ALLOWED_ORIGINS };
