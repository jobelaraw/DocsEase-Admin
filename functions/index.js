const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();

exports.resetUserPassword = onRequest((req, res) => {
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

// Set admin custom claim for a user (only if they exist in admin collection)
exports.setAdminClaim = onRequest((req, res) => {
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
