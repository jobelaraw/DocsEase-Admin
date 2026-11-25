// Takes the screenshots used in the documentation from the LOCAL emulators.
//
//   1. firebase emulators:start --only auth,firestore,functions --project demo-gabayan
//   2. node tools/seed-emulator.cjs                      (sample data)
//   3. cd public && python3 -m http.server 5510           (serve the site)
//   4. node tools/capture-screenshots.mjs                 (from docs/source)
//
// Env: CHROME (browser path, default /usr/bin/google-chrome), SITE (default
// http://localhost:5510), EMULATOR_LOG (functions emulator output; lets the script
// read the password-recovery code for the "Reset Password" screenshot).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'images');
const SITE = process.env.SITE || 'http://localhost:5510';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const PASSWORD = 'GaBayan#2026';
const SUPER = 'superadmin@gabayan.test';
const OFFICE_ADMIN = 'maria.santos@gabayan.test';
const BPLO = 'BUSINESS-PERMITS-AND-LICENSING-OFFICE';
const SERVICE = `${BPLO}-NEW-BUSINESS-APPLICATION`;

fs.mkdirSync(OUT, { recursive: true });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars', '--font-render-hinting=none'],
  env: { ...process.env, TZ: 'Asia/Manila' }
});

async function newPage(context, { width = 1440, height = 900, scale = 1.5 } = {}) {
  const page = await context.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  page.on('pageerror', (e) => console.log('  [page error]', e.message));
  // No blinking text cursor in the pictures
  await page.evaluateOnNewDocument(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '*{caret-color:transparent !important}';
      document.head.appendChild(style);
    });
  });
  return page;
}

async function shot(page, name, options = {}) {
  await page.evaluate(() => document.fonts.ready);
  await pause(options.settle ?? 600);
  await page.waitForFunction(() => !document.getAnimations().some((a) => a instanceof CSSTransition && a.playState === 'running'), { timeout: 5000 }).catch(() => {});
  if (options.resetScroll) await page.evaluate(() => document.querySelectorAll('*').forEach((el) => { if (el.scrollLeft) el.scrollLeft = 0; }));
  const file = path.join(OUT, `${name}.jpg`);
  // around: { selector, pad } crops the picture to one element (a dialog, a form panel)
  let clip;
  if (options.around) {
    const { selector, pad = 28 } = options.around;
    const r = await page.$eval(selector, (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; });
    const vp = page.viewport();
    const x = Math.max(0, r.x - pad);
    const y = Math.max(0, r.y - pad);
    clip = { x, y, width: Math.min(vp.width, r.x + r.width + pad) - x, height: Math.min(vp.height, r.y + r.height + pad) - y };
  }
  await page.screenshot({ path: file, type: 'jpeg', quality: 90, captureBeyondViewport: false, ...(clip ? { clip } : {}), ...options.screenshot });
  console.log(`  ✓ ${name}.jpg`);
}

async function step(name, fn) {
  try {
    await fn();
  } catch (error) {
    failures.push(name);
    console.log(`  ✗ ${name}: ${error.message.split('\n')[0]}`);
  }
}

// Every page load carries ?emulators: the flag lives in sessionStorage, so a new tab
// without it would talk to the real Firebase project.
const withEmulators = (url) => (/[?&]emulators\b/.test(url) ? url : `${url}${url.includes('?') ? '&' : '?'}emulators`);

async function open(page, url, ready) {
  await page.goto(`${SITE}/${withEmulators(url)}`, { waitUntil: 'load' });
  if (ready) await page.waitForFunction(ready, { timeout: 45000 });
}

async function signIn(page, email) {
  await open(page, 'login.html');
  await page.waitForSelector('#si-email');
  await pause(500);
  await page.type('#si-email', email);
  await page.type('#si-password', PASSWORD);
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), page.click('#sign-in-btn')]);
}

// The login headlines type and delete words; wait until a whole word is shown.
const WORDS = ['Citizens.', 'Applicants.', 'Biñanenses.', 'Lead', 'Drive', 'Join', 'Forgot', 'Recover', 'Lost'];
async function wholeWord(page, selector) {
  await page.waitForFunction((sel, words) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.offsetParent !== null) || document.querySelector(sel);
    return el && words.includes(el.textContent);
  }, { timeout: 20000, polling: 50 }, selector, WORDS);
}

const noSkeletons = (scope = 'body') => new Function(`return !document.querySelector('${scope} .skel') && !document.querySelector('${scope} [aria-busy="true"]')`);

// ------------------------------------------------------------------ login screens
console.log('Login page');
{
  const context = await browser.createBrowserContext();
  const page = await newPage(context);
  await step('login', async () => {
    await open(page, 'login.html');
    await page.waitForSelector('#si-email');
    await pause(1500);
    await wholeWord(page, '#typewriter');
    await shot(page, 'login-signin', { settle: 150 });
  });
  await step('signup', async () => {
    await page.click('[data-go="signup"]');
    await pause(1500); // let the screens finish sliding: focusing a half-hidden field scrolls the strip
    await page.waitForFunction(() => document.querySelectorAll('#su-office option').length > 1, { timeout: 20000 });
    await page.type('#su-name', 'Liza Mendoza');
    await page.type('#su-email', 'liza.mendoza@gabayan.test');
    await page.select('#su-office', "City Assessor's Office");
    await page.type('#su-password', 'GaBayan#20');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await pause(1500);
    await wholeWord(page, '#typewriter2');
    await shot(page, 'login-signup', { settle: 150, resetScroll: true });
  });
  await step('terms', async () => {
    await page.click('#agr-checkbox');
    await shot(page, 'login-terms', { settle: 900 });
    await page.keyboard.press('Escape');
    await pause(500);
  });
  await step('forgot', async () => {
    await page.click('#signup-screen [data-go="signin"], [data-go="signin"]');
    await pause(1200);
    await page.click('[data-go="forgotpass"]');
    await pause(1200);
    await page.type('#recovery-email', OFFICE_ADMIN);
    await pause(1500);
    await wholeWord(page, '#typewriter3');
    await shot(page, 'login-forgot', { settle: 150, resetScroll: true, around: { selector: '#screen-forgotpass .form-panel', pad: 0 } });
  });
  await step('recovery code', async () => {
    await page.click('[data-action="send-code"]');
    await page.waitForSelector('[data-toast="ok"]:not([hidden])', { visible: true, timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('.toast-title')?.textContent.includes('Sent'), { timeout: 30000 });
    await page.click('[data-toast="ok"]');
    await pause(1500);
    await wholeWord(page, '#typewriter3b');
    await shot(page, 'login-recovery-code', { settle: 150, resetScroll: true, around: { selector: '#screen-recoverycode .form-panel', pad: 0 } });
  });
  await step('reset password', async () => {
    const log = process.env.EMULATOR_LOG && fs.existsSync(process.env.EMULATOR_LOG) ? fs.readFileSync(process.env.EMULATOR_LOG, 'utf8') : '';
    const codes = [...log.matchAll(/recovery code for maria\.santos@gabayan\.test: (\d{6})/g)];
    if (!codes.length) throw new Error('no recovery code in EMULATOR_LOG (skipped)');
    await page.type('#recovery-code', codes[codes.length - 1][1]);
    await page.click('[data-action="verify-code"]');
    await page.waitForFunction(() => document.querySelector('.toast-title')?.textContent.includes('Verified'), { timeout: 30000 });
    await page.click('[data-toast="ok"]');
    await pause(600);
    await page.type('#new-password', 'NewPass#2026');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await pause(1500);
    await wholeWord(page, '#typewriter3c');
    await shot(page, 'login-reset', { settle: 150, resetScroll: true, around: { selector: '#screen-resetpass .form-panel', pad: 0 } });
  });
  await context.close();
}

// ------------------------------------------------------------------ Super Admin
console.log('Super Admin');
{
  const context = await browser.createBrowserContext();
  const page = await newPage(context);
  await signIn(page, SUPER);

  await step('dashboard', async () => {
    await page.waitForFunction(() => !document.querySelector('#stat-services .skel') && !document.querySelector('#most-used[aria-busy]') && !document.querySelector('#trend-skel'), { timeout: 45000 });
    await shot(page, 'dashboard-super', { settle: 1500 });
  });
  await step('office form', async () => {
    await page.click('[data-add-office]');
    await page.waitForSelector('#of-name', { visible: true });
    await page.type('#of-name', 'Office of the City Veterinarian');
    await page.type('#of-desc', 'Animal health, anti-rabies vaccination and meat inspection services.');
    await page.select('#of-floor', 'second_floor');
    await page.select('#of-category', 'regular_service');
    await page.select('#of-day-from', 'Mon');
    await page.select('#of-day-to', 'Fri');
    await page.$eval('#of-open', (el) => { el.value = '08:00'; });
    await page.$eval('#of-close', (el) => { el.value = '17:00'; });
    await shot(page, 'office-form', { settle: 900, around: { selector: '.modal-box' } });
  });
  await step('service management', async () => {
    await open(page, 'service-management.html', () => document.querySelectorAll('#offices .tile[data-name]').length > 3);
    await page.hover('#offices .tile[data-name]');
    await shot(page, 'service-management', { settle: 900 });
  });
  await step('confirm delete office', async () => {
    await page.click('#offices .tile[data-name] [data-action="trash"]');
    await page.waitForSelector('[data-toast="ok"]', { visible: true });
    await shot(page, 'confirm-delete-office', { settle: 700, around: { selector: '.toast-box' } });
    await page.click('[data-toast="cancel"]');
  });
  await step('service form', async () => {
    await open(page, `service-form.html?officeId=${BPLO}&serviceId=${SERVICE}`, () => {
      const body = document.querySelector('#form-body');
      return body && !body.hidden && body.classList.contains('is-ready');
    });
    await shot(page, 'service-form', { settle: 1200 });
  });
  await step('service form steps', async () => {
    await page.evaluate(() => {
      const card = document.querySelector('.step-card');
      card.querySelector('[data-toggle-step]').click();
      [...document.querySelectorAll('.form-section-title')].find((h) => h.textContent.includes('Step-by-Step')).scrollIntoView({ block: 'start' });
    });
    await shot(page, 'service-form-steps', { settle: 900 });
  });
  await step('map management', async () => {
    await open(page, 'map-management.html', () => !document.querySelector('#mm-map-skel') && document.querySelectorAll('#mm-map .mm-slot').length > 5);
    await shot(page, 'map-management', { settle: 1200 });
  });
  await step('analytics', async () => {
    await open(page, 'analytics.html', () => !document.querySelector('[data-chart-skel]') && !document.querySelector('[data-skel] .skel') && !document.querySelector('[aria-busy="true"]'));
    await shot(page, 'analytics-super', { settle: 1800 });
    await page.evaluate(() => document.querySelector('.section-heading').scrollIntoView({ block: 'start' }));
    await shot(page, 'analytics-super-2', { settle: 1200 });
  });
  await step('review queue pending', async () => {
    await open(page, 'review-queue.html', () => document.querySelectorAll('#grid .rq-card .rq-name').length > 0);
    await shot(page, 'review-pending', { settle: 900 });
  });
  await step('review queue completed', async () => {
    await page.click('[data-tab="completed"]');
    await page.click('[data-range="week"]');
    await page.waitForFunction(() => document.querySelectorAll('#grid .rq-card .rq-name').length > 0, { timeout: 30000 });
    await shot(page, 'review-completed', { settle: 900 });
  });
  await step('review queue deleted', async () => {
    await page.click('[data-tab="deleted"]');
    await page.waitForFunction(() => document.querySelectorAll('#grid .rq-card .rq-kind').length > 0, { timeout: 45000 });
    await shot(page, 'review-deleted', { settle: 900 });
  });
  await step('accounts users', async () => {
    await open(page, 'account-management.html', () => document.querySelectorAll('#accounts .acct-row .acct-name').length > 5);
    await shot(page, 'accounts-users', { settle: 900 });
  });
  await step('admin list', async () => {
    await page.click('[data-section="admins"]');
    await page.waitForFunction(() => document.querySelector('[data-section="admins"].active') && document.querySelectorAll('#accounts .acct-row .acct-name').length > 2, { timeout: 30000 });
    await pause(600);
  });
  await step('deactivate dialog', async () => {
    await page.evaluate(() => {
      const row = [...document.querySelectorAll('#accounts .acct-row')].find((r) => r.textContent.includes('Jose Reyes'));
      row.querySelector('[data-action="deactivate"]').click();
    });
    await page.waitForSelector('#status-reason', { visible: true });
    await page.type('#status-reason', 'On extended leave');
    await shot(page, 'accounts-deactivate', { settle: 900, around: { selector: '.modal-box' } });
    await page.keyboard.press('Escape');
  });
  await step('activity log', async () => {
    await open(page, 'activity-log.html', () => document.querySelectorAll('#log-list .log-row[data-id]').length > 3);
    await page.evaluate(() => {
      const rows = document.querySelectorAll('#log-list .log-row[data-id] .log-check');
      rows[1].click();
      rows[2].click();
    });
    await shot(page, 'activity-log', { settle: 900 });
  });
  await step('profile', async () => {
    await page.click('[data-profile-toggle]');
    await page.waitForSelector('.profile-dropdown', { visible: true });
    await page.click('[data-profile-action="edit"]');
    await page.waitForSelector('#profile-name', { visible: true });
    await shot(page, 'profile-edit', { settle: 900, around: { selector: '.modal-box' } });
  });
  await context.close();
}

// ------------------------------------------------------------------ Office Admin
console.log('Office Admin');
{
  const context = await browser.createBrowserContext();
  const page = await newPage(context);
  await signIn(page, OFFICE_ADMIN);
  await step('dashboard (office)', async () => {
    await page.waitForFunction(() => !document.querySelector('#stat-services .skel') && !document.querySelector('#most-used[aria-busy]') && !document.querySelector('#trend-skel'), { timeout: 45000 });
    await shot(page, 'dashboard-office', { settle: 1500 });
  });
  await step('analytics (office)', async () => {
    await open(page, 'analytics.html', () => !document.querySelector('[data-chart-skel]') && !document.querySelector('#stat-services .skel') && !document.querySelector('#most-used[aria-busy]'));
    await shot(page, 'analytics-office', { settle: 1500 });
  });
  await step('office services (office admin)', async () => {
    await open(page, 'office-services.html', () => document.querySelectorAll('#services .tile').length > 1);
    await shot(page, 'office-services-admin', { settle: 900 });
  });
  await step('request deletion', async () => {
    await open(page, `service-form.html?officeId=${BPLO}&serviceId=${BPLO}-RETIREMENT-OF-BUSINESS`, () => {
      const body = document.querySelector('#form-body');
      return body && !body.hidden && !document.querySelector('#delete').hidden;
    });
    await page.click('#delete');
    await page.waitForSelector('[data-toast="ok"]', { visible: true });
    await shot(page, 'confirm-request-deletion', { settle: 700, around: { selector: '.toast-box' } });
    await page.click('[data-toast="cancel"]');
  });
  await step('phone', async () => {
    const phone = await newPage(context, { width: 390, height: 844, scale: 2 });
    await open(phone, 'dashboard.html', () => !document.querySelector('#stat-services .skel') && !document.querySelector('#trend-skel'));
    await shot(phone, 'phone-dashboard', { settle: 1500 });
    await phone.click('[data-menu]');
    await shot(phone, 'phone-menu', { settle: 900 });
    await phone.close();
  });
  await context.close();
}

await browser.close();
console.log(failures.length ? `Done with ${failures.length} skipped: ${failures.join(', ')}` : 'Done.');
