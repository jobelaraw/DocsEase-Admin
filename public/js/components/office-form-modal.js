// Add / Edit Office dialog (Dashboard, Service Management, Map Management).
//
//   openOfficeForm({ onSaved })                        -> adds an office or room
//   openOfficeForm({ record, onSubmit })               -> edit; onSubmit(values) saves it
// values = { name, description, floor, category, dayFrom, dayTo, openTime, closeTime, schedule }
import { html, $, $$ } from '../core/dom.js';
import { FLOORS, CATEGORIES, OFFICE_CATEGORY, prettyValue } from '../core/constants.js';
import { DAYS, buildSchedule, parseSchedule } from '../core/schedule.js';
import { logActivity } from '../core/activity-log.js';
import { findDuplicate, createOfficeOrRoom } from '../data/offices.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';

const options = (list, selected, placeholder, placeholderSelectable = false) => html`
  ${placeholder ? html`<option value="" ${placeholderSelectable ? '' : 'disabled'} ${selected ? '' : 'selected'}>${placeholder}</option>` : ''}
  ${list.map(([value, label]) => html`<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`)}
  ${selected && !list.some(([v]) => v === selected) ? html`<option value="${selected}" selected>${prettyValue(selected)}</option>` : ''}`;

export function openOfficeForm({ record = null, onSaved = null, onSubmit = null } = {}) {
  const editing = !!record;
  const isOfficeRecord = !record || record.collection === 'offices';
  const sched = editing ? parseSchedule(record.schedule) : null;
  const noun = isOfficeRecord ? 'Office' : 'Room';

  const dialog = openModal({
    title: editing ? `Edit ${noun}` : 'Add New Office',
    size: 'sectioned',
    body: html`
      <div class="modal-scroll">
        <section class="form-section">
          <h3 class="form-section-title">${noun} Information</h3>
          <div class="field">
            <label for="of-name">${noun} Name</label>
            <input class="input" id="of-name" type="text" maxlength="100" autocomplete="off" placeholder="Enter ${noun.toLowerCase()} name..." value="${editing ? record.name : ''}" autofocus />
          </div>
          <div class="field">
            <label for="of-desc">Description</label>
            <textarea class="textarea" id="of-desc" rows="3" maxlength="500" placeholder="What does this ${noun.toLowerCase()} do?">${editing ? record.description || '' : ''}</textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="of-floor">Floor</label>
              <select class="select" id="of-floor">${options(FLOORS, editing ? record.floor : '', 'Select floor')}</select>
            </div>
            <div class="field">
              <label for="of-category">Category / Type</label>
              <select class="select" id="of-category">${options(CATEGORIES, editing ? record.category : '', 'Select category')}</select>
            </div>
          </div>
        </section>
        <section class="form-section">
          <h3 class="form-section-title">${noun} Schedule</h3>
          <div class="field-row">
            <div class="field">
              <label for="of-day-from">Day From</label>
              <select class="select" id="of-day-from">${options(DAYS, sched ? sched.dayFrom : '', 'Select day')}</select>
            </div>
            <div class="field">
              <label for="of-day-to">Day To <span class="label-hint">(optional)</span></label>
              <select class="select" id="of-day-to">${options(DAYS, sched ? sched.dayTo : '', 'Same day', true)}</select>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="of-open">Opening Time</label>
              <input class="input" id="of-open" type="time" value="${sched ? sched.open : (record && record.openTime) || ''}" />
            </div>
            <div class="field">
              <label for="of-close">Closing Time</label>
              <input class="input" id="of-close" type="time" value="${sched ? sched.close : (record && record.closeTime) || ''}" />
            </div>
          </div>
        </section>
        <p class="field-error" data-error role="alert"></p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
        <button type="button" class="btn btn-primary" data-submit>${editing ? 'Save' : 'Add new office'}</button>
      </div>`
  });

  const box = dialog.el;
  const f = {
    name: $('#of-name', box), desc: $('#of-desc', box), floor: $('#of-floor', box), category: $('#of-category', box),
    dayFrom: $('#of-day-from', box), dayTo: $('#of-day-to', box), open: $('#of-open', box), close: $('#of-close', box)
  };
  const errorEl = $('[data-error]', box);
  const submit = $('[data-submit]', box);

  function showError(message, field) {
    errorEl.textContent = message || '';
    Object.values(f).forEach((el) => el.classList.remove('is-invalid'));
    if (message && field) {
      field.classList.add('is-invalid');
      field.focus();
    }
    return false;
  }
  Object.values(f).forEach((el) => el.addEventListener('input', () => showError('')));

  function readValues() {
    const values = {
      name: f.name.value.replace(/\s+/g, ' ').trim(),
      description: f.desc.value.trim(),
      floor: f.floor.value,
      category: f.category.value,
      dayFrom: f.dayFrom.value,
      dayTo: f.dayTo.value,
      openTime: f.open.value,
      closeTime: f.close.value
    };
    if (!values.name) return showError(`Please enter ${editing ? 'a name' : 'an office name'}.`, f.name);
    if (values.name.includes('/')) return showError('The name cannot contain "/".', f.name);
    if (!values.description) return showError('Please enter a description.', f.desc);
    if (!values.floor) return showError('Please select a floor.', f.floor);
    if (!values.category) return showError('Please select a category.', f.category);
    if (!values.dayFrom) return showError('Please select a day.', f.dayFrom);
    if (!values.openTime) return showError('Please enter an opening time.', f.open);
    if (!values.closeTime) return showError('Please enter a closing time.', f.close);
    if (values.openTime === values.closeTime) return showError('Opening and closing time cannot be the same.', f.close);
    if (editing && (values.category === OFFICE_CATEGORY) !== isOfficeRecord) {
      return showError('Changing between Regular Service and another type would move this record to a different collection. Delete it and add it again with the new category.', f.category);
    }
    values.schedule = buildSchedule(values.dayFrom, values.dayTo, values.openTime, values.closeTime);
    return values;
  }

  async function add(values) {
    const duplicate = await findDuplicate(values.name);
    if (duplicate) {
      return showError(duplicate.deleted
        ? 'An office with this name is in Deleted Records. Recover it from the Review Queue, or delete it permanently first.'
        : 'An office or room with this name already exists.', f.name);
    }
    const { id, isOffice } = await createOfficeOrRoom(values);
    logActivity('office_added', { office_name: values.name });
    await dialog.close('force');
    toast.success(isOffice ? 'Office Added' : 'Room Added', `"${values.name}" has been added.`, { button: 'OK' });
    if (onSaved) onSaved({ id, isOffice, ...values });
    return true;
  }

  submit.addEventListener('click', async () => {
    const values = readValues();
    if (!values) return;
    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = editing ? 'Saving...' : 'Adding...';
    try {
      if (editing) {
        const result = await onSubmit(values, { showError: (msg, field) => showError(msg, field && f[field]) });
        if (result !== false) await dialog.close('force');
      } else {
        await add(values);
      }
    } catch (error) {
      console.error('[office-form] save failed:', error);
      showError(error.code === 'permission-denied'
        ? 'You do not have permission to change offices.'
        : `Could not save. ${error.message || 'Please try again.'}`);
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });

  $$('input', box).forEach((input) => input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit.click();
  }));

  return dialog;
}
