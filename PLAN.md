# Plan tracker

Each entry below links to a detailed plan in
[`.claude/plans/`](.claude/plans/). Tick the box once the task ships.
Convention is documented in [`CLAUDE.md`](CLAUDE.md).

## Open

_(none — see "Shipped this batch" below.)_

## Shipped this batch

- [x] **Highscore name cap 8 → 12 + live code-point-aware input cap** — fixes the visible-vs-saved-name disagreement caused by HTML `maxlength` counting UTF-16 units while every JS sanitiser counts code points — [plan](.claude/plans/highscore-name-cap-12-and-input-fix.md)
- [x] **`GAMEPLAY.md` — strategy & stats field guide** — survival math, month-by-month strategy, scoring breakdown, win-chance chapter — [plan](.claude/plans/gameplay-md-strategy-guide.md)
- [x] **`WEB_IMPRINT` env-var → German Impressum dialog** — deploy-time secret stamps `assets/imprint.js` (multiline-safe via `node + JSON.stringify`); link on the start screen opens a DSGVO-compliant modal. Iterated through three placements (viewport-fixed footer → in-card footer → in-card pair → start-screen-only after the user dropped the panel link) — [plan](.claude/plans/web-imprint-env-var.md)
- [x] **Bubblewrap CI hardening** — non-interactive Android workflow (config pre-write, SDK-layout symlink, `init` → `update` swap, local icon-server) — [plan](.claude/plans/bubblewrap-ci-hardening.md)
- [x] **PWA install button + fullscreen on installed launch** — wire missing DOM, flip manifest `display` to `fullscreen` — [plan](.claude/plans/pwa-install-button-and-fullscreen.md)
- [x] **Declare GPL-3.0-or-later + audit third-party credits** — drop canonical `LICENSE`, fill `package.json` field, rewrite README credits — [plan](.claude/plans/license-gpl3-and-credits-audit.md)
- [x] **Highscores: track survival time + cause-of-death per life** — six-column LIVES-icons render, additive Convex schema — [plan](.claude/plans/highscores-cause-of-death-and-survival-time.md)
- [x] **PWA polish: apple-touch-icon + manifest id/lang/categories** — iOS install polish + 180×180 icon render in deploy workflow — [plan](.claude/plans/pwa-polish-apple-icons-and-manifest.md)
- [x] **Winter ends one month earlier** — five `<3` → `<2` swaps in `getSeasonInfo`, winterness fade-out shifts to `[1.5, 2)`
- [x] **`fallGravity` default 1.0 → 1.8** — falls feel weightier
- [x] **Settings sliders +30% wider** — `input[type=range]` 130 → 170 px
- [x] **Start-screen NOTE rewritten** — TIP block becomes the poetic "see it through and you'll have earned the title of sloth" NOTE; DEV long-press hint dropped
- [x] Anti-tampering #1: server-side plausibility cap on highscore submit — [plan](.claude/plans/highscore-anti-tampering.md)
- [x] Anti-tampering #2: per-anonymous-clientId rate-limit (3 / 60 s) — [plan](.claude/plans/highscore-anti-tampering.md)
- [x] **Sun rays draw before clouds** so a passing cloud occludes the rays as well as the disc — [plan](.claude/plans/forced-prefs-timestamp-and-rays-behind-clouds.md)
- [x] **`FORCED_PREFS_TIMESTAMP`: bump to force-reset stale player-prefs blobs** — [plan](.claude/plans/forced-prefs-timestamp-and-rays-behind-clouds.md)
- [x] **HTML title → "A Sloth's Life" + sloth-face SVG favicon**
- [x] **Sun shade fades in/out over 0.7s on toggle/rain transitions** (natural sunset still drives strength via sun.opacity)
- [x] **Sun shade extends to sloth body, head, and arms** (legs unaffected)
- [x] **Add "Super Sloth Bros Chill" as the second background music track**
- [x] Unicode-safe highscore names (faulbär → FAULBÄR) — [plan](.claude/plans/settings-devmode-and-highscores-top100.md)
- [x] Settings panel: gate dev controls behind a 2.5s long-press on the gear — [plan](.claude/plans/settings-devmode-and-highscores-top100.md)
- [x] Highscores: top-100 dialog with relative timestamps; start/end show top 10 — [plan](.claude/plans/settings-devmode-and-highscores-top100.md)
- [x] **Apple reward bumped from +10 to +15 points**
- [x] **Version stamp: env-prefixed, semver-only, no JSON link**

## Shipped

- [x] [Two-finger pinch zoom (toggleable, default off)](.claude/plans/two-finger-zoom.md)
- [x] **Workflow: Node 24 opt-in for JS actions**
- [x] **Lightning kill: debit lives immediately (player → all, natural → 1)**
- [x] **Lightning kill ends the run + dedicated "you bastard" banner**
- [x] **Bug fix: charred-sloth source-atop blackout (heavy-rain "screen black" bug)**
- [x] **Cache-bust CSS/JS/audio URLs with `?v=<SHA>` injected by deploy workflow**
- [x] [GitHub Pages — manual one-time setup](.claude/plans/github-pages-manual-setup.md)
  — Pages source, default branch, and `github-pages` environment
  protection were flipped by the maintainer.
- [x] **Top HUD: month/survival bar 2× wider; full month name when it fits**
- [x] **SUN SHADOW sub-toggle — directional cast shadow on the grass**
- [x] **Version stamp at top of settings panel (deploy workflow injects build/date/SHA)**
- [x] **Kill-by-hold = thunderstorm + lightning strike (replaces skull/desat overlay)**
- [x] **Brighter settings panel text (alpha bumps for readability)**
- [x] **Bug fix: cap rain+night dim overlay so the tree stays visible in heavy storms at night**
- [x] **Sun-position shade on the foreground (toggleable, off in rain)**
- [x] **Heavier rain: more drops, fall speed up to 3× via `1 + 2·intensity`**
- [x] **Tap-to-kill drops the sloth + skull overlay & desaturation while holding**
- [x] **Apple colour palette: random reds, oranges, amber, and yellow**
- [x] **Tap-and-hold to kill the sloth + start-screen game-length tip**
  — long-press the sloth to blacken it; 3 s ⇒ death. Bold yellow tip
  on the start screen surfaces the ~45 min / 30-month run length.
- [x] [Top HUD: hearts → score (left) → bars (right)](.claude/plans/top-hud-layout-hearts-score-bars.md)
- [x] [Eating mouth animation + sleep lock](.claude/plans/eating-mouth-animation.md)
- [x] [Settings as rightmost icon + hide bottom bar when panel is open](.claude/plans/settings-rightmost-and-hide-bottom-bar.md)

History before the planning convention lives in `git log` rather
than as retroactive plan files.
