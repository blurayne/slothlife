# Repository conventions

## Commits

- **Commit after every development step.** Don't batch unrelated
  changes into one commit; one logical change per commit.
- **Commit directly to `main`.** Pushes to `main` automatically
  build and deploy to GitHub Pages via
  `.github/workflows/deploy-pages.yml`.

## Planning

- For each planned task, **add a checkbox entry to `PLAN.md`** at the
  repo root: `- [ ] Short title — link to detailed plan`. Tick the
  box (`- [x]`) once the task is shipped.
- **Write the detailed plan in `.claude/plans/<slug>.md`** (a
  per-project mirror of the global `~/.claude/plans/` directory) and
  **link to it from the PLAN.md checkbox entry**. The detailed plan
  should include context, the changes to make, critical files, and
  verification — same shape as a plan-mode plan file.
- Update both files in the same commit as the work, or in a small
  follow-up commit if the plan was authored in plan mode before
  implementation.

## Project layout

- No build step — `index.html` loads `assets/styles.css`,
  `assets/main.js` and the MP3s in `assets/audio/` directly.
- All game logic lives in the single `assets/main.js`. Treat it as
  one cohesive module.
- Audio samples are loaded with `fetch()`; the page must be served
  over HTTP (not `file://`) for sound to work.
