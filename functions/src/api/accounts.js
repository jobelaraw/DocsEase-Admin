// Account Management actions (Super Admin only): list, deactivate/reactivate, remove a login.
const admin = require("firebase-admin");
const { db, FieldValue, validId } = require("../lib/refs");
const { toMillis } = require("../lib/time");
const { invalid, notFound, forbidden } = require("../lib/errors");

const ACCOUNT_COLLECTIONS = { users: "users", admins: "admin" };

// Mobile user docs are written by the mobile app; accept the common name shapes.
function userNameOf(data, authUser) {
  const joined = [data.first_name || data.firstName, data.last_name || data.lastName].filter(Boolean).join(" ");
  return data.full_name || data.fullName || data.name || data.displayName ||
    joined || (authUser && authUser.displayName) || "";
}

// Firebase Auth records for the given uids, looked up 100 at a time (all batches in parallel).
async function authUsersByUid(uids) {
  const batches = [];
  for (let i = 0; i < uids.length; i += 100) {
    batches.push(admin.auth().getUsers(uids.slice(i, i + 100).map((uid) => ({ uid }))));
  }
  const byUid = new Map();
  (await Promise.all(batches)).forEach((result) => result.users.forEach((u) => byUid.set(u.uid, u)));
  return byUid;
}

// Lists mobile users or web admins, merged with Firebase Auth login metadata.
async function listAccounts(caller, { type }) {
  const collectionName = ACCOUNT_COLLECTIONS[type];
  if (!collectionName) throw invalid("type must be 'users' or 'admins'.");

  const snap = await db().collection(collectionName).get();
  const authByUid = await authUsersByUid(snap.docs.map((d) => d.id));

  const accounts = snap.docs.map((d) => {
    const data = d.data() || {};
    const authUser = authByUid.get(d.id) || null;
    const meta = authUser ? authUser.metadata : null;
    const lastSignIn = meta && meta.lastSignInTime ? toMillis(meta.lastSignInTime) : null;
    const lastRefresh = meta && meta.lastRefreshTime ? toMillis(meta.lastRefreshTime) : null;

    return {
      uid: d.id,
      name: type === "admins" ? (data.full_name || (authUser && authUser.displayName) || "") : userNameOf(data, authUser),
      email: data.email || (authUser && authUser.email) || "",
      office: data.admin_office || "",
      role: data.role || (type === "admins" ? "admin" : "user"),
      status: data.status || "active",
      disabled: authUser ? !!authUser.disabled : false,
      hasAuth: !!authUser,
      createdAt: toMillis(data.createdAt) || (meta ? toMillis(meta.creationTime) : null),
      lastLogin: lastSignIn,
      lastActive: Math.max(lastSignIn || 0, lastRefresh || 0) || null,
      deactivatedAt: toMillis(data.deactivated_at),
      deactivatedBy: data.deactivated_by_name || "",
      deactivationReason: data.deactivation_reason || ""
    };
  });

  return { accounts, selfUid: caller.uid };
}

// Shared checks for actions on another account. Returns the target doc ref + data.
async function loadManageableTarget(caller, type, uid) {
  const collectionName = ACCOUNT_COLLECTIONS[type];
  if (!collectionName || !validId(uid)) throw invalid("type and uid are required.");
  if (uid === caller.uid) throw invalid("You cannot change your own account here.");

  const ref = db().collection(collectionName).doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("Account not found.");
  const data = snap.data() || {};
  if (type === "admins" && data.role === "super_admin") throw forbidden("Super Admin accounts cannot be managed here.");
  return { ref, data };
}

// Ignores "user not found" so actions on accounts without a login still succeed.
async function ignoreMissingUser(promise) {
  try {
    await promise;
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
  }
}

// Deactivates (disables login, keeps the record) or reactivates an account.
async function setAccountStatus(caller, { type, uid, action, reason }) {
  if (action !== "deactivate" && action !== "reactivate") throw invalid("action must be 'deactivate' or 'reactivate'.");
  const { ref, data } = await loadManageableTarget(caller, type, uid);

  if (action === "deactivate") {
    if (data.status === "deactivated") return { success: true, status: "deactivated" };
    if (type === "admins" && data.status === "pending") {
      throw invalid("Pending admin requests are handled in the Review Queue.");
    }
    await ignoreMissingUser(admin.auth().updateUser(uid, { disabled: true }));
    await ignoreMissingUser(admin.auth().revokeRefreshTokens(uid));
    await ref.set({
      status: "deactivated",
      previous_status: data.status || "active",
      deactivated_at: FieldValue.serverTimestamp(),
      deactivated_by: caller.uid,
      deactivated_by_name: caller.name,
      deactivation_reason: String(reason || "").trim().slice(0, 500),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { success: true, status: "deactivated" };
  }

  await ignoreMissingUser(admin.auth().updateUser(uid, { disabled: false }));
  const restored = data.previous_status && data.previous_status !== "deactivated" ? data.previous_status : "active";
  await ref.set({
    status: restored,
    previous_status: FieldValue.delete(),
    deactivated_at: FieldValue.delete(),
    deactivated_by: FieldValue.delete(),
    deactivated_by_name: FieldValue.delete(),
    deactivation_reason: FieldValue.delete(),
    reactivated_at: FieldValue.serverTimestamp(),
    reactivated_by: caller.uid,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { success: true, status: restored };
}

// Removes an admin's Firebase Auth login (declined sign-up / accepted account deletion).
async function deleteAuthUser(caller, { uid }) {
  if (!validId(uid)) throw invalid("uid is required.");
  if (uid === caller.uid) throw invalid("Cannot delete your own account.");

  const adminSnap = await db().collection("admin").doc(uid).get();
  if (adminSnap.exists && (adminSnap.data() || {}).role === "super_admin") {
    throw forbidden("Super Admin accounts cannot be removed here.");
  }
  await ignoreMissingUser(admin.auth().deleteUser(uid));
  return { success: true };
}

module.exports = { listAccounts, setAccountStatus, deleteAuthUser };
