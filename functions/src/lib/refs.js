const admin = require("firebase-admin");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = () => admin.firestore();

const officeRef = (officeId) => db().collection("offices").doc(officeId);
const serviceRef = (officeId, serviceId) => officeRef(officeId).collection("services").doc(serviceId);

// Document IDs coming from the browser: non-empty, no path separators.
function validId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 1500 && !value.includes("/");
}

module.exports = { db, FieldValue, Timestamp, officeRef, serviceRef, validId };
