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