# A Sloth's Life

[![Deploy to GitHub Pages](https://github.com/blurayne/slothlife/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/blurayne/slothlife/actions/workflows/deploy-pages.yml)

> ▶ **Play it now: <https://blurayne.github.io/slothlife/>**

A tiny browser game: guide a sloth through a windswept tree, swing
between branches, eat leaves and apples, sleep through the lean
hours, and try not to starve or fall.

## How to play

- **Tap a branch** to swing the sloth toward it.
- **Tap an apple** for **+10 pts**, **tap a leaf** for **+1 pt**.
- **Swipe the grass** to pan the scene left or right.
- The hunger bar drains constantly — keep eating. Sleeping slows
  the drain.
- **Space** or tap the clock to pause.
- A fall or starvation costs a life. Three lives total.
- Eat every apple to win; each surviving life is **+100 pts**.

## Settings

The **PARAMS** button (bottom-center) opens a side panel with
toggles and sliders for:

- **Visual:** pixelize / scanlines, background and cloud blur,
  pixel size.
- **World:** day cycle, time of day, rain, seasons, month,
  randomize backdrop.
- **Wind & branches:** force, speed, turbulence, stiffness,
  damping, swing.
- **Tree structure:** depth, length, detail, leaves, apples, grass.
- **Sloth:** arm reach, gravity, reach time, weight.
- **Audio:** music volume, sfx volume.

The sound icon (bottom-right) cycles through three modes:

- **full** — background music + sound effects
- **fx**  — sfx only, no music
- **mute** — silent

The other corner icon toggles fullscreen.

## Run locally

The page uses `fetch()` to load audio, which doesn't work over
`file://`, so serve the directory over HTTP:

    python3 -m http.server 8000
    # then open http://localhost:8000/

There is no build step — `index.html` loads `assets/styles.css`,
`assets/main.js` and three MP3s directly.

## Layout

    index.html              page markup
    assets/styles.css       all styles
    assets/main.js          game (single ES file, no build)
    assets/audio/           three mp3 samples
      mossy-perch.mp3       background music
      snore.mp3             sleep loop
      thunder.mp3           storm strike
    .github/workflows/      GitHub Pages deploy workflow

## Deployment

Pushing to `main` triggers `.github/workflows/deploy-pages.yml`,
which uploads the repo root to GitHub Pages. First-time setup
requires flipping **Settings → Pages → Source** to **GitHub Actions**.

## Credits

- Background music *Mossy Perch* generated with [suno.com][1].
- Snore sample sourced from Epidemic Sound.
- Thunder sample is a freely-licensed field recording.
- Everything else (engine, art, code) is original to this repo.

[1]: https://suno.com/
