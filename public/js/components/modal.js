// Dialog base: backdrop, Escape / backdrop click to close, focus kept inside.
//
//   const dialog = openModal({ title: 'Edit Office', body: html`...`, size: 'lg', onClose });
//   dialog.el.querySelector(...); dialog.close();
import { html, render } from '../core/dom.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const open = [];

export function openModal({ title, body, size = '', closable = true, beforeClose = null, onClose = null, labelledBy = '' }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const titleId = labelledBy || `modal-title-${Date.now()}`;
  render(overlay, html`
    <div class="modal-box ${size ? `modal-${size}` : ''}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      ${title ? html`<div class="modal-header">
        <h2 class="modal-title" id="${titleId}">${title}</h2>
        ${closable ? html`<button type="button" class="modal-close" data-modal-close aria-label="Close">&times;</button>` : ''}
      </div>` : ''}
      <div class="modal-body"></div>
    </div>`);
  const box = overlay.querySelector('.modal-box');
  render(box.querySelector('.modal-body'), body);

  const previousFocus = document.activeElement;
  let closed = false;

  async function close(reason = 'close') {
    if (closed) return;
    if (beforeClose && reason !== 'force' && (await beforeClose(reason)) === false) return;
    closed = true;
    overlay.classList.remove('show');
    const i = open.indexOf(dialog);
    if (i !== -1) open.splice(i, 1);
    if (!open.length) document.body.classList.remove('modal-open');
    setTimeout(() => overlay.remove(), 200);
    if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    if (onClose) onClose(reason);
  }

  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay && closable) close('backdrop');
  });
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('[data-modal-close]')) close('button');
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && closable) {
      e.stopPropagation();
      close('escape');
    }
    if (e.key === 'Tab') {
      const items = Array.from(box.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => {
    overlay.classList.add('show');
    const target = box.querySelector('[autofocus]') || box.querySelector('.modal-body ' + FOCUSABLE) || box;
    target.focus();
  });

  const dialog = { el: box, overlay, close };
  open.push(dialog);
  return dialog;
}
