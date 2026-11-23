// Cloud Functions for the GaBayan admin panel (firebase.json codebase "admin").
//
// They run in asia-southeast1, the same region as Firestore, so every database
// call stays in-region. Browser code lives in public/js - nothing here is sent
// to the browser.
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

setGlobalOptions({ region: "asia-southeast1", memory: "512MiB", maxInstances: 10 });
admin.initializeApp();

// Every admin-panel action (Super Admin actions + dashboard/analytics stats)
exports.adminApi = require("./src/api").adminApi;

// Login page "Forgot password" (public, rate-limited)
exports.adminAuth = require("./src/auth-recovery").adminAuth;

// Firestore triggers
exports.onAdminCreated = require("./src/triggers/admin-claims").onAdminCreated;
const citizenNotify = require("./src/triggers/citizen-notify");
exports.onServiceWritten = citizenNotify.onServiceWritten;
exports.onOfficeCreated = citizenNotify.onOfficeCreated;

// Nightly trash cleanup
exports.purgeExpiredDeletedServices = require("./src/scheduled/purge-trash").purgeExpiredDeletedServices;
