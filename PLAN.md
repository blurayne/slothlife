# Plan tracker

Each entry below links to a detailed plan in
[`.claude/plans/`](.claude/plans/). Tick the box once the task ships.
Convention is documented in [`CLAUDE.md`](CLAUDE.md).

## Open

- [x] Anti-tampering #1: server-side plausibility cap on highscore submit — [plan](.claude/plans/highscore-anti-tampering.md)
- [x] Anti-tampering #2: per-anonymous-clientId rate-limit (3 / 60 s) — [plan](.claude/plans/highscore-anti-tampering.md)

## Shipped this batch

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
