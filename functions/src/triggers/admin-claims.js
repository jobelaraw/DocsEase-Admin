const admin = require("firebase-admin");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

// Gives every new admin/{uid} doc the `admin` custom claim and marks the email
// verified, so email/password and Google sign-in can coexist on one account.
exports.onAdminCreated = onDocumentCreated("admin/{userId}", async (event) => {
  const userId = event.params.userId;
  try {
    await admin.auth().setCustomUserClaims(userId, { admin: true });
    await admin.auth().updateUser(userId, { emailVerified: true });
    console.log(`Admin claim set and email verified for user: ${userId}`);
  } catch (error) {
    console.error(`Failed to set admin claim for ${userId}:`, error);
  }
});
