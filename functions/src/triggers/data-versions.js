// Bumps the version of every cached topic a write affects (see src/lib/versions.js),
// so admin pages re-download only after a real change.
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { bump } = require("../lib/versions");

const snapshotsOf = (event) => [
  event.data.before.exists ? event.data.before.data() || {} : null,
  event.data.after.exists ? event.data.after.data() || {} : null
];
// True when the doc was created or deleted, or any of the fields changed
const changed = (before, after, fields) =>
  !before || !after || fields.some((f) => JSON.stringify(before[f]) !== JSON.stringify(after[f]));
const run = (topics) => (topics.length ? bump(...topics) : null);

// Fields that appear in Account Management (src/api/accounts.js)
const ACCOUNT_FIELDS = [
  "full_name", "fullName", "name", "displayName", "first_name", "firstName", "last_name", "lastName",
  "username", "email", "admin_office", "role", "status", "createdAt",
  "deactivated_at", "deactivated_by_name", "deactivation_reason"
];
// Fields that appear in Deleted Records (src/api/trash.js)
const TRASH_FIELDS = [
  "isDeleted", "deletedAt", "permanentDeleteAt", "deletedBy_name", "deletionRequestedBy_name",
  "deletedFromOffice_name", "office_name", "service_name"
];

// Citizens ticking requirements/steps in the mobile app
exports.versionsOnHistoryWritten = onDocumentWritten("users/{uid}/service_history/{historyId}", () => bump("stats"));

// Mobile users: sign-ups/deletions change the stats; listed fields change Account Management.
// Push tokens and other profile writes don't count.
exports.versionsOnUserWritten = onDocumentWritten("users/{uid}", (event) => {
  const [before, after] = snapshotsOf(event);
  const topics = [];
  if (!before || !after) topics.push("stats");
  if (changed(before, after, ACCOUNT_FIELDS)) topics.push("users");
  return run(topics);
});

// Admin accounts (Account Management; an admin's office also decides their stats view)
exports.versionsOnAdminWritten = onDocumentWritten("admin/{uid}", (event) => {
  const [before, after] = snapshotsOf(event);
  return run(changed(before, after, ACCOUNT_FIELDS) ? ["admins"] : []);
});

// Offices: counts/names in the stats; trash fields in Deleted Records
exports.versionsOnOfficeWritten = onDocumentWritten("offices/{officeId}", (event) => {
  const [before, after] = snapshotsOf(event);
  const topics = [];
  if (changed(before, after, ["office_name", "isDeleted"])) topics.push("stats");
  const inTrash = (before && before.isDeleted === true) || (after && after.isDeleted === true);
  if (inTrash && changed(before, after, TRASH_FIELDS)) topics.push("deleted");
  return run(topics);
});

// Services: counts/names in the stats; trash fields in Deleted Records
exports.versionsOnServiceWritten = onDocumentWritten("offices/{officeId}/services/{serviceId}", (event) => {
  const [before, after] = snapshotsOf(event);
  const topics = [];
  if (changed(before, after, ["service_name", "isDeleted"])) topics.push("stats");
  const inTrash = (before && before.isDeleted === true) || (after && after.isDeleted === true);
  if (inTrash && changed(before, after, TRASH_FIELDS)) topics.push("deleted");
  return run(topics);
});
