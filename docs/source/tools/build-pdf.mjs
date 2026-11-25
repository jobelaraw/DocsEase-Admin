// Builds docs/GaBayan-Admin-Documentation.pdf from documentation.html with Chrome.
//
//   cd docs/source && npm install && npm run build
//   CHROME=/path/to/chrome npm run build      (if Chrome is not found automatically)
//
// Chrome prints the PDF with bookmarks (from the headings) and clickable links. Every
// link target becomes a named destination in the PDF, so after printing we read which
// page each heading, figure and table landed on, write those numbers into the
// Contents / List of Figures / List of Tables, and print again until nothing moves.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(here, '..', 'documentation.html');
const OUTPUT = path.join(here, '..', '..', 'GaBayan-Admin-Documentation.pdf');

function findChrome() {
  const candidates = [
    process.env.CHROME,
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Chrome not found. Set the CHROME environment variable to its path.');
  return found;
}

function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: here, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------- PDF reading
// Chrome (Skia) writes plain, uncompressed object dictionaries, a page tree and a
// /Dests dictionary of named destinations: enough to map each link target to a page.
function readDestinations(buffer) {
  const pdf = buffer.toString('latin1');
  const objectText = (num) => {
    const m = new RegExp(`(?:^|\\s)${num} 0 obj\\b`).exec(pdf);
    if (!m) return '';
    const start = m.index + m[0].length;
    const end = pdf.indexOf('endobj', start);
    const body = pdf.slice(start, end);
    const stream = body.indexOf('stream');
    return stream === -1 ? body : body.slice(0, stream);
  };
  const ref = (text, key) => {
    const m = new RegExp(`/${key}\\s+(\\d+) 0 R`).exec(text);
    return m ? Number(m[1]) : null;
  };

  const catalogMatch = /(\d+) 0 obj\s*<<\s*\/Type\s*\/Catalog/.exec(pdf) || /(\d+) 0 obj\s*<<[^]*?\/Type\s*\/Catalog/.exec(pdf);
  if (!catalogMatch) throw new Error('PDF catalog not found');
  const catalog = objectText(Number(catalogMatch[1]));

  // Page tree -> object number of each page, in order
  const pageOrder = new Map();
  let count = 0;
  (function walk(num) {
    const text = objectText(num);
    if (/\/Type\s*\/Pages\b/.test(text)) {
      const kids = /\/Kids\s*\[([^\]]*)\]/.exec(text);
      (kids ? [...kids[1].matchAll(/(\d+) 0 R/g)].map((k) => Number(k[1])) : []).forEach(walk);
    } else {
      pageOrder.set(num, ++count);
    }
  })(ref(catalog, 'Pages'));

  // Named destinations: /name [12 0 R /XYZ …] or, in a name tree, (name) [12 0 R …]
  const dests = new Map();
  const collect = (num, seen = new Set()) => {
    if (num == null || seen.has(num)) return;
    seen.add(num);
    const text = objectText(num);
    for (const m of text.matchAll(/\/([A-Za-z0-9_.\-]+)\s*\[\s*(\d+) 0 R/g)) dests.set(m[1], pageOrder.get(Number(m[2])));
    for (const m of text.matchAll(/\(([^)]*)\)\s*\[\s*(\d+) 0 R/g)) dests.set(m[1], pageOrder.get(Number(m[2])));
    const kids = /\/Kids\s*\[([^\]]*)\]/.exec(text);
    if (kids) [...kids[1].matchAll(/(\d+) 0 R/g)].forEach((k) => collect(Number(k[1]), seen));
  };
  collect(ref(catalog, 'Dests'));
  const names = /\/Names\s*<<[^>]*\/Dests\s+(\d+) 0 R/.exec(catalog);
  if (names) collect(Number(names[1]));
  return { pages: count, dests };
}

// ---------------------------------------------------------------- build
const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(SOURCE).href, { waitUntil: 'load' });
  await page.waitForFunction(() => window.docReady === true, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0), { timeout: 60000 })
    .catch(() => console.warn('Some images did not load: check the paths in documentation.html'));

  const commit = gitCommit();
  await page.evaluate((c) => document.querySelectorAll('[data-commit]').forEach((el) => { el.textContent = c ? `commit ${c}` : 'working copy'; }), commit);

  const stats = await page.evaluate(() => window.docStats);
  const missingRefs = await page.$$eval('.xref-missing', (els) => els.map((e) => e.getAttribute('href')));
  if (missingRefs.length) console.warn('Cross-references without a target:', missingRefs.join(', '));

  const print = () => page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: false,
    outline: true,
    tagged: true
  });

  let previous = '';
  let pdf;
  let info;
  for (let pass = 1; pass <= 4; pass++) {
    pdf = Buffer.from(await print());
    info = readDestinations(pdf);
    const numbers = await page.$$eval('[data-page-of]', (els) => els.map((el) => el.dataset.pageOf));
    const map = Object.fromEntries(numbers.map((id) => [id, info.dests.get(id) || '']));
    const key = JSON.stringify(map);
    const unknown = numbers.filter((id) => !map[id]);
    console.log(`pass ${pass}: ${info.pages} pages, ${numbers.length - unknown.length}/${numbers.length} entries located`);
    if (key === previous) break;
    previous = key;
    await page.evaluate((m) => {
      document.querySelectorAll('[data-page-of]').forEach((el) => { el.textContent = m[el.dataset.pageOf] || ''; });
    }, map);
    if (pass === 4) console.warn('Page numbers did not settle after 4 passes.');
  }

  fs.writeFileSync(OUTPUT, pdf);
  const mb = (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1);
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT)}: ${info.pages} pages, ${stats.chapters} chapters, ${stats.appendices} appendices, ${stats.figures} figures, ${stats.tables} tables, ${mb} MB${commit ? `, commit ${commit}` : ''}`);
} finally {
  await browser.close();
}
