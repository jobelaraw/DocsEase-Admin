// Citizen notifications for new/changed services and new offices.
// The admin panel stamps a fresh random `notify_id` on the service/office doc when an
// admin saves it; that is the only thing that sends notifications. Maintenance scripts
// (which don't stamp it), translation updates and trash/restore writes stay silent.
// Each citizen gets users/{uid}/notifications/{notify_id} - the same fields the mobile
// app reads (title, body, service_id, is_read, timestamp). Using notify_id as the doc ID
// makes a retried trigger overwrite instead of notifying twice.
const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { db, FieldValue, officeRef } = require("../lib/refs");

async function notifyAllCitizens(notifyId, { title, body, serviceId = "" }) {
  const users = await db().collection("users").select().get();
  const writer = db().bulkWriter();
  writer.onWriteError((error) => {
    if (error.failedAttempts < 3) return true; // retry a couple of times
    console.error(`citizen-notify: could not write ${error.documentRef.path}:`, error.message);
    return false;
  });
  users.docs.forEach((u) => {
    writer.set(u.ref.collection("notifications").doc(notifyId), {
      title,
      body,
      service_id: serviceId,
      is_read: false,
      timestamp: FieldValue.serverTimestamp()
    });
  });
  await writer.close();
  console.log(`citizen-notify: "${title}" sent to ${users.size} citizens (${notifyId})`);
}

function validNotifyId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

exports.onServiceWritten = onDocumentWritten("offices/{officeId}/services/{serviceId}", async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after || after.isDeleted === true || !validNotifyId(after.notify_id)) return;
  if (before && before.notify_id === after.notify_id) return;

  const { officeId, serviceId } = event.params;
  const serviceName = after.service_name || serviceId;
  const isNew = !before || before.isDeleted === true;

  if (isNew) {
    const office = await officeRef(officeId).get();
    const officeName = (office.exists && office.get("office_name")) || officeId;
    await notifyAllCitizens(after.notify_id, {
      title: "Hi Citizen! A new service added.",
      body: `${serviceName} has been added to the ${officeName}.`,
      serviceId
    });
  } else {
    await notifyAllCitizens(after.notify_id, {
      title: "Hi Citizen! Look, there’s some changes.",
      body: `The ${serviceName} service has some changes, come check it out.`,
      serviceId
    });
  }
});

exports.onOfficeCreated = onDocumentCreated("offices/{officeId}", async (event) => {
  const office = event.data ? event.data.data() : null;
  if (!office || office.isDeleted === true || !validNotifyId(office.notify_id)) return;
  const officeName = office.office_name || event.params.officeId;
  await notifyAllCitizens(office.notify_id, {
    title: "Hi Citizen! A new office added",
    body: `A new office, ${officeName}, is now available on GaBayan.`
  });
});
