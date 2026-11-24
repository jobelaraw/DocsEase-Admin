const { db } = require("./refs");
const { forbidden, unauthenticated } = require("./errors");

// Loads the caller's admin record and checks they may run an action.
//   role "admin"       -> any active admin (normal or Super Admin)
//   role "super_admin" -> active Super Admin only
// The callable protocol has already verified the ID token (request.auth).
async function requireRole(request, role) {
  if (!request.auth) throw unauthenticated();

  const snap = await db().collection("admin").doc(request.auth.uid).get();
  const data = snap.exists ? snap.data() || {} : null;
  if (!data || data.status !== "active") throw forbidden();
  if (role === "super_admin" && data.role !== "super_admin") throw forbidden();

  return {
    uid: request.auth.uid,
    name: data.full_name || request.auth.token.email || (data.role === "super_admin" ? "Super Admin" : "Admin"),
    role: data.role || "admin",
    office: data.admin_office || ""
  };
}

module.exports = { requireRole };
