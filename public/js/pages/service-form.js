// Add / Edit Service (one page for both).
//   service-form.html?officeId=…                 -> add a service (office pre-selected)
//   service-form.html?officeId=…&serviceId=…     -> edit that service
// Normal admins can only add to / edit their own office; deleting becomes a
// request to the Super Admin.
import { startPage } from '../core/page.js';
import { html, render, $ } from '../core/dom.js';
import { logActivity } from '../core/activity-log.js';
import { notifySuperAdminDeleteRequest } from '../core/email.js';
import { TRASH_RETENTION_DAYS } from '../core/constants.js';
import { toast, confirm } from '../components/toast.js';
import { comboBox } from '../components/combo-box.js';
import { startOfficePicker, officeNamed, whenOfficesLoaded } from '../components/office-picker.js';
import { createServiceEditor, normalizeTabs, cleanTabs, emptyTab } from '../components/service-editor.js';
import { guardUnsavedChanges } from '../components/leave-guard.js';
import { getOffice } from '../data/offices.js';
import { getService, saveService, serviceIdFor, deleteOrRequestDeletion } from '../data/services.js';

const params = new URLSearchParams(location.search);
const serviceId = params.get('serviceId');
const editing = !!serviceId;
let officeId = params.get('officeId');

const els = {
  title: $('#form-title'),
  skeleton: $('#form-skeleton'),
  status: $('#status'),
  body: $('#form-body'),
  description: $('#description'),
  save: $('#save'),
  discard: $('#discard'),
  remove: $('#delete')
};

const SUGGEST = {
  name: ['New Business Application', 'Renewal of Business Application', 'Retirement of Business'],
  location: ['1st Floor, City Hall Building, Brgy. Zapote, Binan City, Laguna'],
  phone: ['(049)513-5084'],
  email: ['bplo@binan.gov.ph']
};

// Editing keeps the title skeleton until the service's name has loaded.
if (!editing) els.title.textContent = 'Add Service';
els.save.textContent = editing ? 'Save Changes' : 'Add Service';
els.discard.textContent = editing ? 'Discard Changes' : 'Cancel';
document.title = `GaBayan – ${editing ? 'Edit' : 'Add'} Service`;

startOfficePicker();

function fail(message) {
  if (els.title.querySelector('.skel')) els.title.textContent = editing ? 'Edit Service' : 'Add Service';
  els.skeleton.hidden = true;
  els.body.hidden = true;
  els.status.textContent = message;
  els.status.hidden = false;
  els.save.disabled = true;
}

async function main() {
  const session = await startPage();
  const isSuper = session.role === 'super_admin';

  // Where "Back", "Cancel" and "Continue" go: this office's service list
  const officePage = () => (isSuper && officeId ? `office-services.html?officeId=${encodeURIComponent(officeId)}` : window.GaBayan.officeHref(session));
  function setBackTarget() {
    const topbar = $('app-topbar');
    topbar.setAttribute('back', isSuper && !officeId ? 'service-management.html' : officePage());
    topbar.render(session);
  }

  if (!isSuper) {
    if (!session.officeId) {
      fail('Your account has no office assigned yet. Please contact the Super Admin.');
      return;
    }
    if (editing && officeId && officeId !== session.officeId) {
      fail('You can only manage services that belong to your own office.');
      return;
    }
    officeId = session.officeId;
  }
  setBackTarget();

  // ---------- load ----------
  let office = null;
  let service = null;
  try {
    [office, service] = await Promise.all([
      officeId ? getOffice(officeId) : null,
      editing ? getService(officeId, serviceId) : null
    ]);
  } catch (error) {
    console.error('[service-form] load failed:', error);
    fail('Failed to load this service. Check your permissions or connection.');
    return;
  }

  if (officeId && !office) {
    fail('This office could not be found.');
    return;
  }
  if (office && office.isDeleted === true) {
    fail('This office is in Deleted Records. Recover it from the Review Queue before managing its services.');
    return;
  }
  if (editing && !service) {
    fail('This service could not be found. It may have been deleted.');
    return;
  }
  if (editing && service.isDeleted === true) {
    fail('This service is in Deleted Records. Recover it from the Review Queue before editing.');
    return;
  }

  // ---------- draw the form ----------
  const general = editing ? service : {};
  render($('#name-field'), html`<label for="service-name">Service Name</label>${comboBox({ id: 'service-name', value: general.service_name || '', placeholder: 'Enter or select service name', items: SUGGEST.name })}`);
  render($('#office-field'), html`<label for="office">Office</label>${
    !editing && isSuper
      ? comboBox({ id: 'office', value: office ? office.name : '', placeholder: 'Select or search an office...', source: 'offices', strict: true })
      : html`<input class="input" id="office" type="text" value="${office ? office.name : ''}" disabled />`}`);
  render($('#location-field'), html`<label for="location">Location</label>${comboBox({ id: 'location', value: general.location || '', placeholder: 'Enter location', items: SUGGEST.location })}`);
  render($('#phone-field'), html`<label for="contact-phone">Contact Number</label>${comboBox({ id: 'contact-phone', value: general.contact_phone || '', placeholder: 'Enter contact number', items: SUGGEST.phone })}`);
  render($('#email-field'), html`<label for="contact-email">Email <span class="label-hint">(optional)</span></label>${comboBox({ id: 'contact-email', value: general.contact_email || '', placeholder: 'Enter email or website', items: SUGGEST.email })}`);
  els.description.value = general.description || '';

  const tabs = editing ? normalizeTabs(service.tabs, service) : [emptyTab('Walk-In', { withRows: true })];
  const editor = createServiceEditor({ tabBar: $('#tab-bar'), content: $('#tab-content'), tabs });

  if (editing) {
    els.title.textContent = `Edit Service: ${service.service_name || serviceId}`;
    els.remove.hidden = false;
  }

  const value = (id) => ($(`#${id}`).value || '').trim();
  function formData() {
    return {
      service_name: value('service-name'),
      description: els.description.value.trim(),
      location: value('location'),
      contact_phone: value('contact-phone'),
      contact_email: value('contact-email'),
      tabs: cleanTabs(editor.tabs)
    };
  }

  const snapshot = () => JSON.stringify({ ...formData(), office: value('office') });
  const original = snapshot();
  const guard = guardUnsavedChanges(() => snapshot() !== original);

  els.skeleton.hidden = true;
  els.body.hidden = false;
  requestAnimationFrame(() => els.body.classList.add('is-ready'));
  els.save.disabled = false;

  // ---------- validation ----------
  function invalid(id, message) {
    const input = $(`#${id}`);
    (input.closest('[data-combo]') || input).classList.add('is-invalid');
    input.classList.add('is-invalid');
    input.scrollIntoView({ block: 'center' });
    input.focus({ preventScroll: true });
    toast.error('Missing Fields', message, { button: 'OK' });
    return false;
  }

  function validateGeneral() {
    if (!value('service-name')) return invalid('service-name', 'Please enter the service name.');
    if (!editing) {
      if (!value('office')) return invalid('office', 'Please choose an office.');
      if (isSuper && !officeNamed(value('office'))) return invalid('office', "Please choose an office from the dropdown list. If it isn't listed, add it in Service Management first.");
    }
    if (!els.description.value.trim()) return invalid('description', 'Please enter a description of the service.');
    if (!value('location')) return invalid('location', 'Please enter the location.');
    if (!value('contact-phone')) return invalid('contact-phone', 'Please enter a contact number.');
    return true;
  }
  ['service-name', 'location', 'contact-phone', 'description', 'office'].forEach((id) => {
    $(`#${id}`).addEventListener('input', (e) => {
      e.target.classList.remove('is-invalid');
      e.target.closest('[data-combo]')?.classList.remove('is-invalid');
    });
  });

  // ---------- save ----------
  async function addService() {
    const target = isSuper ? officeNamed(value('office')) : office;
    const data = formData();
    const id = serviceIdFor(target.id, data.service_name);
    toast.loading('Adding Service', 'The service is currently being processed. Please wait.');
    const existing = await getService(target.id, id);
    if (existing) {
      toast.error('Already Exists', existing.isDeleted === true
        ? 'A service with this name is in Deleted Records. Recover it from the Review Queue, or delete it permanently first.'
        : 'A service with this name already exists in this office.', { button: 'OK' });
      return;
    }
    await saveService(target.id, id, data, { isNew: true });
    guard.release();
    logActivity('service_added', { office_name: target.name, service_name: data.service_name });
    officeId = target.id;
    await toast.success('Service Added!', `The service has been successfully added to ${target.name}.`);
    location.href = officePage();
  }

  async function updateService() {
    if (!(await confirm({ type: 'info', title: 'Save Changes?', msg: 'Do you want to save the edited service details?', confirmText: 'Save', cancelText: 'Keep Editing' }))) return;
    const data = formData();
    toast.loading('Saving Changes', 'The service changes are currently being processed. Please wait.');
    // Don't let a stale page bring a deleted service back
    const [latest, latestOffice] = await Promise.all([getService(officeId, serviceId), getOffice(officeId)]);
    if (latest && latest.isDeleted === true) throw new Error('This service was moved to Deleted Records while you were editing. Recover it first.');
    if (latestOffice && latestOffice.isDeleted === true) throw new Error('This office was moved to Deleted Records while you were editing. Recover it first.');
    await saveService(officeId, serviceId, data);
    guard.release();
    logActivity('service_updated', { office_name: office.name, service_name: data.service_name });
    await toast.success('Saved', 'Service changes have been saved successfully.');
    location.href = officePage();
  }

  els.save.addEventListener('click', async () => {
    if (!validateGeneral() || !editor.validate()) return;
    if (!editing && isSuper) await whenOfficesLoaded();
    els.save.disabled = true;
    try {
      if (editing) await updateService();
      else await addService();
    } catch (error) {
      console.error('[service-form] save failed:', error);
      toast.error('Save Failed', error.message || 'Failed to save. Please try again.', { button: 'OK' });
    } finally {
      els.save.disabled = false;
    }
  });

  // ---------- discard / delete ----------
  els.discard.addEventListener('click', async () => {
    if (editing && snapshot() !== original) {
      const ok = await confirm({ type: 'warning', title: 'Discard Changes?', msg: 'Your unsaved changes will be lost and you will be returned to the service list.', confirmText: 'Discard', cancelText: 'Keep Editing' });
      if (!ok) return;
      guard.release();
    }
    guard.leave(officePage());
  });

  els.remove.addEventListener('click', async () => {
    const name = service.service_name || serviceId;
    const details = { office_name: office.name, service_name: name };
    const ok = await confirm(isSuper
      ? { type: 'error', title: 'Delete Service?', msg: `This service will be moved to Deleted Records in the Review Queue. You can recover it within ${TRASH_RETENTION_DAYS} days.`, confirmText: 'Delete' }
      : { type: 'warning', title: 'Request Service Deletion?', msg: 'This will send a deletion request to the Super Admin. The service stays in the list until the request is approved.', confirmText: 'Send Request' });
    if (!ok) return;

    toast.loading(isSuper ? 'Deleting Service' : 'Sending Request', 'Please wait while this is being processed.');
    try {
      const result = await deleteOrRequestDeletion({ session, officeId, officeName: office.name, serviceId, serviceName: name });
      if (result === 'deleted') {
        logActivity('service_deleted', details);
        guard.release();
        await toast.success('Moved to Deleted Records', `The service was moved to Deleted Records. You can recover it from the Review Queue within ${TRASH_RETENTION_DAYS} days.`);
        location.href = officePage();
        return;
      }
      if (result === 'already_requested') {
        toast.info('Already Requested', 'You already sent a deletion request for this service. It is waiting for the Super Admin.', { button: 'OK' });
        return;
      }
      logActivity('service_delete_requested', details);
      notifySuperAdminDeleteRequest(session.name, name, office.name);
      guard.release();
      await toast.success('Request Sent', 'Your deletion request was sent to the Super Admin. The service will be removed once it is approved.');
      location.href = officePage();
    } catch (error) {
      console.error('[service-form] delete failed:', error);
      toast.error(isSuper ? 'Delete Failed' : 'Request Failed', isSuper
        ? `Failed to delete service: ${error.message || 'Please try again.'}`
        : 'Could not send the deletion request. Please try again.', { button: 'OK' });
    }
  });
}

main();
