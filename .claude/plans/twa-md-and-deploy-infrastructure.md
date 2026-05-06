# Plan: TWA.md + mise tasks + Containerfile + Helm chart

## Context

User asked for four artifacts in one turn:

1. `TWA.md` — outline the steps to build a TWA.
2. `mise.toml` — tasks to build TWA + serve the app via
   docker-compose.
3. A `Containerfile` to serve the app.
4. A Helm chart.

Reuse strategy: the repo already has a working
[`build-android.yml`](.github/workflows/build-android.yml) that
solves every Bubblewrap quirk (first-run wizard, SDK layout
fix, icon-URL race, build-time PTY trick). The local mise
task and TWA.md mirror its steps so the local + CI paths stay
in lockstep.

## Files added

```
.
├── Containerfile                       # multi-stage nginx serve image
├── deploy/
│   └── nginx.conf                      # cache headers + /healthz
├── docker-compose.yml                  # local serve target
├── .dockerignore                       # trim build context
├── helm/slothlife/
│   ├── Chart.yaml
│   ├── values.yaml
│   ├── .helmignore
│   └── templates/
│       ├── _helpers.tpl
│       ├── deployment.yaml
│       ├── service.yaml
│       └── ingress.yaml
├── mise.toml                           # serve + TWA tasks
└── TWA.md                              # build-a-TWA guide
```

## Notable decisions

### Containerfile

- **Multi-stage** so the image carries the icon set without
  any host prerequisites — stage 1 (`alpine:3.20` + `librsvg` +
  `imagemagick`) renders PNGs from `assets/favicon.svg`,
  stage 2 (`nginx:1.27-alpine`) is the actual serve.
- Same icon-render pipeline as the deploy-pages workflow so a
  Container build matches what Pages serves.
- Nginx listens on **80** (the conventional inside-container
  port) and is mapped to **8080** by docker-compose. Helm's
  service also targets 80.
- A small `deploy/nginx.conf` adds cache headers (long
  immutable cache for hashable assets, no-cache for
  `index.html` / `sw.js` / `manifest.json` / `/`) plus a
  `/healthz` endpoint for Helm probes and the docker-compose
  healthcheck.

### Helm chart

- Standard Bitnami-style layout (`Chart.yaml`, `values.yaml`,
  `templates/_helpers.tpl`, `deployment.yaml`, `service.yaml`,
  `ingress.yaml`).
- `image.tag` falls back to `.Chart.AppVersion` so a
  `helm install` without an explicit tag still produces a
  deterministic reference.
- Pod security: `runAsNonRoot: true`, drops all capabilities,
  uses the `nginx:alpine` user UID 101. `readOnlyRootFilesystem`
  defaults to `false` because nginx writes to `/var/cache/nginx`
  and `/var/run`; documented in `values.yaml` as a flip-able
  default.
- Probes target `/healthz` (the nginx config exposes it).
- Ingress is **disabled by default**; the `values.yaml` has
  the cert-manager + nginx-ingress annotation comments
  pre-filled for users who want to flip `ingress.enabled`.

### `mise.toml`

- `[tools]` declares `node = "20"` and `java = "temurin-17"`
  so a fresh checkout gets the exact versions the CI workflow
  uses. No system pollution.
- `[env]` sets the throwaway `BUBBLEWRAP_KEYSTORE_PASSWORD`
  and `BUBBLEWRAP_KEY_PASSWORD` to `android` — same defaults
  as `twa-manifest.json`'s `signingKey` block.
- Tasks split into two namespaces — `serve*` and `twa:*` —
  with descriptions so `mise tasks` is self-documenting.
- `twa:build` `depends = ["twa:icons", "twa:keystore"]` so a
  cold-start build runs them automatically. The keystore task
  is idempotent (refuses to clobber an existing keystore).
- The build task spins up the same local HTTP icon server +
  sed-rewrite trick the CI workflow uses, so a local build
  doesn't 404 against the deployed Pages site if the icons
  haven't shipped yet.
- `npx --no-install bubblewrap` runs the local devDependency
  rather than installing globally, keeping the user's system
  clean.

### `TWA.md`

- Two paths front-and-centre: CI workflow (one click) vs
  local mise-driven build (for iteration).
- Prerequisites table with version pins matching the CI
  workflow.
- Step-by-step that maps each step to a single
  `mise run <task>` invocation.
- Production-signing section with the keystore replacement
  recipe and a pointer to the
  [Verify Android App Links] flow.
- Manifest-fields table showing which TWA-manifest fields
  are baked into the APK vs fetch-time only — saves anyone
  asking "do I need to rebuild if I change X?".

## Verification

1. **Container serves the app.** `mise run serve:docker` →
   `curl http://localhost:8080/` returns `index.html`,
   `curl /healthz` returns `ok`, `curl /sw.js` returns the
   service worker with `Cache-Control: no-cache`.
2. **Helm chart lints.** `helm lint helm/slothlife/` returns
   `0 chart(s) failed`. `helm template helm/slothlife/`
   produces well-formed YAML for Deployment, Service, Ingress
   (when `ingress.enabled=true`).
3. **mise tasks discoverable.** `mise tasks` lists `serve`,
   `serve:docker`, `serve:docker:stop`, `twa:icons`,
   `twa:keystore`, `twa:sha256`, `twa:build`, `twa:clean`.
4. **`twa:build` parity.** A local
   `mise run twa:build` produces an APK with the same
   `packageId` / `signingKey` SHA-256 as the CI run.
5. **TWA.md links resolve.** Internal links to `mise.toml`,
   `.github/workflows/build-android.yml`, etc point at real
   files.

## Out of scope

- Pushing the Container image anywhere. The Helm chart
  references `ghcr.io/blurayne/slothlife` as the default
  image origin, but no GHA workflow is added to push it.
  Easy follow-up if/when the user wants Container Registry
  publishing.
- HPA template. Keeping the chart minimal; users can flip
  `autoscaling.enabled` later and add a manual HPA template
  if needed.
- Production-grade keystore handling. The mise task and CI
  workflow both use a throwaway debug keystore; documented
  the swap recipe in TWA.md.
- Container CSP. Documented in `deploy/nginx.conf` why one
  isn't shipped — the runtime convex.cloud origin is
  per-deploy and a baked-in CSP would break the optional
  Convex backend.

## Shipped

- `7b41bad` — feat(deploy): Containerfile + docker-compose for
  serving the static app (multi-stage build, nginx.conf,
  /healthz, .dockerignore).
- `2551385` — feat(deploy): Helm chart for serving slothlife
  on Kubernetes (Chart.yaml, values.yaml, _helpers.tpl,
  deployment + service + ingress templates).
- `fa53866` — feat(tooling): mise.toml with serve + TWA build
  tasks (serve / serve:docker / twa:icons / twa:keystore /
  twa:sha256 / twa:build / twa:clean).
- `<this commit>` — docs: TWA.md (build-a-TWA guide) + PLAN.md
  bookkeeping.
