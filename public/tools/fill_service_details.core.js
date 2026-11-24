// Pure merge logic (no Firebase) so it can be tested in Node.
// Only fills fields that are empty; never overwrites an existing value.
import { OFFICE_CONTACTS, SERVICE_FILLS, RELEASE_STEP_ACTION } from './fill_service_details.data.js';

const TAB_FIELDS = ['transaction_type', 'who_may_avail', 'total_fee', 'total_processing_time'];
const STEP_FIELDS = ['agency_actions', 'notes', 'fee', 'online_link'];
const CONTACT_FIELDS = ['location', 'contact_phone', 'contact_email'];

export const isBlank = v =>
  v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);

/**
 * @returns {{ patch: object, changes: string[], warnings: string[], source: string|null }}
 *          patch is empty when nothing needs to change.
 */
export function planFill(officeId, serviceId, svc) {
  const patch = {};
  const changes = [];
  const warnings = [];

  const contacts = OFFICE_CONTACTS[officeId] || {};
  for (const f of CONTACT_FIELDS) {
    if (contacts[f] && isBlank(svc[f])) { patch[f] = contacts[f]; changes.push(f); }
  }

  const fill = SERVICE_FILLS[`${officeId}/${serviceId}`];
  const tabs = structuredClone(svc.tabs || []);
  let tabsChanged = false;

  if (fill && fill.tabs.length > tabs.length) warnings.push(`fill has ${fill.tabs.length} tab(s), service has ${tabs.length}`);

  tabs.forEach((tab, ti) => {
    const tf = fill?.tabs?.[ti];
    if (tf) {
      for (const f of TAB_FIELDS) {
        if (tf[f] && isBlank(tab[f])) { tab[f] = tf[f]; changes.push(`tab${ti}.${f}`); tabsChanged = true; }
      }
    }
    const steps = tab.procedures || [];
    // A shorter list is fine (only the listed steps are filled); a longer one means a mismatch.
    if (tf?.steps && tf.steps.length > steps.length) {
      warnings.push(`tab${ti}: fill has ${tf.steps.length} step(s), service has ${steps.length}`);
    }
    steps.forEach((step, si) => {
      const sf = tf?.steps?.[si] || {};
      for (const f of STEP_FIELDS) {
        if (!isBlank(sf[f]) && isBlank(step[f])) {
          step[f] = structuredClone(sf[f]); changes.push(`tab${ti}.step${si}.${f}`); tabsChanged = true;
        }
      }
      if (isBlank(step.agency_actions) && RELEASE_STEP_ACTION.match(officeId, step)) {
        step.agency_actions = RELEASE_STEP_ACTION.value(step);
        changes.push(`tab${ti}.step${si}.agency_actions`); tabsChanged = true;
      }
    });
  });

  if (tabsChanged) patch.tabs = tabs;
  return { patch, changes, warnings, source: fill?.source || null };
}
