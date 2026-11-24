// Daily cleanup: permanently deletes offices (with all nested services) and
// services whose 30-day recovery window has passed. Recovered docs have no
// permanentDeleteAt, so they never match.
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db, Timestamp } = require("../lib/refs");
const { findServicesAcrossOffices } = require("../api/trash");

async function purgeExpired(docs, label, counts) {
  for (const docSnap of docs) {
    if (docSnap.data().isDeleted !== true) continue; // safety: never purge active docs
    try {
      await db().recursiveDelete(docSnap.ref);
      counts.purged++;
      console.log(`purgeExpiredDeletedServices: deleted ${label} ${docSnap.ref.path}`);
    } catch (error) {
      counts.failed++;
      console.error(`purgeExpiredDeletedServices: failed to delete ${docSnap.ref.path}`, error);
    }
  }
}

exports.purgeExpiredDeletedServices = onSchedule(
  { schedule: "every day 03:00", timeZone: "Asia/Manila", timeoutSeconds: 540 },
  async () => {
    const now = Timestamp.now();
    const counts = { purged: 0, failed: 0 };

    // Offices first: their services go with them, so they're not visited twice.
    try {
      const expiredOffices = await db().collection("offices").where("permanentDeleteAt", "<=", now).get();
      await purgeExpired(expiredOffices.docs, "office", counts);
    } catch (error) {
      counts.failed++;
      console.error("purgeExpiredDeletedServices: could not query offices for expired trash", error);
    }

    try {
      const expiredServices = await findServicesAcrossOffices("permanentDeleteAt", "<=", now);
      await purgeExpired(expiredServices, "service", counts);
    } catch (error) {
      counts.failed++;
      console.error("purgeExpiredDeletedServices: could not query services for expired trash", error);
    }

    console.log(`purgeExpiredDeletedServices: done, purged=${counts.purged}, failed=${counts.failed}`);
  }
);
