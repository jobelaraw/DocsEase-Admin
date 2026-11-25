// Numbers chapters, sections, figures and tables, fills cross-references and builds
// the Contents, List of Figures and List of Tables. Runs when documentation.html is
// opened (in a browser or by tools/build-pdf.mjs); sets window.docReady when done.
//
//   <section class="chapter" id="ch-guide"><h1>Using the Admin Panel</h1> ...
//     <h2 id="guide-dashboard">Dashboard</h2>                     -> "3.5 Dashboard"
//     <figure id="fig-dashboard"><img ...><figcaption>...</figcaption></figure> -> "Figure 3.4"
//     <table id="tbl-pages"><caption>...</caption> ...           -> "Table 3.1"
//   <a class="xref" href="#fig-dashboard"></a>                    -> "Figure 3.4"
// Appendices (<section class="appendix">) are lettered A, B, C.
(function () {
  'use strict';

  const labels = new Map(); // id -> "Figure 3.4" / "Section 3.5" / "Chapter 3"
  const toc = [];
  const figures = [];
  const tables = [];
  let chapterNo = 0;
  let appendixNo = 0;
  let autoId = 0;

  const ensureId = (el, prefix) => {
    if (!el.id) el.id = `${prefix}-${++autoId}`;
    return el.id;
  };
  // Text of a heading or caption without its role badges ("Super Admin", …)
  const text = (el) => {
    const copy = el.cloneNode(true);
    copy.querySelectorAll('.badge').forEach((b) => b.remove());
    return copy.textContent.replace(/\s+/g, ' ').trim();
  };
  // Badges inside headings are decoration: keep them out of the PDF bookmarks.
  document.querySelectorAll('h1 .badge, h2 .badge, h3 .badge').forEach((b) => b.setAttribute('aria-hidden', 'true'));
  const span = (cls, value) => {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = value;
    return s;
  };

  document.querySelectorAll('section.chapter, section.appendix').forEach((chapter) => {
    const isAppendix = chapter.classList.contains('appendix');
    const num = isAppendix ? String.fromCharCode(64 + ++appendixNo) : String(++chapterNo);
    const word = isAppendix ? 'Appendix' : 'Chapter';
    const h1 = chapter.querySelector('h1');
    const title = text(h1);
    const h1Id = ensureId(h1, 'ch');
    chapter.dataset.num = num;
    // "Chapter 3" is shown above the title but kept out of the PDF bookmark, which reads
    // "3 Title" (from the hidden number; the no-break space survives layout).
    const kicker = span('ch-kicker', `${word} ${num}`);
    kicker.setAttribute('aria-hidden', 'true');
    h1.prepend(kicker, span('sr-only', `${num}\u00a0`));
    labels.set(h1Id, `${word} ${num}`);
    if (isAppendix && appendixNo === 1) toc.push({ level: 'group', title: 'Appendices' });
    toc.push({ level: 1, id: h1Id, num, title });

    let section = 0;
    let figure = 0;
    let table = 0;
    chapter.querySelectorAll('h2, figure, table').forEach((el) => {
      if (el.tagName === 'H2') {
        const n = `${num}.${++section}`;
        const id = ensureId(el, 'sec');
        const t = text(el);
        el.prepend(span('sec-num', n), document.createTextNode(' '));
        labels.set(id, `Section ${n}`);
        toc.push({ level: 2, id, num: n, title: t });
      } else if (el.tagName === 'FIGURE' && el.querySelector('figcaption')) {
        const n = `${num}.${++figure}`;
        const id = ensureId(el, 'fig');
        const caption = el.querySelector('figcaption');
        const t = text(caption);
        caption.prepend(span('cap-num', `Figure ${n}`), document.createTextNode(' '));
        labels.set(id, `Figure ${n}`);
        figures.push({ id, num: `Figure ${n}`, title: t });
      } else if (el.tagName === 'TABLE' && el.querySelector('caption')) {
        const n = `${num}.${++table}`;
        const id = ensureId(el, 'tbl');
        const caption = el.querySelector('caption');
        const t = text(caption);
        caption.prepend(span('cap-num', `Table ${n}`), document.createTextNode(' '));
        labels.set(id, `Table ${n}`);
        tables.push({ id, num: `Table ${n}`, title: t });
      }
    });
  });

  // Cross-references: <a class="xref" href="#id"></a> -> "Figure 3.4" (text kept if already given)
  document.querySelectorAll('a.xref').forEach((a) => {
    const id = a.getAttribute('href').slice(1);
    if (!a.textContent.trim()) a.textContent = labels.get(id) || `[missing: ${id}]`;
    if (!labels.has(id) && !document.getElementById(id)) a.classList.add('xref-missing');
  });

  // Contents / lists. Page numbers are filled in by tools/build-pdf.mjs ([data-page-of]).
  function entry({ level, id, num, title }) {
    if (level === 'group') return span('toc-group', title);
    const a = document.createElement('a');
    a.href = `#${id}`;
    a.className = `toc-entry toc-l${level}`;
    a.append(span('toc-num', num), span('toc-title', title), span('toc-dots', ''));
    const page = span('toc-page', '');
    page.dataset.pageOf = id;
    a.append(page);
    return a;
  }
  const fill = (selector, items) => {
    const box = document.querySelector(selector);
    if (box) items.forEach((item) => box.append(entry(item)));
  };
  fill('#toc-list', toc);
  fill('#lof-list', figures.map((f) => ({ level: 'f', ...f })));
  fill('#lot-list', tables.map((t) => ({ level: 'f', ...t })));

  window.docStats = { chapters: chapterNo, appendices: appendixNo, figures: figures.length, tables: tables.length };
  window.docReady = true;
})();
