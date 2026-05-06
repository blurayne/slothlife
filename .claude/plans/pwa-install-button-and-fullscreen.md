# Plan: PWA install button + fullscreen on installed launch

## Context

User reported the install button never appeared in the settings
panel on Chrome. Investigation: the `beforeinstallprompt` /
`appinstalled` / `b-install` click handler had been in
`assets/main.js` since launch (lines 401-441), but the matching
DOM elements (`#r-install` row + `#b-install` button) were never
added to `index.html`. The handler ran every page load,
listened for the install event, then quietly tried to unhide an
element that didn't exist.

Plus: when the PWA IS installed, launch should hide the OS chrome
(status bar + nav bar) — the manifest currently declares
`"display": "standalone"` which keeps the status bar visible on
Android.

## Changes

### `index.html` — install row + button

Add at the bottom of the player-mode panel section, right after
SFX VOL and before the `<div class="dev-only">` block:

```html
<div class="prow" id="r-install" style="display:none">
  <span class="pname"></span>
  <button id="b-install" style="background:#1a1a1a;color:#cfa45a;border:1px solid #555;padding:5px 14px;font:bold 12px 'Courier New',monospace;cursor:pointer;letter-spacing:1px;">INSTALL APP</button>
</div>
```

Element IDs match the existing handler. Inline styles match the
NEXT TRACK / NEXT BACKGROUND buttons so the install row blends
in with the rest of the panel buttons.

### `assets/main.js` — extend the standalone check

The handler at line 408 detects "already installed" via
`matchMedia('(display-mode: standalone)').matches ||
navigator.standalone === true`. Because the next change flips the
manifest to `display: fullscreen`, also recognise `fullscreen`
and `minimal-ui` so the install row stays hidden right after a
fresh install:

```js
const isStandalone = (
  (window.matchMedia && (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  )) ||
  window.navigator.standalone === true
);
```

### `manifest.json` — display: fullscreen + display_override

```diff
- "display": "standalone",
+ "display": "fullscreen",
+ "display_override": ["fullscreen", "standalone", "minimal-ui"],
```

Browsers that don't support fullscreen mode (older Edge / Samsung)
fall back through `display_override` to standalone, then
minimal-ui. iOS Safari ignores the manifest entirely, but
`apple-mobile-web-app-status-bar-style="black-translucent"` (in
`index.html` since 15f8306) gives the same visual result there.

The browser-tab launch (`https://blurayne.github.io/slothlife/`)
is unaffected — manifest only governs the installed-PWA launch.

## Critical files

- `index.html` — new install row, before the dev-only block.
- `assets/main.js:408` — extend isStandalone detection.
- `manifest.json` — display fullscreen + display_override.

## Verification

1. Hard-reload Chrome / Edge once Pages redeploys. Open settings
   panel — INSTALL APP row appears at the bottom of the player
   section.
2. Click the button → native install prompt → "Install" →
   button vanishes (via the `appinstalled` listener).
3. Re-open the app from the home-screen icon. Settings panel
   shows no install button (standalone-mode check kicks in).
   Status bar + nav bar are gone (display: fullscreen).
4. Open the same URL in Firefox / iOS Safari → button stays
   hidden (`beforeinstallprompt` never fires there).

## Shipped

- `8794fc0` — pwa: add INSTALL APP row to the settings panel.
- `9036c77` — pwa: launch installed app in fullscreen (was standalone).
