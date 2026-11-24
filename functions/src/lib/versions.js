// Version numbers for the data the admin pages cache in the browser.
//
// meta/versions holds one counter per topic. Firestore triggers
// (src/triggers/data-versions.js) bump a topic whenever data it covers changes.
// A page sends the version of the copy it already has; if nothing changed the
// server answers { unchanged: true } after a single read, otherwise it sends the
// data with the new version. No timers: the browser only re-downloads after a change.
//
//   stats   - Dashboard / Analytics numbers
//   users   - Account Management: mobile users
//   admins  - Account Management: admins
//   deleted - Review Queue: Deleted Records
const { db, FieldValue } = require("./refs");

const VERSIONS_DOC = "meta/versions";
const TOPICS = ["stats", "users", "admins", "deleted"];

function bump(...topics) {
  const update = {};
  topics.forEach((t) => { update[t] = FieldValue.increment(1); });
  return db().doc(VERSIONS_DOC).set(update, { merge: true });
}

async function currentVersions() {
  const snap = await db().doc(VERSIONS_DOC).get();
  const out = {};
  TOPICS.forEach((t) => { out[t] = (snap.exists && snap.get(t)) || 0; });
  return out;
}

// Reads the topic's version *before* loading, so a change that lands while
// loading leaves the version behind and the next request loads again.
//   suffix: extra parts that change what this caller sees (e.g. the date, their office)
async function withVersion(topic, knownVersion, load, suffix = "") {
  const versions = await currentVersions();
  const version = `${versions[topic]}${suffix ? `:${suffix}` : ""}`;
  if (knownVersion && knownVersion === version) return { version, unchanged: true };
  const data = await load(versions[topic]);
  return { version, data };
}

module.exports = { bump, currentVersions, withVersion, TOPICS };
