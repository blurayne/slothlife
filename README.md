# A Sloth's Life

[![Deploy to GitHub Pages](https://github.com/blurayne/slothlife/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/blurayne/slothlife/actions/workflows/deploy-pages.yml)
[![Deploy to Vercel + Convex](https://github.com/blurayne/slothlife/actions/workflows/deploy-vercel.yml/badge.svg)](https://github.com/blurayne/slothlife/actions/workflows/deploy-vercel.yml)

> ▶ **Play it now**
> - GitHub Pages: <https://blurayne.github.io/slothlife/> *(per-browser highscores)*
> - Vercel:       <https://slothlife.vercel.app/> *(shared Convex highscores)*

A tiny browser game: guide a sloth through a windswept tree, swing
between branches, eat leaves and apples, sleep through the lean
hours, and try not to starve or fall.

## How to play

- **Tap a branch** to swing the sloth toward it.
- **Tap an apple** for **+15 pts**, **tap a leaf** for **+1 pt**.
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

### Required environment secrets — `vercel-convex` GitHub Actions environment

The Vercel + Convex workflow runs against a single GitHub Actions
**environment** named `vercel-convex`. Create it once under
**Settings → Environments → New environment → `vercel-convex`**, then
add the secrets below to that environment (not as repository-level
secrets) so they only ever surface in jobs targeting this environment:

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

The environment is **only** used by `.github/workflows/deploy-vercel.yml`;
the GitHub Pages workflow has no environment binding and stays
unaffected if `vercel-convex` is empty or missing entirely.

### One-time Vercel setup

1. **Import the project on vercel.com** (Add New… → Project → pick
   the GitHub repo). On the import screen use these settings — the
   site is plain static HTML with no build step:

   | field                  | value                                  |
   |------------------------|----------------------------------------|
   | **Framework Preset**   | `Other` (sometimes labelled `None` / `Static`) |
   | **Root Directory**     | leave default (`./`)                   |
   | **Build Command**      | leave empty / "Override" off           |
   | **Output Directory**   | leave empty / "Override" off (Vercel serves from the root) |
   | **Install Command**    | leave default (Vercel runs `npm install`; the deps are dev-only for Convex tooling) |

   Headers + caching come from `vercel.json` — nothing to configure
   in the dashboard for those.

   After import, on the project's **Settings → Git** page, decide
   whether to leave Vercel's own auto-deploy on or disable it. If
   you keep both Vercel auto-deploy AND the GitHub Actions workflow
   below, you'll get two production deploys per push (harmless, but
   noisy). The Actions workflow is the one you want feeding
   production because it also runs `convex deploy` and stamps
   `version.js` / `backend-config.js` with the SHA + Convex URL —
   Vercel's built-in deploy can't do those steps.

2. **Set up the GitHub Actions credentials** so the workflow can
   push to Vercel.

   **a. Generate the API token.** <https://vercel.com/account/tokens>
   → **Create Token** → name it (e.g. `slothlife-ci`) → set scope
   to the right team if you have multiple → copy the value. This is
   `VERCEL_TOKEN`.

   **b. Get `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`.** Two equivalent
   ways — pick one:

   - **Via the CLI** (recommended; one command, no clicking):
     ```bash
     npm install -g vercel        # or use npx vercel ad-hoc
     npx vercel login             # opens a browser, links the CLI
     npx vercel link              # pick the team/scope, then the
                                  # project you imported in step 1
     cat .vercel/project.json
     ```
     The output looks like:
     ```json
     {
       "orgId":     "team_XXXXXXXXXXXXXXXX",
       "projectId": "prj_XXXXXXXXXXXXXXXX"
     }
     ```
     `.vercel/` is already in `.gitignore`, so it stays out of the repo.

   - **Via the dashboard** (no CLI):
     `VERCEL_ORG_ID` is your account's **Team ID** (or **Your ID** for
     a personal account). Open <https://vercel.com/dashboard>, click
     the team/account name in the top-left, then **Settings → General
     → Team ID** (or **Your ID**). Copy that string.
     `VERCEL_PROJECT_ID` lives on the project's **Settings → General
     → Project ID** page.

   **c. Paste each value into the `vercel-convex` environment.** In
   the GitHub repo: **Settings → Environments → `vercel-convex`**
   (create it if it doesn't exist) → **Add environment secret** for
   each of `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

3. Push to `main` (or run **Deploy to Vercel + Convex** from the
   Actions tab). The first deploy publishes the Vercel project's
   URL (e.g. `https://slothlife.vercel.app`). The `vercel.json` in
   the repo root sets `Cache-Control: no-cache` for the HTML and
   `immutable, max-age=1y` for `/assets/*` so the cache-bust query
   strings cache cleanly.

### One-time Convex setup

1. `npm install` (pulls `convex` + `typescript` from `package.json`).
2. `npx convex login` (opens a browser).
3. `npx convex dev --once`  — creates a Convex project and writes its
   URL into `.env.local` as `CONVEX_URL`. Copy that value.
4. <https://dashboard.convex.dev> → your project → **Settings →
   Deploy Keys** → **Generate Production Deploy Key** → copy.
5. Add **environment secrets** to the same `vercel-convex`
   environment from the Vercel section: `CONVEX_DEPLOY_KEY` (the
   deploy key) and `CONVEX_URL` (the `.convex.cloud` URL).
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
