# GaBayan Admin Panel

Web admin panel for GaBayan (Firebase project `docsease-efacc`, shared with the mobile app in
`DocsEase-MobileApplication`). Plain HTML, CSS and JavaScript — no framework and no build step:
the browser loads the files in `public/` directly.

## Folders

```
public/                    the website (serve this folder)
  *.html                   one thin page each: <app-sidebar>, <app-topbar>, page markup
  css/app.css              shared styles; imports base/ (tokens, reset, layout) and components/
  css/pages/               styles used by one page only
  js/shell.js              sidebar + top bar (custom elements) and the sidebar menu (NAV)
  js/core/                 firebase setup, session/access rules, API client, helpers
  js/data/                 every Firestore query, one file per collection
  js/components/           reusable UI: dialogs, toasts, profile menu, office form, service editor...
  js/pages/                one module per page, wiring data to components
  tools/                   one-off maintenance scripts run from the browser console (not deployed)
functions/                 Cloud Functions (codebase "admin", region asia-southeast1)
  index.js                 exports only
  src/api/                 adminApi actions (accounts, trash, requests, offices, stats)
  src/auth-recovery.js     adminAuth: forgot-password codes, checked on the server
  src/triggers/            admin claims, citizen notifications
  src/scheduled/           nightly purge of expired Deleted Records
docs/                      reference PDFs
```

## How a page is built

```html
<link rel="stylesheet" href="css/app.css">
<script src="js/shell.js"></script>                       <!-- sidebar + top bar, drawn on first paint -->
<script type="module" src="js/pages/dashboard.js"></script>
...
<app-sidebar active="dashboard"></app-sidebar>
<main class="main"><app-topbar></app-topbar> ...page content... </main>
```

```js
// js/pages/dashboard.js
import { startPage } from '../core/page.js';   // checks the signed-in admin, redirects if needed
const session = await startPage();             // { uid, name, role, office, officeId, ... }
```

- **Menu and access:** edit `NAV` and `SUPER_ADMIN_PAGES` in `js/shell.js`. Super Admin items are
  never drawn for normal admins.
- **Showing data:** build markup with `html\`...\`` from `js/core/dom.js`. It escapes every value,
  so names from the database cannot inject HTML. Use `data-action` attributes and `on()`
  instead of `onclick`.
- **Server actions:** call `api.*` from `js/core/api.js` (one callable function, `adminApi`).
- **Citizen notifications:** saving a service or office through the panel stamps a new `notify_id`;
  the server (`citizen-notify` trigger) writes the notifications. Writes without a new
  `notify_id` (tools, trash/restore) notify nobody.

## Run locally

Serve `public/` with any static server (VS Code Live Server, or):

```bash
cd public && python3 -m http.server 5510
```

Open <http://localhost:5510/login.html>. This uses the real Firebase project.

### Against the emulators (no real data)

```bash
cd functions && npm ci && cd ..
firebase emulators:start --only functions,firestore,auth --project demo-gabayan   # needs Java 21
```

Then open <http://localhost:5510/login.html?emulators>. The `?emulators` flag is remembered for
the tab and only works on localhost. Recovery codes are printed in the emulator log instead of
being emailed.

## Deploy

```bash
firebase deploy --only functions:admin          # this repo's functions only
firebase deploy --only firestore:indexes
firebase deploy --only hosting                  # if the site is hosted on Firebase Hosting
```

The mobile app deploys its own functions (codebase `default`) from its repo; neither deploy
touches the other's functions. Firestore security rules are managed in the Firebase console.
