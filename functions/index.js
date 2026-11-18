const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();

exports.isAdminEmailRegistered = onCall(async (request) => {
  const email = request.data && request.data.email
    ? request.data.email.trim().toLowerCase()
    : '';

  if (!email) {
    throw new HttpsError('invalid-argument', 'Email is required.');
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    const adminDoc = await admin.firestore().collection('admin').doc(userRecord.uid).get();
    return { exists: adminDoc.exists };
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return { exists: false };
    }
    console.error('Unable to check admin email:', error);
    throw new HttpsError('internal', 'Unable to check the email address.');
  }
});

exports.adminResetUserPassword = onRequest({ invoker: "public" }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }

    const email = body.email;
    const newPassword = body.newPassword;

    if (!email || !newPassword) {
      return res.status(400).json({ error: "Email and newPassword are required", received: body });
    }

    try {
      const user = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(user.uid, { password: newPassword });
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
});

// Deletes a Firebase Auth user. Only callable by the Super Admin.
exports.adminDeleteAuthUser = onRequest({ invoker: "public" }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      // Verify the caller's Firebase ID token
      const header = req.headers.authorization || "";
      const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
      if (!idToken) {
        return res.status(401).json({ error: "Missing token" });
      }
      const caller = await admin.auth().verifyIdToken(idToken);

      // Verify the caller is the Super Admin
      const callerDoc = await admin.firestore().collection("admin").doc(caller.uid).get();
      if (!callerDoc.exists || callerDoc.data().role !== "super_admin") {
        return res.status(403).json({ error: "Not allowed" });
      }

      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
      const uid = body && body.uid;
      if (!uid) {
        return res.status(400).json({ error: "uid is required" });
      }

      // Never let the Super Admin delete themselves by accident
      if (uid === caller.uid) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      try {
        await admin.auth().deleteUser(uid);
      } catch (e) {
        if (e.code !== "auth/user-not-found") throw e; // already gone is fine
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("adminDeleteAuthUser failed:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

// Set admin custom claim for a user (only if they exist in admin collection)
exports.setAdminClaim = onRequest({ invoker: "public" }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({ error: "uid is required" });
    }

    try {
      // Verify user exists in admin collection
      const adminDoc = await admin.firestore().collection("admin").doc(uid).get();
      if (!adminDoc.exists) {
        return res.status(403).json({ error: "User is not an admin" });
      }
      await admin.auth().setCustomUserClaims(uid, { admin: true });
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
});

// Auto-set admin claim when a new user is created in 'admin' collection
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

exports.onAdminCreated = onDocumentCreated("admin/{userId}", async (event) => {
  const userId = event.params.userId;
  try {
    await admin.auth().setCustomUserClaims(userId, { admin: true });
    // Auto-verify email so both email/password and Google can coexist
    await admin.auth().updateUser(userId, { emailVerified: true });
    console.log(`Admin claim set and email verified for user: ${userId}`);
  } catch (error) {
    console.error(`Failed to set admin claim for ${userId}:`, error);
  }
});
// ---------------------------------------------------------------------------
// Account Management (Super Admin only)
// ---------------------------------------------------------------------------

// Verifies the Bearer token and that the caller is an active Super Admin.
// Returns the caller's uid, or sends an error response and returns null.
async function requireSuperAdmin(req, res) {
  const header = req.headers.authorization || "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!idToken) {
    res.status(401).json({ error: "Missing token" });
    return null;
  }
  let caller;
  try {
    caller = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    res.status(401).json({ error: "Invalid token" });
    return null;
  }
  const callerDoc = await admin.firestore().collection("admin").doc(caller.uid).get();
  const data = callerDoc.exists ? callerDoc.data() : null;
  if (!data || data.role !== "super_admin" || data.status !== "active") {
    res.status(403).json({ error: "Not allowed" });
    return null;
  }
  return { uid: caller.uid, name: data.full_name || caller.email || "Super Admin" };
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  return body || {};
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// Mobile user docs are written by the mobile app; accept common name shapes.
function userNameOf(data, authUser) {
  const joined = [data.first_name || data.firstName, data.last_name || data.lastName]
    .filter(Boolean).join(" ");
  return data.full_name || data.fullName || data.name || data.displayName ||
    joined || (authUser && authUser.displayName) || "";
}

const ACCOUNT_COLLECTIONS = { users: "users", admins: "admin" };

// Lists mobile users or web admins, merged with Firebase Auth login metadata.
exports.adminListAccounts = onRequest({ invoker: "public" }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const caller = await requireSuperAdmin(req, res);
      if (!caller) return;

      const { type } = parseBody(req);
      const collectionName = ACCOUNT_COLLECTIONS[type];
      if (!collectionName) return res.status(400).json({ error: "type must be 'users' or 'admins'" });

      const snap = await admin.firestore().collection(collectionName).get();

      // Firebase Auth lookups, 100 uids per call
      const authByUid = new Map();
      const uids = snap.docs.map(d => d.id);
      for (let i = 0; i < uids.length; i += 100) {
        const result = await admin.auth().getUsers(uids.slice(i, i + 100).map(uid => ({ uid })));
        result.users.forEach(u => authByUid.set(u.uid, u));
      }

      const accounts = snap.docs.map(d => {
        const data = d.data() || {};
        const authUser = authByUid.get(d.id) || null;
        const meta = authUser ? authUser.metadata : null;
        const lastSignIn = meta && meta.lastSignInTime ? toMillis(meta.lastSignInTime) : null;
        const lastRefresh = meta && meta.lastRefreshTime ? toMillis(meta.lastRefreshTime) : null;
        const lastActive = Math.max(lastSignIn || 0, lastRefresh || 0) || null;

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
          lastActive,
          deactivatedAt: toMillis(data.deactivated_at),
          deactivatedBy: data.deactivated_by_name || "",
          deactivationReason: data.deactivation_reason || ""
        };
      });

      return res.status(200).json({ accounts, selfUid: caller.uid });
    } catch (error) {
      console.error("adminListAccounts failed:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

// Shared checks for actions on another account. Returns the target doc ref + data, or null.
async function loadManageableTarget(res, caller, type, uid) {
  const collectionName = ACCOUNT_COLLECTIONS[type];
  if (!collectionName || !uid) {
    res.status(400).json({ error: "type and uid are required" });
    return null;
  }
  if (uid === caller.uid) {
    res.status(400).json({ error: "You cannot change your own account here." });
    return null;
  }
  const ref = admin.firestore().collection(collectionName).doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "Account not found." });
    return null;
  }
  const data = snap.data() || {};
  if (type === "admins" && data.role === "super_admin") {
    res.status(403).json({ error: "Super Admin accounts cannot be managed here." });
    return null;
  }
  return { ref, data };
}

// Deactivates (disables login, keeps the record) or reactivates an account.
exports.adminSetAccountStatus = onRequest({ invoker: "public" }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const caller = await requireSuperAdmin(req, res);
      if (!caller) return;

      const { type, uid, action, reason } = parseBody(req);
      if (action !== "deactivate" && action !== "reactivate") {
        return res.status(400).json({ error: "action must be 'deactivate' or 'reactivate'" });
      }
      const target = await loadManageableTarget(res, caller, type, uid);
      if (!target) return;
      const { ref, data } = target;
      const FieldValue = admin.firestore.FieldValue;

      if (action === "deactivate") {
        if (data.status === "deactivated") return res.status(200).json({ success: true, status: "deactivated" });
        if (type === "admins" && data.status === "pending") {
          return res.status(400).json({ error: "Pending admin requests are handled in the Review Queue." });
        }
        try {
          await admin.auth().updateUser(uid, { disabled: true });
          await admin.auth().revokeRefreshTokens(uid);
        } catch (e) {
          if (e.code !== "auth/user-not-found") throw e;
        }
        await ref.set({
          status: "deactivated",
          previous_status: data.status || "active",
          deactivated_at: FieldValue.serverTimestamp(),
          deactivated_by: caller.uid,
          deactivated_by_name: caller.name,
          deactivation_reason: String(reason || "").trim().slice(0, 500),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        return res.status(200).json({ success: true, status: "deactivated" });
      }

      // reactivate
      try {
        await admin.auth().updateUser(uid, { disabled: false });
      } catch (e) {
        if (e.code !== "auth/user-not-found") throw e;
      }
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
      return res.status(200).json({ success: true, status: restored });
    } catch (error) {
      console.error("adminSetAccountStatus failed:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

// ---------------------------------------------------------------------------
// Service Trash (soft delete / recover / permanent delete) - Super Admin only
// Trashed services stay at offices/{officeId}/services/{serviceId} with
// isDeleted: true, so the document ID, fields and subcollections are kept.
// ---------------------------------------------------------------------------
const { onSchedule } = require("firebase-functions/v2/scheduler");

const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Every trash field written on the service doc; recovery removes all of them.
const TRASH_FIELDS = [
  "deletedAt", "deletedBy_uid", "deletedBy_name", "permanentDeleteAt",
  "deletedFromOffice_id", "deletedFromOffice_name",
  "deletionRequest_id", "deletionRequestedBy_uid", "deletionRequestedBy_name"
];

function serviceRef(officeId, serviceId) {
  return admin.firestore().collection("offices").doc(officeId).collection("services").doc(serviceId);
}

function validIds(officeId, serviceId) {
  const ok = v => typeof v === "string" && v.length > 0 && v.length <= 1500 && !v.includes("/");
  return ok(officeId) && ok(serviceId);
}

function trashedServiceInfo(officeDoc, serviceDoc) {
  const d = serviceDoc.data() || {};
  const officeData = officeDoc ? (officeDoc.data() || {}) : {};
  return {
    officeId: serviceDoc.ref.parent.parent.id,
    serviceId: serviceDoc.id,
    serviceName: d.service_name || serviceDoc.id,
    officeName: d.deletedFromOffice_name || officeData.office_name || serviceDoc.ref.parent.parent.id,
    deletedAt: toMillis(d.deletedAt),
    permanentDeleteAt: toMillis(d.permanentDeleteAt),
    deletedByName: d.deletedBy_name || "",
    requestedByName: d.deletionRequestedBy_name || ""
  };
}

// Moves a service to trash. With requestId, also completes that delete_service
// request (copy to completed_requests + remove from requests) in the same transaction.
exports.adminTrashService = onRequest({ invoker: "public" }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const caller = await requireSuperAdmin(req, res);
      if (!caller) return;

      const { officeId, serviceId, requestId } = parseBody(req);
      if (!validIds(officeId, serviceId)) return res.status(400).json({ error: "officeId and serviceId are required" });
      if (requestId !== undefined && (typeof requestId !== "string" || !requestId || requestId.includes("/"))) {
        return res.status(400).json({ error: "Invalid requestId" });
      }

      const db = admin.firestore();
      const FieldValue = admin.firestore.FieldValue;
      const sRef = serviceRef(officeId, serviceId);
      const oRef = db.collection("offices").doc(officeId);
      const rRef = requestId ? db.collection("requests").doc(requestId) : null;

      const result = await db.runTransaction(async (tx) => {
        const [sSnap, oSnap, rSnap] = await Promise.all([
          tx.get(sRef), tx.get(oRef), rRef ? tx.get(rRef) : Promise.resolve(null)
        ]);

        let reqData = null;
        if (rRef) {
          if (!rSnap.exists) throw Object.assign(new Error("This request no longer exists."), { status: 404 });
          reqData = rSnap.data() || {};
          if (reqData.type !== "delete_service" || reqData.office_id !== officeId || reqData.service_id !== serviceId) {
            throw Object.assign(new Error("Request does not match this service."), { status: 400 });
          }
        }

        let trashed = false;
        let alreadyTrashed = false;
        let permanentDeleteAt = null;
        if (sSnap.exists) {
          const sData = sSnap.data() || {};
          if (sData.isDeleted === true) {
            alreadyTrashed = true;
            permanentDeleteAt = toMillis(sData.permanentDeleteAt);
          } else {
            const now = Date.now();
            permanentDeleteAt = now + TRASH_RETENTION_DAYS * DAY_MS;
            tx.update(sRef, {
              isDeleted: true,
              deletedAt: admin.firestore.Timestamp.fromMillis(now),
              deletedBy_uid: caller.uid,
              deletedBy_name: caller.name,
              permanentDeleteAt: admin.firestore.Timestamp.fromMillis(permanentDeleteAt),
              deletedFromOffice_id: officeId,
              deletedFromOffice_name: (oSnap.exists && oSnap.data().office_name) || (reqData && reqData.office_name) || officeId,
              deletionRequest_id: requestId || FieldValue.delete(),
              deletionRequestedBy_uid: (reqData && reqData.requested_by_uid) || FieldValue.delete(),
              deletionRequestedBy_name: (reqData && reqData.requested_by_name) || FieldValue.delete()
            });
            trashed = true;
          }
        }

        if (rRef) {
          tx.set(db.collection("completed_requests").doc(requestId), {
            ...reqData,
            status: "completed",
            resolvedAt: FieldValue.serverTimestamp(),
            resolvedBy_uid: caller.uid,
            resolvedBy_name: caller.name
          });
          tx.delete(rRef);
        }

        return { trashed, alreadyTrashed, serviceFound: sSnap.exists, permanentDeleteAt };
      });

      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error("adminTrashService failed:", error);
      return res.status(error.status || 500).json({ error: error.message });
    }
  });
});

// Lists every trashed service. Queries each office's services with a
// single-field equality filter, so no collection group index is needed.
exports.adminListDeletedServices = onRequest({ invoker: "public" }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const caller = await requireSuperAdmin(req, res);
      if (!caller) return;

      const officesSnap = await admin.firestore().collection("offices").get();
      const perOffice = await Promise.all(officesSnap.docs.map(async (officeDoc) => {
        const snap = await officeDoc.ref.collection("services").where("isDeleted", "==", true).get();
        return snap.docs.map(s => trashedServiceInfo(officeDoc, s));
      }));
      const services = perOffice.flat().sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
      return res.status(200).json({ services, retentionDays: TRASH_RETENTION_DAYS });
    } catch (error) {
      console.error("adminListDeletedServices failed:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

// Recovers a trashed service in place: same path, same ID, same subcollections.
exports.adminRestoreService = onRequest({ invoker: "public" }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const caller = await requireSuperAdmin(req, res);
      if (!caller) return;

      const { officeId, serviceId } = parseBody(req);
      if (!validIds(officeId, serviceId)) return res.status(400).json({ error: "officeId and serviceId are required" });

      const FieldValue = admin.firestore.FieldValue;
      const sRef = serviceRef(officeId, serviceId);
      const restored = await admin.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(sRef);
        if (!snap.exists) throw Object.assign(new Error("This service no longer exists. It may have been permanently deleted."), { status: 404 });
        const data = snap.data() || {};
        if (data.isDeleted !== true) throw Object.assign(new Error("This service is not in Deleted Records."), { status: 409 });

        const update = {
          isDeleted: false,
          restoredAt: FieldValue.serverTimestamp(),
          restoredBy_uid: caller.uid
        };
        TRASH_FIELDS.forEach(f => { update[f] = FieldValue.delete(); });
        tx.update(sRef, update);
        return { serviceName: data.service_name || serviceId };
      });

      return res.status(200).json({ success: true, ...restored });
    } catch (error) {
      console.error("adminRestoreService failed:", error);
      return res.status(error.status || 500).json({ error: error.message });
    }
  });
});

// Permanently deletes a trashed service and all nested subcollections.
// Requires the exact service name as a second verification step.
exports.adminPurgeService = onRequest({ invoker: "public", timeoutSeconds: 300 }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const caller = await requireSuperAdmin(req, res);
      if (!caller) return;

      const { officeId, serviceId, confirmName } = parseBody(req);
      if (!validIds(officeId, serviceId)) return res.status(400).json({ error: "officeId and serviceId are required" });

      const sRef = serviceRef(officeId, serviceId);
      const snap = await sRef.get();
      if (!snap.exists) return res.status(404).json({ error: "This service no longer exists." });
      const data = snap.data() || {};

      // Only trashed services can be purged; active services are never touched here.
      if (data.isDeleted !== true) return res.status(409).json({ error: "Only services in Deleted Records can be permanently deleted." });

      const expected = String(data.service_name || serviceId).trim();
      if (String(confirmName || "").trim() !== expected) {
        return res.status(400).json({ error: "The service name you typed does not match." });
      }

      await admin.firestore().recursiveDelete(sRef);
      console.log(`adminPurgeService: ${caller.uid} permanently deleted offices/${officeId}/services/${serviceId}`);
      return res.status(200).json({ success: true, serviceName: expected });
    } catch (error) {
      console.error("adminPurgeService failed:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

// Daily cleanup: permanently deletes services whose 30-day recovery window has passed.
// Recovered services have no permanentDeleteAt, so they never match the query.
exports.purgeExpiredDeletedServices = onSchedule(
  { schedule: "every day 03:00", timeZone: "Asia/Manila", timeoutSeconds: 540 },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const officesSnap = await db.collection("offices").get();
    let purged = 0;
    let failed = 0;

    for (const officeDoc of officesSnap.docs) {
      let expired;
      try {
        expired = await officeDoc.ref.collection("services").where("permanentDeleteAt", "<=", now).get();
      } catch (error) {
        failed++;
        console.error(`purgeExpiredDeletedServices: could not query offices/${officeDoc.id}/services`, error);
        continue;
      }
      for (const serviceDoc of expired.docs) {
        if (serviceDoc.data().isDeleted !== true) continue; // safety: never purge active services
        try {
          await db.recursiveDelete(serviceDoc.ref);
          purged++;
          console.log(`purgeExpiredDeletedServices: deleted ${serviceDoc.ref.path}`);
        } catch (error) {
          failed++;
          console.error(`purgeExpiredDeletedServices: failed to delete ${serviceDoc.ref.path}`, error);
        }
      }
    }
    console.log(`purgeExpiredDeletedServices: done, purged=${purged}, failed=${failed}`);
  }
);
