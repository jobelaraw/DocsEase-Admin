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
