# Plan: WEB_IMPRINT env-var → German Impressum dialog

## Context

User wants a deploy-time legal-imprint hook. If a `WEB_IMPRINT`
GitHub Actions secret is set, an "Impressum" link appears on the
start screen + at the bottom of the settings panel and opens a
modal showing a German DSGVO-compliant Impressum that renders
the secret's contents verbatim (monospace, line breaks
preserved). If unset, every link stays hidden — zero impact on
the existing UI.

Reused the existing window-globals pattern (`assets/version.js`
+ `assets/backend-config.js`, both stamped by both deploy
workflows) plus the existing modal pattern (`#ov-hs` highscore
dialog, `.overlay.hidden` toggle, backdrop-click + Escape close).

## Changes

* **`assets/imprint.js`** (new) — `window.WEB_IMPRINT = ''`
  default, mirrors `backend-config.js`'s shape. Loaded from
  `index.html` BEFORE `main.js`.
* **`.github/workflows/deploy-pages.yml`** — new step "Stamp
  WEB_IMPRINT into assets/imprint.js" right before the
  cache-bust step. Uses `node -e` + `JSON.stringify` for
  multiline-safe escaping (the existing `echo`-per-line pattern
  would mangle newlines, quotes, and backslashes that addresses
  commonly contain).
* **`.github/workflows/deploy-vercel.yml`** — same stamp folded
  into the existing "Stamp version.js + backend-config.js"
  step.
* **`index.html`**:
   * `<script src="assets/imprint.js?v=dev">` loads BEFORE
     main.js.
   * Hidden `.ov-imprint-link` block on the start screen between
     `.ov-repo` and `.ov-version`.
   * Hidden `.prow#r-imprint-panel` row right above the existing
     `.pversion-foot` in the settings panel.
   * New `#ov-imprint` overlay modeled on `#ov-hs`. Body
     populated by JS so the address part stays env-driven.
     Close button labelled `SCHLIESSEN` (German) for
     dialog-internal consistency.
* **`assets/main.js`**:
   * `_hasImprint` boot guard reads `window.WEB_IMPRINT`.
   * If non-empty: unhide both link blocks, bind click handlers
     that call `openImprintDialog()`.
   * `renderImprintHTML(rawAddress)` builds the modal body:
     1. **Angaben gemäß § 5 TMG** — env value in
        `<pre class="imprint-contact">`, HTML-escaped via the
        existing `escapeHtml()` helper at `:5845` so addresses
        like `Name <a@b.de>` render literally instead of
        injecting markup.
     2. **Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV**
        — refers up to (1).
     3. **Haftungsausschluss** — Inhalte / Links / Urheberrecht.
     4. **Datenschutzerklärung (DSGVO)** — accurate to this
        app: highscore name+score, anonymous client-ID for
        rate limiting (Art. 6 Abs. 1 lit. f DSGVO), no
        cookies, no tracking, no analytics, contact for
        Auskunft / Löschung.
   * Open/close mirror `#ov-hs`: backdrop-click closes,
     Escape closes.
* **`assets/styles.css`**:
   * `.imprint-dialog .ov-card{ max-width:560px; }` so the
     legal paragraphs breathe.
   * `.imprint-body` scrolls (max-height 70vh).
   * `.imprint-contact` — `white-space:pre-wrap`, courier mono,
     amber border-left → reads as a callout.
   * `.ov-imprint-link a` / `.pimprint` — muted underline,
     brightens on hover. Same affordance on both surfaces.

## Multiline-safe stamping

```bash
node -e "require('fs').writeFileSync(
  'assets/imprint.js',
  'window.WEB_IMPRINT = ' +
  JSON.stringify(process.env.WEB_IMPRINT || '') + ';\n'
)"
```

`JSON.stringify` handles newlines (`\n`), quotes (`\"`),
backslashes, and UTF-8 (e.g. `ß`) cleanly. Smoke-tested locally
with a multiline ß-and-bracket address — output rendered as
`window.WEB_IMPRINT = "Max Mustermann\nMusterstraße 1\n…";`
exactly as expected.

A trailing `head -c 200 assets/imprint.js; echo` prints the
first 200 chars to the workflow log so the stamp is verifiable
from the Actions tab — truncated to keep long addresses out of
public CI logs.

## Critical files

- `assets/imprint.js` (new)
- `.github/workflows/deploy-pages.yml`
- `.github/workflows/deploy-vercel.yml`
- `index.html`
- `assets/main.js`
- `assets/styles.css`

## Verification

1. **Locally without secret.** Open `index.html` over a local
   HTTP server. `window.WEB_IMPRINT === ''` → no Impressum link
   on either surface.
2. **Locally with simulated secret.** Hand-edit
   `assets/imprint.js` to a multiline value; reload → links
   visible on start screen + settings panel; click → modal
   opens; address renders in monospace inside the amber
   callout with line breaks intact; backdrop-click /
   `SCHLIESSEN` / Escape close.
3. **Special characters.** `<` `>` `&` `"` are HTML-escaped
   (not interpreted); `\n\n\n` runs render as blank lines in
   the `<pre>`.
4. **Deployed.** Set repo secret `WEB_IMPRINT` (multiline).
   Push → workflow log shows first 200 chars of the generated
   `imprint.js`. Live site shows the Impressum link.

## Out of scope

- Privacy policy as a separate dialog. Datenschutz lives
  inside the Impressum modal as section #4.
- Cookie banner. App uses localStorage but no cookies; under
  DSGVO/TMG, strictly-necessary localStorage doesn't require
  one.
- i18n / English Impressum. App stays English; Impressum
  stays German because Impressum itself is a German legal
  requirement targeting German-speaking users.

## Shipped

- `7c987bd` — feat: WEB_IMPRINT env-var → German Impressum dialog.

### Follow-up iterations (footer placement)

User asked across several turns to move both the GitHub link
and the Impressum link to a "footer" position. Iterated to the
final layout:

- `0c9896e` — first attempt: viewport-fixed footer outside the
  card. Used `position:fixed; bottom:6px; z-index:31`. User
  rejected — wanted the links to stay inside the card / panel,
  not float at viewport bottom.
- `e1c9482` — GitHub + Impressum sit inside `.ov-card` (start
  screen) and `#panel` (settings) right under the version
  stamp / build-info line. No `position:fixed`. Order is
  GitHub-then-Impressum on both surfaces. Settings panel
  rows are left-aligned per explicit user request; start-card
  rows stay centred to match the rest of the card content.
  Settings panel previously had no GitHub link — added one
  here so both surfaces share the same footer pair.

### Final scope reduction (Task 4)

User's last instruction: "don't put Impressum in settings
dialog". The Impressum link now lives on the start screen
only. The settings panel keeps the GitHub link added in
`e1c9482` (the user's instruction was specifically about
Impressum) and the build-version line, but the Impressum row
is gone. Removed:

- The `#r-imprint-panel` row in `index.html`.
- The `rImprintPanel` / `bImprintPanel` DOM lookups in
  `main.js` and the panel-side click handler.
- The dead `.pimprint` CSS class (only the panel link used
  it; start-screen link uses `.ov-imprint-link a`).

The Impressum modal, the start-screen link, the WEB_IMPRINT
env-var stamping in both deploy workflows, and `_hasImprint`
all stay — they're still used by the start-screen surface.
