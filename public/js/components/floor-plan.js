// First-floor plan: rooms drawn over the floor image, offices placed in rooms.
// Drag a room onto another to swap, drag from the tray to place, drag a room to
// the tray to remove it from the map, click a room or chip to edit it.
//
//   const plan = createFloorPlan({ svg, tray, trayCard, trayTitle, onEdit, onChange });
//   plan.setRecords(records)   // [{ key, name, slot, floor, ... }] on this floor
// onChange(changes, label) with changes = [[record, slotId | null], ...]
import { html, render } from '../core/dom.js';

const NS = 'http://www.w3.org/2000/svg';
const R = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}z`;

// Rooms numbered clockwise: s1 is the bottom-left wing, s15 the bottom-right wing.
export const SLOTS = [
  { id: 's1', d: R(20.5, 313.5, 210, 71) },
  { id: 's2', d: R(143.5, 251.5, 71, 57) },
  { id: 's3', d: R(143.5, 101.5, 71, 145) },
  { id: 's4', d: R(143.5, 9.5, 82, 87) },
  { id: 's5', d: R(230.5, 9.5, 29, 24) },
  { id: 's6', d: R(261.5, 9.5, 28.5, 24) },
  { id: 's7', d: R(263.5, 38.5, 36, 57) },
  { id: 's8', d: R(304.5, 38.5, 70, 57) },
  { id: 's9', d: R(379.5, 38.5, 33, 26) },
  { id: 's10', d: R(379.5, 69.5, 33, 26) },
  { id: 's11', d: 'M447.5 9.5 L531.5 9.5 L531.5 33.5 L500.5 33.5 L500.5 64.5 L447.5 64.5 Z', lx: 474, ly: 32, tiny: true },
  { id: 's12', d: 'M505.5 38.5 L531.5 38.5 L531.5 96.5 L447.5 96.5 L447.5 69.5 L505.5 69.5 Z', lx: 490, ly: 78, tiny: true },
  { id: 's13', d: R(460.5, 130.5, 71, 116) },
  { id: 's14', d: R(450.5, 251.5, 81, 57) },
  { id: 's15', d: 'M450.5 313.5 L649.5 313.5 L649.5 384.5 L469.5 384.5 L469.5 409.5 L450.5 409.5 Z', lx: 548, ly: 349 }
];
export const SLOT_IDS = new Set(SLOTS.map((s) => s.id));

// Room numbers used before the current numbering (map_slot_v missing or 1)
export const OLD_TO_NEW = {
  s13: 's1', s10: 's2', s9: 's3', s1: 's4', s2: 's5', s16: 's6', s3: 's7', s4: 's8',
  s5: 's9', s6: 's10', s7: 's11', s8: 's12', s11: 's13', s12: 's14', s14: 's15'
};

const SKIP = new Set(['of', 'the', 'and', 'for', 'in', 'on']);
// "Office of the City Treasurer 1" -> "OCT1"
export const shortName = (name) => name.split(/\s+/).filter((w) => !SKIP.has(w.toLowerCase())).map((w) => w[0]).join('').toUpperCase().slice(0, 6) || name;

function wrap(text, max) {
  const lines = [];
  let cur = '';
  text.split(/\s+/).forEach((w) => {
    if (cur && `${cur} ${w}`.length > max) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  });
  if (cur) lines.push(cur);
  return lines;
}

function svgEl(name, attrs = {}, parent = null) {
  const el = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  if (parent) parent.appendChild(el);
  return el;
}

export function createFloorPlan({ svg, tray, trayCard, trayTitle, onEdit, onChange }) {
  let records = [];
  let bySlot = {};
  let loaded = false;
  let drag = null;

  const onMap = (r) => bySlot[r.slot] === r;
  const unplaced = () => records.filter((r) => !onMap(r)).sort((a, b) => a.name.localeCompare(b.name));

  function drawMap() {
    svg.replaceChildren();
    svgEl('image', { href: 'assets/floor_plan.png', x: 0, y: 0, width: 668, height: 450, 'pointer-events': 'none' }, svg);
    SLOTS.forEach((s) => {
      const rec = bySlot[s.id];
      const g = svgEl('g', { class: `mm-slot${rec ? '' : ' mm-empty'}`, 'data-id': s.id, tabindex: rec ? '0' : '-1', role: rec ? 'button' : 'img', 'aria-label': rec ? `${rec.name} (room ${s.id.slice(1)})` : `Empty room ${s.id.slice(1)}` }, svg);
      const shape = svgEl('path', { d: s.d, class: 'mm-shape' }, g);
      const bb = shape.getBBox();
      const cx = s.lx ?? bb.x + bb.width / 2;
      const cy = s.ly ?? bb.y + bb.height / 2;
      const small = bb.width < 50 || bb.height < 40 || s.tiny;
      const label = svgEl('g', { class: 'mm-label' }, g);
      if (rec) {
        const maxChars = Math.max(6, Math.floor((bb.width - 6) / 3.9));
        const maxLines = Math.max(1, Math.floor((bb.height - 6) / 8.5));
        let lines = small ? null : wrap(rec.name, maxChars);
        if (lines && (lines.length > maxLines || lines.some((l) => l.length > maxChars))) lines = null;
        if (lines) {
          const y0 = cy - (lines.length - 1) * 4.2 + 2.5;
          lines.forEach((ln, i) => { svgEl('text', { x: cx, y: y0 + i * 8.4, class: 'mm-name' }, label).textContent = ln; });
        } else {
          svgEl('text', { x: cx, y: cy + 3, class: 'mm-code' }, label).textContent = shortName(rec.name);
        }
      } else {
        svgEl('text', { x: cx, y: cy + (small ? 2 : 3), class: `mm-name mm-muted${small ? ' mm-name-sm' : ''}` }, label).textContent = 'Empty';
      }
    });
    svgEl('text', { x: 338, y: 291, class: 'mm-static' }, svg).textContent = 'Elevator';
  }

  function drawTray() {
    const list = unplaced();
    trayTitle.textContent = loaded ? `Unplaced offices and rooms (${list.length})` : 'Unplaced offices and rooms';
    if (!loaded) {
      render(tray, html`${[90, 130, 70, 110, 150, 85].map((w) => html`<span class="skel skel-pill skel-inline" data-style="width:${w}px;height:32px" aria-hidden="true"></span>`)}`);
    } else if (!list.length) {
      render(tray, html`<p class="mm-empty-note">Everything on this floor is placed on the map.</p>`);
    } else {
      render(tray, html`${list.map((r) => html`<button type="button" class="mm-chip" data-key="${r.key}">${r.name}</button>`)}`);
    }
  }

  function redraw() {
    bySlot = {};
    records.forEach((r) => {
      if (r.slot && SLOT_IDS.has(r.slot) && !bySlot[r.slot]) bySlot[r.slot] = r;
    });
    drawMap();
    drawTray();
  }

  // ---------- drag & drop (pointer events: mouse, pen and touch) ----------
  function clearHighlights() {
    svg.querySelectorAll('.mm-target').forEach((n) => n.classList.remove('mm-target'));
    trayCard.classList.remove('mm-tray-hot');
  }

  const EDGE = 90;
  const MAX_STEP = 18;
  function autoScroll() {
    if (!drag || !drag.moved) return;
    const scroller = svg.closest('.main') || document.scrollingElement;
    const y = drag.ly;
    let dy = 0;
    if (y < EDGE) dy = -Math.ceil((MAX_STEP * (EDGE - y)) / EDGE);
    else if (y > window.innerHeight - EDGE) dy = Math.ceil((MAX_STEP * (y - (window.innerHeight - EDGE))) / EDGE);
    if (dy) {
      const before = scroller.scrollTop;
      scroller.scrollTop += dy;
      if (scroller.scrollTop !== before) onMove({ clientX: drag.lx, clientY: drag.ly });
    }
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function onMove(e) {
    if (!drag) return;
    drag.lx = e.clientX;
    drag.ly = e.clientY;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return; // a click, not a drag
      drag.moved = true;
      if (drag.src.type === 'slot') svg.querySelector(`[data-id="${drag.src.slotId}"]`).classList.add('mm-src');
      drag.ghost = document.createElement('div');
      drag.ghost.className = 'mm-float';
      drag.ghost.textContent = shortName(drag.rec.name);
      document.body.appendChild(drag.ghost);
      drag.raf = requestAnimationFrame(autoScroll);
    }
    drag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    clearHighlights();
    drag.target = null;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = hit && hit.closest ? hit.closest('.mm-slot') : null;
    if (slotEl) {
      if (!(drag.src.type === 'slot' && slotEl.dataset.id === drag.src.slotId)) {
        drag.target = { type: 'slot', id: slotEl.dataset.id };
        slotEl.classList.add('mm-target');
      }
    } else if (drag.src.type === 'slot' && hit && hit.closest && hit.closest('.mm-tray-card')) {
      drag.target = { type: 'tray' };
      trayCard.classList.add('mm-tray-hot');
    }
  }

  function stopListening() {
    if (drag && drag.raf) cancelAnimationFrame(drag.raf);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
  }

  function onCancel() {
    stopListening();
    if (drag && drag.ghost) drag.ghost.remove();
    drag = null;
    clearHighlights();
    drawMap();
  }

  function onUp() {
    stopListening();
    const d = drag;
    drag = null;
    if (!d) return;
    if (d.ghost) d.ghost.remove();
    clearHighlights();
    if (!d.moved) {
      onEdit(d.rec);
      return;
    }
    const t = d.target;
    let changes = null;
    let label = '';
    if (t && t.type === 'slot') {
      const occupant = bySlot[t.id] || null;
      changes = [[d.rec, t.id]];
      if (d.src.type === 'slot') {
        if (occupant) changes.push([occupant, d.src.slotId]);
        label = occupant ? `Swapped ${shortName(d.rec.name)} ↔ ${shortName(occupant.name)}` : `Moved ${shortName(d.rec.name)}`;
      } else {
        if (occupant) changes.push([occupant, null]);
        label = occupant ? `Placed ${shortName(d.rec.name)}, ${shortName(occupant.name)} is now unplaced` : `Placed ${shortName(d.rec.name)}`;
      }
    } else if (t && t.type === 'tray') {
      changes = [[d.rec, null]];
      label = `Removed ${shortName(d.rec.name)} from the map`;
    }
    if (changes) onChange(changes, label);
    else drawMap();
  }

  function startDrag(e, src) {
    const rec = src.type === 'slot' ? bySlot[src.slotId] : records.find((r) => r.key === src.key);
    if (!rec) return;
    e.preventDefault();
    drag = { src, rec, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, ghost: null, target: null, raf: 0 };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }

  svg.addEventListener('pointerdown', (e) => {
    const slot = e.target.closest('.mm-slot');
    if (slot) startDrag(e, { type: 'slot', slotId: slot.dataset.id });
  });
  tray.addEventListener('pointerdown', (e) => {
    const chip = e.target.closest('.mm-chip');
    if (chip) startDrag(e, { type: 'rec', key: chip.dataset.key });
  });
  // Keyboard: Enter on a room or chip opens its details
  svg.addEventListener('keydown', (e) => {
    const slot = e.target.closest('.mm-slot');
    if (slot && (e.key === 'Enter' || e.key === ' ') && bySlot[slot.dataset.id]) {
      e.preventDefault();
      onEdit(bySlot[slot.dataset.id]);
    }
  });
  tray.addEventListener('keydown', (e) => {
    const chip = e.target.closest('.mm-chip');
    if (chip && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onEdit(records.find((r) => r.key === chip.dataset.key));
    }
  });

  drawTray();

  return {
    setRecords(next) {
      records = next;
      loaded = true;
      if (!drag) redraw();
    },
    redraw,
    freeSlots: () => SLOTS.filter((s) => !bySlot[s.id]),
    unplaced
  };
}
