// adminApi: one callable function for every admin-panel action.
// One function means one warm instance serves all actions (fewer cold starts),
// and the callable protocol verifies the caller's ID token and handles CORS.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { requireRole } = require("../lib/auth");
const accounts = require("./accounts");
const trash = require("./trash");
const requests = require("./requests");
const stats = require("./stats");

// action name -> who may run it + the handler (caller, data) => result
const ACTIONS = {
  listAccounts: { role: "super_admin", run: accounts.listAccounts },
  setAccountStatus: { role: "super_admin", run: accounts.setAccountStatus },
  deleteAuthUser: { role: "super_admin", run: accounts.deleteAuthUser },

  trashService: { role: "super_admin", run: trash.trashService },
  trashOffice: { role: "super_admin", run: trash.trashOffice },
  listDeleted: { role: "super_admin", run: trash.listDeleted },
  restoreService: { role: "super_admin", run: trash.restoreService },
  restoreOffice: { role: "super_admin", run: trash.restoreOffice },
  purgeService: { role: "super_admin", run: trash.purgeService },
  purgeOffice: { role: "super_admin", run: trash.purgeOffice },

  deleteCompletedRequest: { role: "super_admin", run: requests.deleteCompletedRequest },

  getStats: { role: "admin", run: stats.getStats }
};

exports.adminApi = onCall({
  timeoutSeconds: 540 // permanent deletes of large offices can take a while
  // minInstances: 1, // keeps one instance warm: no cold starts, roughly US$3-8/month
}, async (request) => {
  const { action, data } = request.data || {};
  const def = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!def) throw new HttpsError("invalid-argument", "Unknown action.");

  const caller = await requireRole(request, def.role);
  try {
    return await def.run(caller, data || {});
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error(`adminApi.${action} failed:`, error);
    throw new HttpsError("internal", "Something went wrong. Please try again.");
  }
});
