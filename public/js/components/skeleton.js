// Loading placeholders, generated instead of hand-written markup on every page.
import { html } from '../core/dom.js';

const WIDTHS = [60, 45, 70, 55, 40, 65, 50, 75];
const width = (i) => WIDTHS[i % WIDTHS.length];

export const skeleton = {
  // Big tiles (office / service grids)
  tiles: (count = 6) => html`${Array.from({ length: count }, (_, i) => html`
    <div class="tile is-placeholder" aria-hidden="true"><span class="skel skel-title skel-on-dark" data-style="width:${width(i)}%"></span></div>`)}`,

  // Text lines
  lines: (count = 3) => html`<div class="skel-stack" aria-hidden="true">${Array.from({ length: count }, (_, i) => html`
    <span class="skel skel-text" data-style="width:${width(i) + 20}%"></span>`)}</div>`,

  // Table rows with the given number of cells
  rows: (count = 6, cells = 4) => html`${Array.from({ length: count }, (_, r) => html`
    <tr class="skel-tr" aria-hidden="true">${Array.from({ length: cells }, (_, c) => html`
      <td><span class="skel skel-text" data-style="width:${width(r + c)}%"></span></td>`)}</tr>`)}`,

  // A number inside a stat card
  number: (w = 72, h = 34) => html`<span class="skel skel-inline" data-style="width:${w}px;height:${h}px" aria-hidden="true"></span>`
};
