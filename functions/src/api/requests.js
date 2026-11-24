// Review Queue history actions (Super Admin only).
const { db, validId } = require("../lib/refs");
const { invalid, notFound } = require("../lib/errors");

// Permanently deletes a completed_requests history record. Done server-side
// because Firestore rules don't allow clients to delete from this collection.
async function deleteCompletedRequest(caller, { requestId }) {
  if (!validId(requestId)) throw invalid("requestId is required.");

  const ref = db().collection("completed_requests").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("Record not found.");

  await ref.delete();
  console.log(`deleteCompletedRequest: ${caller.uid} deleted completed_requests/${requestId}`);
  return { success: true };
}

module.exports = { deleteCompletedRequest };
