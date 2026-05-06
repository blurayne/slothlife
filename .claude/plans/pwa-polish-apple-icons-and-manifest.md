# Plan: finish iOS PWA polish + manifest id/lang/categories

## Context

The Pages site was already installable on Chrome / Edge / Android
Chrome before this — `manifest.json`, `<link rel="manifest">`,
`theme-color`, HTTPS, and a service worker with a real `fetch`
handler covered Chrome's strict installability gate. What was
still missing was the soft polish that makes the install
experience pleasant outside Chrome's default flow — particularly
on iOS, where install behaviour is governed entirely by `apple-*`
meta tags and `apple-touch-icon`, not the manifest.

## Changes

### `index.html` — five new tags after `theme-color`

```html
<link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png?v=dev">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Sloth's Life">
<meta name="mobile-web-app-capable" content="yes">
```

The trailing `mobile-web-app-capable` is the legacy Android-Chrome
twin — harmless on modern Chrome, helpful for older WebViews.

### `manifest.json` — additive fields

* `id: "/slothlife/"` — pins Chrome's PWA identity so a future
  `start_url` move (custom domain) doesn't register as a new
  install.
* `lang: "en"`, `dir: "ltr"`, `categories: ["games", "entertainment"]`
  — richer install dialogs.

### `.github/workflows/deploy-pages.yml` — render 180×180 icon

Adds one `rsvg-convert -w 180 -h 180 …` line to the icon-render
step so `icons/apple-touch-icon.png` ships with every Pages
deploy. Same SVG source as the 192/512/maskable PNGs.

## Critical files

- `index.html` (head, after the existing `theme-color` meta)
- `manifest.json` (top-of-object additions)
- `.github/workflows/deploy-pages.yml` (icon-render step)

## Verification

1. Push + wait for Pages deploy.
2. Chrome DevTools → Application → Manifest: confirm `id`, `lang`,
   `dir`, `categories` render in the panel; "Installability"
   section shows no warnings.
3. iOS Safari → Share → Add to Home Screen: home-screen icon is
   the sloth-face PNG (not a screenshot of the canvas), label
   reads "Sloth's Life", launching from the icon opens in
   standalone mode with a black-translucent status bar.

## Shipped

- `15f8306` — pwa: finish iOS install polish + manifest id/lang/categories
