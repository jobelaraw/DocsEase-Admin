const { HttpsError } = require("firebase-functions/v2/https");

// Short helpers for the errors the browser shows to the admin.
// The message is passed through to the page as-is, so keep it user friendly.
const invalid = (message) => new HttpsError("invalid-argument", message);
const notFound = (message) => new HttpsError("not-found", message);
const conflict = (message) => new HttpsError("failed-precondition", message);
const forbidden = (message = "You are not allowed to do this.") => new HttpsError("permission-denied", message);
const unauthenticated = (message = "Please sign in again.") => new HttpsError("unauthenticated", message);
const tooMany = (message, details) => new HttpsError("resource-exhausted", message, details);
const unavailable = (message) => new HttpsError("unavailable", message);

module.exports = { HttpsError, invalid, notFound, conflict, forbidden, unauthenticated, tooMany, unavailable };
