// Trash (soft delete / recover / permanent delete) - Super Admin only.
// Services and offices share one trash system:
// - Trashed services stay at offices/{officeId}/services/{serviceId}
// - Trashed offices stay at offices/{officeId}
// Both are only marked isDeleted: true, so document IDs, fields and every
// nested subcollection are kept until recovery or permanent deletion.
const { db, FieldValue, Timestamp, officeRef, serviceRef, validId } = require("../lib/refs");
const { DAY_MS, toMillis } = require("../lib/time");
const { invalid, notFound, conflict } = require("../lib/errors");

const TRASH_RETENTION_DAYS = 30;

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

function requireIds(officeId, serviceId) {
  if (!validId(officeId) || (serviceId !== undefined && !validId(serviceId))) {
    throw invalid(serviceId === undefined ? "officeId is required." : "officeId and serviceId are required.");
  }
}

// The fields that move a doc to trash, starting its recovery window.
function trashStamp(caller, nowMs) {
  return {
    isDeleted: true,
    deletedAt: Timestamp.fromMillis(nowMs),
    deletedBy_uid: caller.uid,
    deletedBy_name: caller.name,
    permanentDeleteAt: Timestamp.fromMillis(nowMs + TRASH_RETENTION_DAYS * DAY_MS)
  };
}

// The update that takes a doc out of trash and removes the given trash fields.
function restoreUpdate(caller, fields) {
  const update = { isDeleted: false, restoredAt: FieldValue.serverTimestamp(), restoredBy_uid: caller.uid };
  fields.forEach((f) => { update[f] = FieldValue.delete(); });
  return update;
}

// Moves a service to trash. With requestId, also completes that delete_service
// request (copy to completed_requests + remove from requests) in the same transaction.
async function trashService(caller, { officeId, serviceId, requestId }) {
  requireIds(officeId, serviceId);
  if (requestId !== undefined && !validId(requestId)) throw invalid("Invalid requestId.");

  const sRef = serviceRef(officeId, serviceId);
  const oRef = officeRef(officeId);
  const rRef = requestId ? db().collection("requests").doc(requestId) : null;

  const result = await db().runTransaction(async (tx) => {
    const [sSnap, oSnap, rSnap] = await Promise.all([tx.get(sRef), tx.get(oRef), rRef ? tx.get(rRef) : null]);

    let reqData = null;
    if (rRef) {
      if (!rSnap.exists) throw notFound("This request no longer exists.");
      reqData = rSnap.data() || {};
      if (reqData.type !== "delete_service" || reqData.office_id !== officeId || reqData.service_id !== serviceId) {
        throw invalid("Request does not match this service.");
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
      tx.set(db().collection("completed_requests").doc(requestId), {
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

  return { success: true, ...result };
}

// Moves an office to trash. Only the office doc is marked; its services and
// their subcollections are left exactly as they are, so recovery brings them all back.
async function trashOffice(caller, { officeId }) {
  requireIds(officeId);
  const oRef = officeRef(officeId);

  const result = await db().runTransaction(async (tx) => {
    const snap = await tx.get(oRef);
    if (!snap.exists) throw notFound("This office no longer exists.");
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

  return { success: true, ...result };
}

// Service docs matching a filter across every office.
// One collection-group query (needs the services.* collection-group index in
// firestore.indexes.json). If that index isn't ready yet, fall back to one query per office.
async function findServicesAcrossOffices(field, op, value) {
  try {
    const snap = await db().collectionGroup("services").where(field, op, value).get();
    return snap.docs;
  } catch (error) {
    if (error.code !== 9) throw error; // 9 = FAILED_PRECONDITION (missing index)
    console.warn(`services.${field} collection-group index missing; querying office by office.`);
    const offices = await db().collection("offices").get();
    const perOffice = await Promise.all(offices.docs.map((o) => o.ref.collection("services").where(field, op, value).get()));
    return perOffice.flatMap((s) => s.docs);
  }
}

// Lists every trashed office and service for the Deleted Records tab.
async function listDeleted() {
  const [serviceDocs, trashedOffices] = await Promise.all([
    findServicesAcrossOffices("isDeleted", "==", true),
    db().collection("offices").where("isDeleted", "==", true).get()
  ]);
  // Only services that live under offices/{id}/services count.
  const services = serviceDocs.filter((s) => s.ref.parent.parent && s.ref.parent.parent.parent.id === "offices");

  // Parent offices of the trashed services, in one batched read.
  const parentRefs = [...new Map(services.map((s) => [s.ref.parent.parent.path, s.ref.parent.parent])).values()];
  const parents = parentRefs.length ? await db().getAll(...parentRefs) : [];
  const officeById = new Map(parents.map((o) => [o.id, o.exists ? o.data() || {} : {}]));

  const serviceRows = services.map((s) => {
    const d = s.data() || {};
    const officeId = s.ref.parent.parent.id;
    const officeData = officeById.get(officeId) || {};
    return {
      kind: "service",
      officeId,
      serviceId: s.id,
      serviceName: d.service_name || s.id,
      officeName: d.deletedFromOffice_name || officeData.office_name || officeId,
      officeDeleted: officeData.isDeleted === true,
      deletedAt: toMillis(d.deletedAt),
      permanentDeleteAt: toMillis(d.permanentDeleteAt),
      deletedByName: d.deletedBy_name || "",
      requestedByName: d.deletionRequestedBy_name || ""
    };
  });

  const officeRows = await Promise.all(trashedOffices.docs.map(async (o) => {
    const d = o.data() || {};
    const count = await o.ref.collection("services").count().get();
    return {
      kind: "office",
      officeId: o.id,
      officeName: d.office_name || o.id,
      serviceCount: count.data().count,
      deletedAt: toMillis(d.deletedAt),
      permanentDeleteAt: toMillis(d.permanentDeleteAt),
      deletedByName: d.deletedBy_name || ""
    };
  }));

  const byDeletedAt = (a, b) => (b.deletedAt || 0) - (a.deletedAt || 0);
  return {
    services: serviceRows.sort(byDeletedAt),
    offices: officeRows.sort(byDeletedAt),
    retentionDays: TRASH_RETENTION_DAYS
  };
}

// Recovers a trashed service in place: same path, same ID, same subcollections.
async function restoreService(caller, { officeId, serviceId }) {
  requireIds(officeId, serviceId);
  const sRef = serviceRef(officeId, serviceId);
  const oRef = officeRef(officeId);

  const restored = await db().runTransaction(async (tx) => {
    const [snap, oSnap] = await Promise.all([tx.get(sRef), tx.get(oRef)]);
    if (!snap.exists) throw notFound("This service no longer exists. It may have been permanently deleted.");
    const data = snap.data() || {};
    if (data.isDeleted !== true) throw conflict("This service is not in Deleted Records.");
    // A service recovered into a trashed office would stay hidden
    if (oSnap.exists && oSnap.data().isDeleted === true) {
      throw conflict("This service's office is in Deleted Records. Recover the office first.");
    }
    tx.update(sRef, restoreUpdate(caller, TRASH_FIELDS));
    return { serviceName: data.service_name || serviceId };
  });

  return { success: true, ...restored };
}

// Recovers a trashed office in place: same ID, same fields, and all of its
// services and subcollections (which were never touched while it was trashed).
async function restoreOffice(caller, { officeId }) {
  requireIds(officeId);
  const oRef = officeRef(officeId);

  const restored = await db().runTransaction(async (tx) => {
    const snap = await tx.get(oRef);
    if (!snap.exists) throw notFound("This office no longer exists. It may have been permanently deleted.");
    const data = snap.data() || {};
    if (data.isDeleted !== true) throw conflict("This office is not in Deleted Records.");

    const update = restoreUpdate(caller, OFFICE_TRASH_FIELDS);

    // Put the office back in its map room unless another office or room took it meanwhile.
    let mapSlotRestored = false;
    if (data.deletedMapSlot) {
      const [offTaken, roomTaken] = await Promise.all([
        tx.get(db().collection("offices").where("map_slot", "==", data.deletedMapSlot).limit(1)),
        tx.get(db().collection("other_room").where("map_slot", "==", data.deletedMapSlot).limit(1))
      ]);
      if (offTaken.empty && roomTaken.empty) {
        update.map_slot = data.deletedMapSlot;
        if (data.deletedMapSlotV !== undefined) update.map_slot_v = data.deletedMapSlotV;
        mapSlotRestored = true;
      }
    }

    tx.update(oRef, update);
    return { officeName: data.office_name || officeId, mapSlotRestored, hadMapSlot: !!data.deletedMapSlot };
  });

  return { success: true, ...restored };
}

// Permanently deletes a trashed doc and everything nested under it.
// confirmName must match the doc's name exactly (second verification step).
async function purgeTrashedDoc(ref, { nameField, confirmName, label }) {
  const snap = await ref.get();
  if (!snap.exists) throw notFound(`This ${label} no longer exists.`);
  const data = snap.data() || {};

  // Only trashed docs can be purged; active ones are never touched here.
  if (data.isDeleted !== true) throw conflict(`Only ${label}s in Deleted Records can be permanently deleted.`);

  const expected = String(data[nameField] || ref.id).trim();
  if (String(confirmName || "").trim() !== expected) throw invalid(`The ${label} name you typed does not match.`);

  await db().recursiveDelete(ref);
  return expected;
}

// Permanently deletes a trashed service and all nested subcollections.
async function purgeService(caller, { officeId, serviceId, confirmName }) {
  requireIds(officeId, serviceId);
  const serviceName = await purgeTrashedDoc(serviceRef(officeId, serviceId), { nameField: "service_name", confirmName, label: "service" });
  console.log(`purgeService: ${caller.uid} permanently deleted offices/${officeId}/services/${serviceId}`);
  return { success: true, serviceName };
}

// Permanently deletes a trashed office, all of its services, and every nested
// subcollection and document.
async function purgeOffice(caller, { officeId, confirmName }) {
  requireIds(officeId);
  const officeName = await purgeTrashedDoc(officeRef(officeId), { nameField: "office_name", confirmName, label: "office" });
  console.log(`purgeOffice: ${caller.uid} permanently deleted offices/${officeId} and all nested data`);
  return { success: true, officeName };
}

module.exports = {
  TRASH_RETENTION_DAYS,
  findServicesAcrossOffices,
  trashService, trashOffice, listDeleted, restoreService, restoreOffice, purgeService, purgeOffice
};
