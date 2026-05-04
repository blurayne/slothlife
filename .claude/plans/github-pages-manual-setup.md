# GitHub Pages — manual one-time setup

## Context

The repo already has the code side of GitHub Pages deployment fully
wired (`.github/workflows/deploy-pages.yml`), but a few settings on the
GitHub repo itself can only be flipped through the web UI or via API
calls that need a personal token. They have to be done once, by a
maintainer with admin rights, before pushes to `main` will actually
publish to https://blurayne.github.io/slothlife/.

The Claude Code session has no tools that can change these settings
remotely (the GitHub MCP exposes branches/PRs/files/issues/etc. but not
`PATCH /repos/{owner}/{repo}`, `POST /repos/{owner}/{repo}/pages`, or
the environments API), so this plan stays open until the maintainer
acts on it.

## Open items

Each is one of the three settings the repo has bumped into so far.

### 1. Set Pages source to "GitHub Actions"

- **URL:** https://github.com/blurayne/slothlife/settings/pages
- **What:** Build and deployment → Source → **GitHub Actions**
- **Why:** Without this, `actions/deploy-pages` runs but the site is
  not actually served.
- **API alternative** (token with `pages` + `repo` scopes):
  ```bash
  curl -X POST -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/repos/blurayne/slothlife/pages \
    -d '{"build_type":"workflow"}'
  ```

### 2. Make `main` the default branch

- **URL:** https://github.com/blurayne/slothlife/settings/branches
- **What:** Default branch → click ⇄ → choose **main** → Update.
- **Why:** Cosmetic + lines the repo's idea of canonical with the
  `push: branches: [main]` workflow trigger.
- **API alternative:**
  ```bash
  curl -X PATCH -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/repos/blurayne/slothlife \
    -d '{"default_branch":"main"}'
  ```

### 3. Allow `main` in the `github-pages` environment

- **URL:** https://github.com/blurayne/slothlife/settings/environments
  → click `github-pages`
- **What:** Deployment branches and tags → switch to **All branches**
  *or* keep "Selected" and add a rule for `main`.
- **Why:** GitHub auto-creates this environment with branch protection.
  Until `main` is allowed, the deploy job fails with
  *"Branch 'main' is not allowed to deploy to github-pages due to
  environment protection rules."*

## Verification

After all three are flipped:

1. Re-run the latest workflow run from the **Actions** tab (or push
   any small commit to `main`).
2. The job ends green and prints a `page_url` like
   `https://blurayne.github.io/slothlife/`.
3. Visiting that URL loads the game; DevTools → Network shows the four
   soundtrack mp3s lazy-loaded on first need.
4. The README's deploy badge flips to green.

Tick `PLAN.md` once the badge is green and the site loads.
