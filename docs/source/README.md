# Documentation source

Source of `docs/GaBayan-Admin-Documentation.pdf`, the full documentation of the GaBayan admin panel
(user guide, architecture, Cloud Functions, data model, security, maintenance).

| File | What it is |
|------|------------|
| `documentation.html` | The content. Chapters are `<section class="chapter">`, appendices `<section class="appendix">`. |
| `documentation.css` | A4 print layout in the panel's own design (Inter, navy, banner gradient). |
| `numbering.js` | Numbers sections, figures and tables, fills cross-references (`<a class="xref" href="#id">`) and builds the Contents and lists. |
| `images/` | Screenshots taken from the local emulators with sample data. |
| `tools/build-pdf.mjs` | Prints the PDF with Chrome and fills in the Contents page numbers. |
| `tools/capture-screenshots.mjs` | Signs in to the emulators and retakes every screenshot. |
| `tools/seed-emulator.cjs` | Fills the emulators with the sample data used in the screenshots. |

## Rebuild the PDF

```bash
cd docs/source
npm install          # once: installs puppeteer-core (uses your installed Chrome)
npm run build        # writes docs/GaBayan-Admin-Documentation.pdf
```

Set `CHROME=/path/to/chrome` if Chrome is not found. Writing tips: give every new `h2`, `figure` and
`table` an `id`, put a `<figcaption>` / `<caption>` on figures and tables, and refer to them with
`<a class="xref" href="#that-id"></a>`. Numbers and the Contents update themselves.

## Retake the screenshots

Runs only against the local emulators (project `demo-gabayan`), never the real project.

```bash
# 1. from the repository root
cd functions && npm ci && cd ..
firebase emulators:start --only auth,firestore,functions --project demo-gabayan > docs/source/emulators.log   # Java 21+, or npx firebase-tools@13 with Java 17

# 2. in a second terminal
node docs/source/tools/seed-emulator.cjs
cd public && python3 -m http.server 5510

# 3. in a third terminal
cd docs/source
EMULATOR_LOG=emulators.log npm run screenshots   # the log gives the recovery code for the Reset Password screenshot
npm run build
```

On Windows PowerShell, set the variable first: `$env:EMULATOR_LOG = "emulators.log"; npm run screenshots`.
`emulators.log` is ignored by git (`docs/source/.gitignore`).
