// Editor for a service's transaction channels (tabs), each with transaction details,
// a requirements checklist and a step-by-step guide (drag to reorder).
// The data lives in `tabs` (same shape as Firestore); the DOM is drawn from it.
//
//   const editor = createServiceEditor({ tabBar, content, tabs });
//   editor.tabs        // current data (without the internal __uid keys when saved)
//   editor.validate()  // -> true, or shows the first problem and returns false
import { html, render, $, $$, on } from '../core/dom.js';
import { comboBox } from './combo-box.js';
import { checkDestination } from './office-picker.js';
import { toast } from './toast.js';

const SUGGEST = {
  transactionType: ['G2C – Government to Citizen', 'G2B – Government to Business', 'G2G – Government to Government'],
  requirement: ['BPLO FORM 001-2: Application Form For Business Permit', 'Occupancy Permit (if applicable)', 'Barangay Clearance', 'Valid ID'],
  stepTitle: ['Application and Assessment', 'Payment', 'Claiming of Permit'],
  fee: ['None', 'Based on the Revised Revenue Code (2016) City of Binan'],
  processingTime: ['15 Minutes', '50 Minutes', '1 Day']
};

let uidCounter = 0;
const nextUid = () => `s${++uidCounter}-${Math.random().toString(36).slice(2, 7)}`;
const optional = html` <span class="label-hint">(optional)</span>`;

export function emptyStep() {
  return {
    __uid: nextUid(), process_name: '', fee: '', processing_time: '', process_description: '',
    person_in_charge: '', online_link: '', navigate_to: '', agency_actions: [], notes: ''
  };
}

export function emptyTab(name = 'New Tab', { withRows = false } = {}) {
  return {
    tab_name: name, transaction_type: '', who_may_avail: '', total_fee: '', total_processing_time: '',
    requirements: withRows ? [{ requirement_name: '', secure_at: '' }] : [],
    procedures: withRows ? [emptyStep()] : []
  };
}

// Fills in missing arrays/fields of stored data so the editor can rely on them.
export function normalizeTabs(tabs, legacy = {}) {
  const list = Array.isArray(tabs) && tabs.length ? tabs : [emptyTab('Walk-In')];
  list.forEach((tab) => {
    tab.tab_name = tab.tab_name || '';
    ['transaction_type', 'who_may_avail', 'total_fee', 'total_processing_time'].forEach((k) => { tab[k] = tab[k] || ''; });
    if (!Array.isArray(tab.requirements)) tab.requirements = [];
    if (!Array.isArray(tab.procedures)) tab.procedures = [];
    tab.procedures.forEach((p) => {
      p.__uid = p.__uid || nextUid();
      if (typeof p.agency_actions === 'string') p.agency_actions = p.agency_actions.split('\n').map((s) => s.trim()).filter(Boolean);
      else if (!Array.isArray(p.agency_actions)) p.agency_actions = [];
      if (typeof p.notes !== 'string') p.notes = '';
    });
  });
  // Older services kept transaction details on the service itself
  const first = list[0];
  ['transaction_type', 'who_may_avail', 'total_fee', 'total_processing_time'].forEach((k) => {
    if (!first[k] && legacy[k]) first[k] = legacy[k];
  });
  return list;
}

// Data to store: same shape, internal keys removed.
export function cleanTabs(tabs) {
  return tabs.map((tab) => ({
    tab_name: tab.tab_name.trim() || 'Unnamed Channel',
    transaction_type: tab.transaction_type.trim(),
    who_may_avail: tab.who_may_avail.trim(),
    total_fee: tab.total_fee.trim(),
    total_processing_time: tab.total_processing_time.trim(),
    requirements: tab.requirements
      .map((r) => ({ requirement_name: (r.requirement_name || '').trim(), secure_at: (r.secure_at || '').trim() }))
      .filter((r) => r.requirement_name),
    procedures: tab.procedures
      .map((p) => ({
        process_name: (p.process_name || '').trim(),
        fee: (p.fee || '').trim(),
        processing_time: (p.processing_time || '').trim(),
        process_description: (p.process_description || '').trim(),
        person_in_charge: (p.person_in_charge || '').trim(),
        online_link: (p.online_link || '').trim(),
        navigate_to: (p.navigate_to || '').trim(),
        agency_actions: (p.agency_actions || []).map((a) => a.trim()).filter(Boolean),
        notes: (p.notes || '').trim()
      }))
      .filter((p) => p.process_name)
  }));
}

export function createServiceEditor({ tabBar, content, tabs }) {
  let current = 0;
  const tab = () => tabs[current];

  // ---------- drawing ----------
  function drawTabBar() {
    render(tabBar, html`
      ${tabs.map((t, i) => html`
        <div class="tab-btn ${i === current ? 'active' : ''}" data-tab="${i}" role="tab" aria-selected="${i === current}">
          <input type="text" value="${t.tab_name}" placeholder="Tab Name" data-tab-name="${i}" aria-label="Channel name"
                 data-style="width:${Math.max(90, t.tab_name.length * 8)}px" />
          ${tabs.length > 1 ? html`<button type="button" class="tab-delete" data-remove-tab="${i}" aria-label="Delete ${t.tab_name || 'tab'}"><img src="assets/delete.svg" alt="" /></button>` : ''}
        </div>`)}
      <button type="button" class="btn-add-tab" data-add-tab aria-label="Add a channel">+</button>`);
  }

  const field = (label, path, value, { optionalField = false, area = false, placeholder = '' } = {}) => html`
    <div class="field">
      <label>${label}${optionalField ? optional : ''}</label>
      ${area
        ? html`<textarea class="textarea" data-path="${path}" aria-label="${label}" placeholder="${placeholder}">${value}</textarea>`
        : html`<input type="text" class="input" data-path="${path}" aria-label="${label}" value="${value}" placeholder="${placeholder}" />`}
    </div>`;

  const comboField = (label, path, value, items, placeholder, optionalField = false) => html`
    <div class="field" data-path-wrap="${path}">
      <label>${label}${optionalField ? optional : ''}</label>
      ${comboBox({ value, placeholder, items, field: path, label })}
    </div>`;

  function requirementRow(req, i) {
    return html`
      <div class="req-item">
        ${comboField('Requirement Name', `req.${i}.requirement_name`, req.requirement_name, SUGGEST.requirement, 'e.g. Valid ID')}
        ${field('Secure at', `req.${i}.secure_at`, req.secure_at, { placeholder: 'e.g. Barangay Hall' })}
        <button type="button" class="btn-remove" data-remove-req="${i}" aria-label="Remove requirement"><img src="assets/delete.svg" alt="" /></button>
      </div>`;
  }

  function stepCard(step) {
    const p = `step.${step.__uid}`;
    return html`
      <div class="step-card" data-uid="${step.__uid}">
        <div class="step-header" data-toggle-step role="button" tabindex="0" aria-expanded="false">
          <span class="drag-handle" data-drag title="Drag to reorder" aria-hidden="true">⋮⋮</span>
          <span class="step-title-display">${step.process_name || 'New Step'}</span>
          <span class="toggle-icon" aria-hidden="true">▼</span>
        </div>
        <div class="step-body">
          <div class="step-title-row">
            ${comboField('Step Title', `${p}.process_name`, step.process_name, SUGGEST.stepTitle, 'e.g. Application and Assessment')}
            <button type="button" class="btn-remove" data-remove-step="${step.__uid}" aria-label="Remove step"><img src="assets/delete.svg" alt="" /></button>
          </div>
          <div class="field-row">
            ${comboField('Fee', `${p}.fee`, step.fee, SUGGEST.fee, 'e.g. None')}
            ${comboField('Processing Time', `${p}.processing_time`, step.processing_time, SUGGEST.processingTime, 'e.g. 50 Minutes')}
          </div>
          ${field('Description', `${p}.process_description`, step.process_description, { area: true, placeholder: 'Submit the requirements and accomplish the Application Form...' })}
          ${field('People In-Charge / Office', `${p}.person_in_charge`, step.person_in_charge, { area: true, placeholder: 'List the personnel or office window...' })}
          <div class="field">
            <label>Agency Actions <span class="label-hint">(optional, one per line)</span></label>
            <textarea class="textarea" data-path="${p}.agency_actions" placeholder="Verification of documents&#10;Sending of SOA via email.">${step.agency_actions.join('\n')}</textarea>
          </div>
          ${field('Notes / Footnote', `${p}.notes`, step.notes, { area: true, optionalField: true, placeholder: 'e.g. *Payment will be credited within 1 to 5 working days...' })}
          ${field('Online Link', `${p}.online_link`, step.online_link, { optionalField: true, placeholder: 'e.g. https://binancitybusinesspermit.online' })}
          <div class="field" data-path-wrap="${p}.navigate_to">
            <label>Navigate to${optional}</label>
            ${comboBox({ value: step.navigate_to, placeholder: 'Type or select an office...', source: 'destinations', strict: true, field: `${p}.navigate_to`, label: 'Navigate to' })}
            <small class="field-help">Fill this in only if this step needs the citizen to go to an office or room inside City Hall. The app will show a "Start Navigation" button.</small>
          </div>
        </div>
      </div>`;
  }

  function drawRequirements() {
    render($('[data-req-list]', content), html`${tab().requirements.map(requirementRow)}`);
  }

  function drawSteps() {
    render($('[data-step-list]', content), html`${tab().procedures.map(stepCard)}`);
  }

  function drawPane() {
    const t = tab();
    render(content, html`
      <section class="form-section">
        <h3 class="form-section-title">Transaction Details</h3>
        <div class="field-row">
          ${comboField('Type of Transaction', 'transaction_type', t.transaction_type, SUGGEST.transactionType, 'e.g. G2C – Government to Citizen', true)}
          ${field('Who May Avail', 'who_may_avail', t.who_may_avail, { optionalField: true, placeholder: 'e.g. Eligible residents' })}
        </div>
        <div class="field-row">
          ${field('Total Fees', 'total_fee', t.total_fee, { optionalField: true, placeholder: 'e.g. ₱100' })}
          ${field('Total Processing Time', 'total_processing_time', t.total_processing_time, { optionalField: true, placeholder: 'e.g. 25 Minutes' })}
        </div>
      </section>
      <section class="form-section">
        <h3 class="form-section-title">Requirements Checklist</h3>
        <div data-req-list></div>
        <button type="button" class="btn-add-row" data-add-req>+ Click here to add new requirement</button>
      </section>
      <section class="form-section">
        <h3 class="form-section-title">Step-by-Step Guide</h3>
        <div data-step-list></div>
        <button type="button" class="btn-add-row" data-add-step>+ Click here to add new step</button>
      </section>`);
    drawRequirements();
    drawSteps();
  }

  function draw() {
    drawTabBar();
    drawPane();
  }

  function selectTab(i) {
    current = Math.max(0, Math.min(i, tabs.length - 1));
    draw();
  }

  // ---------- editing: inputs write straight into the data ----------
  function write(path, value) {
    const [head, key, prop] = path.split('.');
    if (head === 'req') tab().requirements[Number(key)][prop] = value;
    else if (head === 'step') {
      const step = tab().procedures.find((s) => s.__uid === key);
      if (!step) return;
      step[prop] = prop === 'agency_actions' ? value.split('\n').map((s) => s.trim()).filter(Boolean) : value;
      if (prop === 'process_name') {
        const title = content.querySelector(`.step-card[data-uid="${key}"] .step-title-display`);
        if (title) title.textContent = value || 'New Step';
      }
    } else tab()[head] = value;
  }

  content.addEventListener('input', (e) => {
    const el = e.target;
    const path = el.dataset.path || el.dataset.field;
    if (!path) return;
    el.classList.remove('is-invalid');
    write(path, el.value);
  });

  tabBar.addEventListener('input', (e) => {
    const i = e.target.dataset.tabName;
    if (i === undefined) return;
    tabs[Number(i)].tab_name = e.target.value;
    e.target.style.width = `${Math.max(90, e.target.value.length * 8)}px`;
    e.target.classList.remove('is-invalid');
  });

  on(tabBar, 'click', '[data-tab]', (e, el) => {
    if (e.target.closest('[data-remove-tab]') || e.target.matches('input') && Number(el.dataset.tab) === current) return;
    if (Number(el.dataset.tab) !== current) selectTab(Number(el.dataset.tab));
  });
  on(tabBar, 'click', '[data-add-tab]', () => {
    tabs.push(emptyTab());
    selectTab(tabs.length - 1);
  });
  on(tabBar, 'click', '[data-remove-tab]', (e, el) => {
    e.stopPropagation();
    if (tabs.length <= 1) return toast.error('At least One Tab', 'A service needs at least one tab.');
    tabs.splice(Number(el.dataset.removeTab), 1);
    selectTab(Math.min(current, tabs.length - 1));
  });

  on(content, 'click', '[data-add-req]', () => {
    tab().requirements.push({ requirement_name: '', secure_at: '' });
    drawRequirements();
    $$('.req-item', content).pop()?.querySelector('input')?.focus();
  });
  on(content, 'click', '[data-remove-req]', (e, el) => {
    tab().requirements.splice(Number(el.dataset.removeReq), 1);
    drawRequirements();
  });
  on(content, 'click', '[data-add-step]', () => {
    tab().procedures.push(emptyStep());
    drawSteps();
    const card = $$('.step-card', content).pop();
    if (card) openStep(card);
  });
  on(content, 'click', '[data-remove-step]', (e, el) => {
    const t = tab();
    t.procedures = t.procedures.filter((s) => s.__uid !== el.dataset.removeStep);
    drawSteps();
  });

  function openStep(card, open = true) {
    card.classList.toggle('open', open);
    card.querySelector('[data-toggle-step]').setAttribute('aria-expanded', String(open));
  }
  on(content, 'click', '[data-toggle-step]', (e, header) => openStep(header.closest('.step-card'), !header.closest('.step-card').classList.contains('open')));
  on(content, 'keydown', '[data-toggle-step]', (e, header) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      header.click();
    }
  });

  // ---------- drag to reorder steps (only from the handle, so text stays selectable) ----------
  let dragged = null;
  content.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('[data-drag]');
    if (handle) handle.closest('.step-card').draggable = true;
  });
  content.addEventListener('dragstart', (e) => {
    dragged = e.target.closest('.step-card');
    if (!dragged) return;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => dragged && dragged.classList.add('dragging'), 0);
  });
  content.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const list = $('[data-step-list]', content);
    const after = $$('.step-card:not(.dragging)', list).find((card) => {
      const box = card.getBoundingClientRect();
      return e.clientY < box.top + box.height / 2;
    });
    if (after) list.insertBefore(dragged, after);
    else list.appendChild(dragged);
  });
  content.addEventListener('dragend', () => {
    if (!dragged) return;
    dragged.classList.remove('dragging');
    dragged.draggable = false;
    dragged = null;
    const order = $$('[data-step-list] .step-card', content).map((c) => c.dataset.uid);
    tab().procedures.sort((a, b) => order.indexOf(a.__uid) - order.indexOf(b.__uid));
  });

  // ---------- validation ----------
  function problemIn(t) {
    const missing = (v) => !String(v || '').trim();
    if (missing(t.tab_name)) return { tabName: true, message: 'Please give every tab a name.' };
    for (let i = 0; i < t.requirements.length; i++) {
      const r = t.requirements[i];
      if (missing(r.requirement_name)) return { path: `req.${i}.requirement_name`, message: 'Please fill in every requirement name.' };
      if (missing(r.secure_at)) return { path: `req.${i}.secure_at`, message: 'Please fill in where each requirement is secured.' };
    }
    for (const s of t.procedures) {
      const p = `step.${s.__uid}`;
      if (missing(s.process_name)) return { path: `${p}.process_name`, uid: s.__uid, message: 'Please give every step a title.' };
      if (missing(s.fee)) return { path: `${p}.fee`, uid: s.__uid, message: 'Please fill in the fee of every step.' };
      if (missing(s.processing_time)) return { path: `${p}.processing_time`, uid: s.__uid, message: 'Please fill in the processing time of every step.' };
      if (missing(s.process_description)) return { path: `${p}.process_description`, uid: s.__uid, message: 'Please describe every step.' };
      if (missing(s.person_in_charge)) return { path: `${p}.person_in_charge`, uid: s.__uid, message: 'Please fill in who is in charge of every step.' };
      const dest = checkDestination(s.navigate_to);
      if (!dest.ok) {
        return { path: `${p}.navigate_to`, uid: s.__uid, destination: true, message: 'Please choose the "Navigate to" destination from the dropdown list. Text that is not in the list cannot be saved.' };
      }
      s.navigate_to = dest.value; // the exact listed spelling
    }
    return null;
  }

  function validate() {
    for (let i = 0; i < tabs.length; i++) {
      const problem = problemIn(tabs[i]);
      if (!problem) continue;
      selectTab(i);
      let el = null;
      if (problem.tabName) el = $(`[data-tab-name="${i}"]`, tabBar);
      else {
        if (problem.uid) openStep($(`.step-card[data-uid="${problem.uid}"]`, content));
        el = content.querySelector(`[data-path="${problem.path}"], [data-field="${problem.path}"]`);
      }
      if (el) {
        (el.closest('[data-combo]') || el).classList.add('is-invalid');
        el.classList.add('is-invalid');
        el.scrollIntoView({ block: 'center' });
        el.focus({ preventScroll: true });
      }
      toast.error(problem.destination ? 'Invalid Destination' : 'Missing Fields', problem.message, { button: 'OK' });
      return false;
    }
    return true;
  }

  draw();
  return {
    get tabs() { return tabs; },
    validate,
    redraw: draw
  };
}
