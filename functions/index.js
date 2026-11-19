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
// Trash (soft delete / recover / permanent delete) - Super Admin only
// Services and offices share one trash system:
// - Trashed services stay at offices/{officeId}/services/{serviceId}
// - Trashed offices stay at offices/{officeId}
// Both are only marked isDeleted: true, so document IDs, fields and every
// nested subcollection are kept until recovery or permanent deletion.
// ---------------------------------------------------------------------------
const { onSchedule } = require("firebase-functions/v2/scheduler");

const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Trash fields written on every trashed doc (service or office).
const BASE_TRASH_FIELDS = ["deletedAt", "deletedBy_uid", "deletedBy_name", "permanentDeleteAt"];

// Every trash field written on the service doc; recovery removes all of them.
const TRASH_FIELDS = [
  ...BASE_TRASH_FIELDS,
  "deletedFromOffice_id", "deletedFromOffice_name",
  "deletionRequest_id", "deletionRequestedBy_uid", "deletionRequestedBy_name"
];

// An office's map slot is cleared while it's trashed, and kept here for recovery.
const OFFICE_TRASH_FIELDS = [...BASE_TRASH_FIELDS, "deletedMapSlot", "deletedMapSlotV"];

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function officeRef(officeId) {
  return admin.firestore().collection("offices").doc(officeId);
}

function serviceRef(officeId, serviceId) {
  return officeRef(officeId).collection("services").doc(serviceId);
}

function validId(v) {
  return typeof v === "string" && v.length > 0 && v.length <= 1500 && !v.includes("/");
}

function validIds(officeId, serviceId) {
  return validId(officeId) && validId(serviceId);
}

// The fields that move a doc to trash, starting its 30-day recovery window.
function trashStamp(caller, nowMs) {
  return {
    isDeleted: true,
    deletedAt: admin.firestore.Timestamp.fromMillis(nowMs),
    deletedBy_uid: caller.uid,
    deletedBy_name: caller.name,
    permanentDeleteAt: admin.firestore.Timestamp.fromMillis(nowMs + TRASH_RETENTION_DAYS * DAY_MS)
  };
}

// The update that takes a doc out of trash and removes the given trash fields.
function restoreUpdate(caller, fields) {
  const FieldValue = admin.firestore.FieldValue;
  const update = {
    isDeleted: false,
    restoredAt: FieldValue.serverTimestamp(),
    restoredBy_uid: caller.uid
  };
  fields.forEach(f => { update[f] = FieldValue.delete(); });
  return update;
}

// Permanently deletes a trashed doc and everything nested under it.
// confirmName must match the doc's name exactly (second verification step).
async function purgeTrashedDoc(ref, { nameField, confirmName, label }) {
  const snap = await ref.get();
  if (!snap.exists) throw httpError(404, `This ${label} no longer exists.`);
  const data = snap.data() || {};

  // Only trashed docs can be purged; active ones are never touched here.
  if (data.isDeleted !== true) throw httpError(409, `Only ${label}s in Deleted Records can be permanently deleted.`);

  const expected = String(data[nameField] || ref.id).trim();
  if (String(confirmName || "").trim() !== expected) {
    throw httpError(400, `The ${label} name you typed does not match.`);
  }

  await admin.firestore().recursiveDelete(ref);
  return expected;
}

function trashedServiceInfo(officeDoc, serviceDoc) {
  const d = serviceDoc.data() || {};
  const officeData = officeDoc ? (officeDoc.data() || {}) : {};
  return {
    kind: "service",
    officeId: serviceDoc.ref.parent.parent.id,
    serviceId: serviceDoc.id,
    serviceName: d.service_name || serviceDoc.id,
    officeName: d.deletedFromOffice_name || officeData.office_name || serviceDoc.ref.parent.parent.id,
    officeDeleted: officeData.isDeleted === true,
    deletedAt: toMillis(d.deletedAt),
    permanentDeleteAt: toMillis(d.permanentDeleteAt),
    deletedByName: d.deletedBy_name || "",
    requestedByName: d.deletionRequestedBy_name || ""
  };
}

function trashedOfficeInfo(officeDoc, serviceCount) {
  const d = officeDoc.data() || {};
  return {
    kind: "office",
    officeId: officeDoc.id,
    officeName: d.office_name || officeDoc.id,
    serviceCount,
    deletedAt: toMillis(d.deletedAt),
    permanentDeleteAt: toMillis(d.permanentDeleteAt),
    deletedByName: d.deletedBy_name || ""
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
      const oRef = officeRef(officeId);
      const rRef = requestId ? db.collection("requests").doc(requestId) : null;

      const result = await db.runTransaction(async (tx) => {
        const [sSnap, oSnap, rSnap] = await Promise.all([
          tx.get(sRef), tx.get(oRef), rRef ? tx.get(rRef) : Promise.resolve(null)
        ]);

        let reqData = null;
        if (rRef) {
          if (!rSnap.exists) throw httpError(404, "This request no longer exists.");
          reqData = rSnap.data() || {};
          if (reqData.type !== "delete_service" || reqData.office_id !== officeId || reqData.service_id !== serviceId) {
            throw httpError(400, "Request does not match this service.");
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
            const stamp = trashStamp(caller, Date.now());
            permanentDeleteAt = stamp.permanentDeleteAt.toMillis();
            tx.update(sRef, {
              ...stamp,
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

// Moves an office to trash. Only the office doc is marked; its services and
// their subcollections are left exactly as they are, so recovery brings them all back.
exports.adminTrashOffice = onRequest({ invoker: "public" }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const caller = await requireSuperAdmin(req, res);
      if (!caller) return;

      const { officeId } = parseBody(req);
      if (!validId(officeId)) return res.status(400).json({ error: "officeId is required" });

      const FieldValue = admin.firestore.FieldValue;
      const oRef = officeRef(officeId);
      const result = await admin.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(oRef);
        if (!snap.exists) throw httpError(404, "This office no longer exists.");
        const data = snap.data() || {};
        const officeName = data.office_name || officeId;
        if (data.isDeleted === true) {
          return { trashed: false, alreadyTrashed: true, officeName, permanentDeleteAt: toMillis(data.permanentDeleteAt) };
        }

        const stamp = trashStamp(caller, Date.now());
        const update = { ...stamp };
        // Free the office's map room while it's trashed; recovery puts it back if still free.
        if (data.map_slot) {
          update.deletedMapSlot = data.map_slot;
          update.deletedMapSlotV = data.map_slot_v || FieldValue.delete();
          update.map_slot = FieldValue.delete();
          update.map_slot_v = FieldValue.delete();
        }
        tx.update(oRef, update);
        return { trashed: true, alreadyTrashed: false, officeName, permanentDeleteAt: stamp.permanentDeleteAt.toMillis() };
      });

      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error("adminTrashOffice failed:", error);
      return res.status(error.status || 500).json({ error: error.message });
    }
  });
});

// Lists every trashed office and service for the Deleted Records tab.
// Queries each office's services with a single-field equality filter,
// so no collection group index is needed.
exports.adminListDeletedServices = onRequest({ invoker: "public" }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const caller = await requireSuperAdmin(req, res);
      if (!caller) return;

      const officesSnap = await admin.firestore().collection("offices").get();
      const offices = [];
      const perOffice = await Promise.all(officesSnap.docs.map(async (officeDoc) => {
        const servicesCol = officeDoc.ref.collection("services");
        if (officeDoc.data().isDeleted === true) {
          const countSnap = await servicesCol.count().get();
          offices.push(trashedOfficeInfo(officeDoc, countSnap.data().count));
        }
        const snap = await servicesCol.where("isDeleted", "==", true).get();
        return snap.docs.map(s => trashedServiceInfo(officeDoc, s));
      }));
      const byDeletedAt = (a, b) => (b.deletedAt || 0) - (a.deletedAt || 0);
      const services = perOffice.flat().sort(byDeletedAt);
      offices.sort(byDeletedAt);
      return res.status(200).json({ services, offices, retentionDays: TRASH_RETENTION_DAYS });
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

      const sRef = serviceRef(officeId, serviceId);
      const oRef = officeRef(officeId);
      const restored = await admin.firestore().runTransaction(async (tx) => {
        const [snap, oSnap] = await Promise.all([tx.get(sRef), tx.get(oRef)]);
        if (!snap.exists) throw httpError(404, "This service no longer exists. It may have been permanently deleted.");
        const data = snap.data() || {};
        if (data.isDeleted !== true) throw httpError(409, "This service is not in Deleted Records.");
        // A service recovered into a trashed office would stay hidden
        if (oSnap.exists && oSnap.data().isDeleted === true) {
          throw httpError(409, "This service's office is in Deleted Records. Recover the office first.");
        }

        tx.update(sRef, restoreUpdate(caller, TRASH_FIELDS));
        return { serviceName: data.service_name || serviceId };
      });

      return res.status(200).json({ success: true, ...restored });
    } catch (error) {
      console.error("adminRestoreService failed:", error);
      return res.status(error.status || 500).json({ error: error.message });
    }
  });
});

// Recovers a trashed office in place: same ID, same fields, and all of its
// services and subcollections (which were never touched while it was trashed).
exports.adminRestoreOffice = onRequest({ invoker: "public" }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const caller = await requireSuperAdmin(req, res);
      if (!caller) return;

      const { officeId } = parseBody(req);
      if (!validId(officeId)) return res.status(400).json({ error: "officeId is required" });

      const db = admin.firestore();
      const oRef = officeRef(officeId);
      const restored = await db.runTransaction(async (tx) => {
        const snap = await tx.get(oRef);
        if (!snap.exists) throw httpError(404, "This office no longer exists. It may have been permanently deleted.");
        const data = snap.data() || {};
        if (data.isDeleted !== true) throw httpError(409, "This office is not in Deleted Records.");

        const update = restoreUpdate(caller, OFFICE_TRASH_FIELDS);

        // Put the office back in its map room unless another office or room took it meanwhile.
        let mapSlotRestored = false;
        if (data.deletedMapSlot) {
          const [offTaken, roomTaken] = await Promise.all([
            tx.get(db.collection("offices").where("map_slot", "==", data.deletedMapSlot).limit(1)),
            tx.get(db.collection("other_room").where("map_slot", "==", data.deletedMapSlot).limit(1))
          ]);
          if (offTaken.empty && roomTaken.empty) {
            update.map_slot = data.deletedMapSlot;
            if (data.deletedMapSlotV !== undefined) update.map_slot_v = data.deletedMapSlotV;
            mapSlotRestored = true;
          }
        }

        tx.update(oRef, update);
        return {
          officeName: data.office_name || officeId,
          mapSlotRestored,
          hadMapSlot: !!data.deletedMapSlot
        };
      });

      return res.status(200).json({ success: true, ...restored });
    } catch (error) {
      console.error("adminRestoreOffice failed:", error);
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

      const serviceName = await purgeTrashedDoc(serviceRef(officeId, serviceId), {
        nameField: "service_name", confirmName, label: "service"
      });
      console.log(`adminPurgeService: ${caller.uid} permanently deleted offices/${officeId}/services/${serviceId}`);
      return res.status(200).json({ success: true, serviceName });
    } catch (error) {
      console.error("adminPurgeService failed:", error);
      return res.status(error.status || 500).json({ error: error.message });
    }
  });
});

// Permanently deletes a trashed office, all of its services, and every nested
// subcollection and document. Requires the exact office name as a second verification step.
exports.adminPurgeOffice = onRequest({ invoker: "public", timeoutSeconds: 540 }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const caller = await requireSuperAdmin(req, res);
      if (!caller) return;

      const { officeId, confirmName } = parseBody(req);
      if (!validId(officeId)) return res.status(400).json({ error: "officeId is required" });

      const officeName = await purgeTrashedDoc(officeRef(officeId), {
        nameField: "office_name", confirmName, label: "office"
      });
      console.log(`adminPurgeOffice: ${caller.uid} permanently deleted offices/${officeId} and all nested data`);
      return res.status(200).json({ success: true, officeName });
    } catch (error) {
      console.error("adminPurgeOffice failed:", error);
      return res.status(error.status || 500).json({ error: error.message });
    }
  });
});

// Recursively deletes every trashed doc from the query whose window has passed.
async function purgeExpired(querySnap, label, counts) {
  for (const docSnap of querySnap.docs) {
    if (docSnap.data().isDeleted !== true) continue; // safety: never purge active docs
    try {
      await admin.firestore().recursiveDelete(docSnap.ref);
      counts.purged++;
      console.log(`purgeExpiredDeletedServices: deleted ${label} ${docSnap.ref.path}`);
    } catch (error) {
      counts.failed++;
      console.error(`purgeExpiredDeletedServices: failed to delete ${docSnap.ref.path}`, error);
    }
  }
}

// Permanently deletes a completed_requests history record. Done server-side
// because Firestore rules don't allow clients to delete from this collection.
exports.adminDeleteCompletedRequest = onRequest({ invoker: "public" }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const caller = await requireSuperAdmin(req, res);
      if (!caller) return;

      const { requestId } = parseBody(req);
      if (typeof requestId !== "string" || !requestId || requestId.includes("/")) {
        return res.status(400).json({ error: "requestId is required" });
      }

      const ref = admin.firestore().collection("completed_requests").doc(requestId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: "Record not found" });

      await ref.delete();
      console.log(`adminDeleteCompletedRequest: ${caller.uid} deleted completed_requests/${requestId}`);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("adminDeleteCompletedRequest failed:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

// Daily cleanup: permanently deletes offices (with all nested services) and
// services whose 30-day recovery window has passed. Recovered docs have no
// permanentDeleteAt, so they never match the query.
exports.purgeExpiredDeletedServices = onSchedule(
  { schedule: "every day 03:00", timeZone: "Asia/Manila", timeoutSeconds: 540 },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const counts = { purged: 0, failed: 0 };

    // Offices first: their services go with them, so they're not visited twice.
    try {
      const expiredOffices = await db.collection("offices").where("permanentDeleteAt", "<=", now).get();
      await purgeExpired(expiredOffices, "office", counts);
    } catch (error) {
      counts.failed++;
      console.error("purgeExpiredDeletedServices: could not query offices for expired trash", error);
    }

    const officesSnap = await db.collection("offices").get();
    for (const officeDoc of officesSnap.docs) {
      let expired;
      try {
        expired = await officeDoc.ref.collection("services").where("permanentDeleteAt", "<=", now).get();
      } catch (error) {
        counts.failed++;
        console.error(`purgeExpiredDeletedServices: could not query offices/${officeDoc.id}/services`, error);
        continue;
      }
      await purgeExpired(expired, "service", counts);
    }
    console.log(`purgeExpiredDeletedServices: done, purged=${counts.purged}, failed=${counts.failed}`);
  }
);
