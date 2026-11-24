// Office / room maintenance (Super Admin only).
const { db, validId } = require("../lib/refs");
const { invalid, notFound, conflict } = require("../lib/errors");

const NAME_FIELD = { offices: "office_name", other_room: "room_name" };

// Renames an office or room everywhere it is referenced by name:
// - admins linked to the office (admin.admin_office)
// - every service step whose "Navigate to" points at it (tabs[].procedures[].navigate_to)
// Without this, renaming an office locked its admins out and broke navigation steps.
async function renameOffice(caller, { collection, officeId, name }) {
  const nameField = NAME_FIELD[collection];
  if (!nameField || !validId(officeId)) throw invalid("collection and officeId are required.");
  const newName = String(name || "").replace(/\s+/g, " ").trim();
  if (!newName || newName.length > 100 || newName.includes("/")) throw invalid("Please enter a valid name.");

  const ref = db().collection(collection).doc(officeId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("This office no longer exists.");
  const oldName = String(snap.get(nameField) || officeId).trim();
  if (oldName === newName) return { success: true, renamed: false };

  const [offices, rooms] = await Promise.all([db().collection("offices").get(), db().collection("other_room").get()]);
  const clash = [...offices.docs, ...rooms.docs].find((d) =>
    d.id !== officeId && String(d.get("office_name") || d.get("room_name") || d.id).trim().toLowerCase() === newName.toLowerCase());
  if (clash) throw conflict("An office or room with this name already exists.");

  const same = (value) => String(value || "").trim().toLowerCase() === oldName.toLowerCase();
  const writer = db().bulkWriter();
  writer.update(ref, { [nameField]: newName });

  let admins = 0;
  if (collection === "offices") {
    const linked = await db().collection("admin").where("admin_office", "==", oldName).get();
    linked.forEach((d) => {
      writer.update(d.ref, { admin_office: newName });
      admins++;
    });
  }

  let steps = 0;
  const services = await db().collectionGroup("services").select("tabs").get();
  services.forEach((s) => {
    const tabs = s.get("tabs");
    if (!Array.isArray(tabs)) return;
    let changed = false;
    const next = tabs.map((tab) => ({
      ...tab,
      procedures: (Array.isArray(tab.procedures) ? tab.procedures : []).map((step) => {
        if (!step || !same(step.navigate_to)) return step;
        changed = true;
        steps++;
        return { ...step, navigate_to: newName };
      })
    }));
    if (changed) writer.update(s.ref, { tabs: next });
  });

  await writer.close();
  console.log(`renameOffice: ${caller.uid} renamed ${collection}/${officeId} "${oldName}" -> "${newName}" (${admins} admins, ${steps} steps)`);
  return { success: true, renamed: true, oldName, admins, steps };
}

module.exports = { renameOffice };
