# Plan: declare GPL-3.0-or-later + audit third-party credits

## Context

The repo had no `LICENSE` file at the root, no `license` field in
`package.json`, and the README's "Credits" tail was a four-line
paragraph that only credited one of seven audio files. Without a
declared licence, GitHub's default applied: all rights reserved,
no permission to copy or modify even though the repo is public.

## Audit findings

* **Project itself** — no licence file, no SPDX field. Per user
  decision: GPL-3.0-or-later.
* **devDependencies** — all Apache-2.0 (`@bubblewrap/cli`,
  `convex`, `typescript`). Apache-2.0 is one-way GPL-3-compatible,
  so the combined work distributes cleanly under GPL-3.
* **Runtime ESM import** — `convex/browser` from esm.sh, also
  Apache-2.0.
* **Audio** — all five music tracks + the snore + thunder SFX
  are Suno-generated (per user confirmation).
* **Code, art, fonts** — `assets/main.js`, `assets/styles.css`,
  `sw.js`, `convex/*.ts`, and `assets/favicon.svg` are
  author-original. Fonts are system-only (`Courier New`,
  `monospace`).

## Changes

* `LICENSE` — verbatim canonical GPL-3.0 text from
  `/usr/share/common-licenses/GPL-3` (FSF, 2007).
* `package.json` — add `"license": "GPL-3.0-or-later"`.
* `README.md` — replace the four-line "Credits" with a proper
  "Licence & credits" section:
  - Licence pointing at LICENSE + © blurayne and contributors.
  - Audio: name all five music tracks + snore + thunder as
    Suno-generated.
  - Engine / art / icons: GPL-3-licensed originals.
  - Third-party software table with versions + licences.
  - Note that Apache-2.0 is GPL-3-compatible one-way.

No SPDX headers in individual source files — top-level `LICENSE`
plus the `package.json` field plus the README claim cover the
legal surface; per-file boilerplate is noise.

## Critical files

- `LICENSE` (new)
- `package.json` (license field)
- `README.md` (Licence & credits section)

## Verification

1. GitHub repo header now shows the GPL-3.0 badge.
2. `npm view` of any future publish surfaces the licence.
3. README's licence section reads cleanly + the audio attribution
   covers all seven `assets/audio/*.mp3` files.

## Shipped

- `c18ce8e` — license: declare GPL-3.0-or-later + audit third-party credits
