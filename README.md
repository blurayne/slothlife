# A Sloth's Life

[![Deploy to GitHub Pages](https://github.com/blurayne/slothlife/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/blurayne/slothlife/actions/workflows/deploy-pages.yml)

> ▶ **Play it now: <https://blurayne.github.io/slothlife/>**

A tiny browser game: guide a sloth through a windswept tree, swing
between branches, eat leaves and apples, sleep through the lean
hours, and try not to starve or fall.

## How to play

- **Tap a branch** to swing the sloth toward it.
- **Tap an apple** for **+10 pts**, **tap a leaf** for **+1 pt**.
- **Survive a full in-game month** for **+50 pts**.
- **Swipe the grass** to pan the scene left or right.
- The hunger bar drains constantly — keep eating. Sleeping slows
  the drain.
- **Space** or tap the clock to pause.
- A fall or starvation costs a life. Three lives total.
- Eat every apple to win; each surviving life is **+250 pts**.

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
    sw.js                   service worker (network-first HTML)
    vercel.json             Vercel routing + cache-control headers
    package.json            Node deps for Convex tooling
    tsconfig.json           TypeScript config for convex/
    assets/styles.css       all styles
    assets/main.js          game (single ES file, no build)
    assets/version.js       build stamp (rewritten on each deploy)
    assets/backend-config.js CONVEX_URL stamp (rewritten on Vercel)
    assets/audio/           four soundtrack mp3s + snore + thunder
    convex/                 TypeScript backend (schema + functions)
      schema.ts             highscore table definition
      highscores.ts         list (query) + submit (mutation)
    .github/workflows/      Pages and (optional) Vercel/Convex deploys

## Deployment

> **GitHub Pages is the default and always works.** Everything below is
> additive — no Vercel account, no Convex project, no secrets, all
> required to have the game running on `https://<owner>.github.io/slothlife/`.

Two independent workflows run on every push to `main`:

- **`.github/workflows/deploy-pages.yml`** — always-on, deploys the
  static site to GitHub Pages. First-time setup: flip
  **Settings → Pages → Source → GitHub Actions** in the repo settings.
- **`.github/workflows/deploy-vercel.yml`** — optional, deploys the
  same site to Vercel and the Convex backend functions. Each step is
  gated on a matching repository secret; if the secret is missing the
  step emits a workflow-level warning and skips, so the workflow stays
  green and the repo can stay Pages-only by default.

When the Vercel deployment is live, the frontend detects the Vercel
hostname at runtime and routes the highscore table through Convex
instead of `localStorage`, so every player on Vercel sees the same
shared leaderboard. On GitHub Pages and on `localhost` the original
per-browser `localStorage` flow is used.

### Required repository secrets (GitHub → Settings → Secrets → Actions)

| secret              | needed for | purpose |
|---------------------|------------|---------|
| `VERCEL_TOKEN`      | Vercel deploy  | Personal token from <https://vercel.com/account/tokens> |
| `VERCEL_ORG_ID`     | Vercel deploy  | `orgId` from `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | Vercel deploy  | `projectId` from the same file |
| `CONVEX_DEPLOY_KEY` | Convex deploy  | "Production deploy key" from the Convex dashboard |
| `CONVEX_URL`        | shared scores  | The `.convex.cloud` URL of the deployed Convex project |

If only the Vercel secrets are set, the site deploys to Vercel without
shared highscores (the frontend falls back to `localStorage`). If only
the Convex secret is set, the functions deploy but Vercel doesn't and
no frontend reads them. Setting all five lights up the full path.

### One-time Vercel setup

1. `npm install -g vercel` (or use `npx vercel` ad-hoc).
2. From the repo root: `vercel link`. Pick the team/project; it writes
   `.vercel/project.json` (gitignored). Copy `orgId` and `projectId`.
3. <https://vercel.com/account/tokens> → **Create Token** → copy.
4. In the GitHub repo: **Settings → Secrets and variables → Actions**
   → **New repository secret** for each of `VERCEL_TOKEN`,
   `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
5. Push to `main` (or run **Deploy to Vercel + Convex** from the
   Actions tab) — first deploy creates the Vercel project's URL
   (something like `https://slothlife.vercel.app`). The
   `vercel.json` in the repo root sets `Cache-Control: no-cache` for
   the HTML and `immutable, max-age=1y` for `/assets/*` so the
   cache-bust query strings cache cleanly.

### One-time Convex setup

1. `npm install` (pulls `convex` + `typescript` from `package.json`).
2. `npx convex login` (opens a browser).
3. `npx convex dev --once`  — creates a Convex project and writes its
   URL into `.env.local` as `CONVEX_URL`. Copy that value.
4. <https://dashboard.convex.dev> → your project → **Settings →
   Deploy Keys** → **Generate Production Deploy Key** → copy.
5. Add **GitHub Actions secrets**: `CONVEX_DEPLOY_KEY` (the deploy
   key) and `CONVEX_URL` (the `.convex.cloud` URL).
6. Push to `main`. The workflow will run `npx convex deploy` to push
   `convex/schema.ts` + `convex/highscores.ts`, then stamp
   `assets/backend-config.js` with `CONVEX_URL` so the Vercel-served
   frontend can reach it.

### Local Convex development

```bash
npm install
npx convex dev
```

This watches `convex/` and pushes function changes to a development
deployment. To run the frontend against your dev Convex from
`localhost`, edit `assets/backend-config.js` to set
`window.CONVEX_URL = 'https://YOUR-DEV.convex.cloud';` and load the
page from a hostname that includes `vercel` (or temporarily relax the
`_isVercelHosted()` check in `assets/main.js`).



## Credits

- Background music *Mossy Perch* generated with [suno.com][1].
- Snore sample sourced from Epidemic Sound.
- Thunder sample is a freely-licensed field recording.
- Everything else (engine, art, code) is original to this repo.

[1]: https://suno.com/
