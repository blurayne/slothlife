# Repository conventions

## Commits

- **Commit after every development step.** Don't batch unrelated
  changes into one commit; one logical change per commit.
- **Commit directly to `main`.** Pushes to `main` automatically
  build and deploy to GitHub Pages via
  `.github/workflows/deploy-pages.yml`.

## Project layout

- No build step — `index.html` loads `assets/styles.css`,
  `assets/main.js` and the MP3s in `assets/audio/` directly.
- All game logic lives in the single `assets/main.js`. Treat it as
  one cohesive module.
- Audio samples are loaded with `fetch()`; the page must be served
  over HTTP (not `file://`) for sound to work.
