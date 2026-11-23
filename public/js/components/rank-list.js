// Ranked list with proportional bars (most-used services, services per office).
import { html, render } from '../core/dom.js';

export function rankListSkeleton(count = 5) {
  const widths = [55, 70, 45, 60, 40];
  return html`${Array.from({ length: count }, (_, i) => html`
    <div class="rank-item" aria-hidden="true">
      <span class="skel skel-circle" style="width:26px;height:26px"></span>
      <div class="rank-bar-wrap skel-stack" style="gap:8px">
        <span class="skel skel-text" style="width:${widths[i % widths.length]}%"></span>
        <span class="skel" style="height:7px"></span>
      </div>
      <span class="skel skel-text" style="width:32px"></span>
    </div>`)}`;
}

// items: [{ name, count }] (already sorted)
export function renderRankList(container, items, { empty = 'No data yet.' } = {}) {
  container.removeAttribute('aria-busy');
  if (!items.length) {
    render(container, html`<div class="rank-empty">${empty}</div>`);
    return;
  }
  const max = items[0].count || 0;
  render(container, html`${items.map((item, i) => html`
    <div class="rank-item">
      <div class="rank-num">${i + 1}</div>
      <div class="rank-bar-wrap">
        <div class="rank-name">${item.name}</div>
        <div class="rank-bar-bg"><div class="rank-bar-fill" style="width:${max ? Math.max(4, (item.count / max) * 100) : 0}%"></div></div>
      </div>
      <div class="rank-count">${item.count.toLocaleString()}</div>
    </div>`)}`);
}
