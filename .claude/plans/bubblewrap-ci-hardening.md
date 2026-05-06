# Plan: bubblewrap CI hardening — make the Android workflow non-interactive

## Context

`build-android.yml` was failing with `exit code 130` (SIGINT) on
every run because every bubblewrap CLI command tripped a chain of
interactive prompts: a first-run wizard, a missing-checksum
prompt, a 5-stage init Q&A, and signing-key questions. None of
those are documented as bypass-able by env-var or CLI flag —
upstream issues #172, #243, #806 all sit open without a maintainer
answer.

The fix is a research-driven sequence of small commits, each
clearing one specific gate. Verified everything against
`@bubblewrap/cli` source on main rather than guessing.

## Changes (in order shipped)

### 1. `7c09b73` — pre-write `~/.bubblewrap/config.json`

First-run wizard ("Do you want Bubblewrap to install the JDK?
(Y/n)"). From `packages/cli/src/lib/config.ts`:

```ts
if (!config.jdkPath)        { …prompt… }
if (!config.androidSdkPath) { …prompt… }
```

Wizard fires only when the fields are falsy. Pre-write the JSON
with `printf` (single-line, no heredoc indent risk), pointing at
`$JAVA_HOME` (set by setup-java) + `$ANDROID_HOME` (pre-installed
at `/usr/local/lib/android/sdk`). Validate the file parses with
`python3 json.load`.

### 2. `f43fa49` — symlink `cmdline-tools/<v>` → `tools`

Next gate: `cli ERROR The provided androidSdk isn't correct.`
From `packages/core/src/lib/androidSdk/AndroidSdkTools.ts`:

```ts
if (!fs.existsSync(sdkPath) ||
    (!fs.existsSync(toolsPath)) && !fs.existsSync(binPath)) {
  return Result.error(...'PathIsNotCorrect');
}
```

Validator wants `$ANDROID_HOME/tools/` or `$ANDROID_HOME/bin/`.
Runner image puts cmdline-tools at `$ANDROID_HOME/cmdline-tools/
<version>/`. Auto-detect the version subdir and symlink it to
`tools`.

### 3. `12f2731` — drop `|| true` + auto-confirm build prompts

`bubblewrap build` raises a stale-checksum prompt
("regenerate?") if `manifest-checksum.json` is missing. Build
prompts use `inquirer` which reads `/dev/tty`, not stdin. Working
pattern from `sharadcodes/pwa-to-apk-action`:

```bash
yes y | script -qec "bubblewrap build --skipPwaValidation" /dev/null
```

`script(1)` provides the PTY inquirer insists on; `yes y` answers
any confirm. Also dropped the `|| true` masking init failures.

### 4. `24339df` — wrap init in PTY with empty-line answers

`bubblewrap init --manifest=URL` walks a 5-stage wizard (Web app
details / app name / colors / icons / signing key) even with the
URL pre-filling defaults. No `--non-interactive` flag exists.

```bash
yes "" | script -qec "bubblewrap init …" /dev/null
```

`yes ""` (empty lines, not `y`) so text inputs accept defaults
rather than getting set to literal `"y"`.

### 5. `349e82f` — swap init for update entirely

Cleaner: the repo has a complete `twa-manifest.json` checked in,
so init is redundant. From `packages/cli/src/lib/cmds/shared.ts`:

* `generateTwaProject` — zero inquirer prompts.
* `updateProject` — one prompt (`promptNewAppVersionName`),
  gated on `--skipVersionUpgrade`.

So `bubblewrap update --skipVersionUpgrade` runs fully non-
interactively, regenerates the Gradle scaffolding from
`twa-manifest.json`, and writes `manifest-checksum.json`. Three
lines of bash where five used to be.

### 6. `d4c63d0` + `1962bf3` — local HTTP server for icon fetch

`update` fetches `iconUrl` + `maskableIconUrl` from
`twa-manifest.json` to bake bitmaps into the APK. Those URLs
point at the deployed Pages site and 404 on a fresh push (Pages
deploy hasn't completed yet). Workaround:

* Spin up `python3 -m http.server 8765 --bind 127.0.0.1` in the
  background, served from the repo root.
* Sanity-check the icons resolve.
* `sed -i` rewrite the two icon URLs to localhost.
* `bubblewrap update` fetches from localhost, bakes bitmaps in.
* `1962bf3` replaced an earlier python heredoc rewrite with `sed`
  + before/after grep + `::error` guards because the heredoc was
  silently no-op'ing on a YAML-indent quirk.

### Workflow-wide hardening (`d1d33d7`)

* Workflow env: `CI=true`, `DEBIAN_FRONTEND=noninteractive`,
  `BUBBLEWRAP_KEYSTORE_PASSWORD=android`,
  `BUBBLEWRAP_KEY_PASSWORD=android`.
* Job timeout: 30 min. Per-step timeouts on the bubblewrap
  steps (10 min for init/update, 15 min for build).
* `keytool -genkeypair` gets `-noprompt` and uses the env
  passwords instead of literals.

### Same hardening on `deploy-pages.yml` (`d1d33d7`)

`DEBIAN_FRONTEND=noninteractive` workflow env so the
`apt-get install` in the icon-render step never blocks on a
postinst prompt.

## Critical files

- `.github/workflows/build-android.yml` — every change.
- `.github/workflows/deploy-pages.yml` — single env addition.

## Verification

After a successful `workflow_dispatch`:

1. Each step's log shows zero `(Y/n)` prompts and zero exit-130s.
2. **Generate TWA project** step prints
   `--- twa-manifest.json (icon URLs AFTER patch) ---` showing
   the two URLs rewritten to `http://127.0.0.1:8765/icons/…`,
   then `manifest-checksum.json` listed by the trailing `ls -la`.
3. **Build TWA** step ends with "BUILD SUCCESSFUL".
4. **Upload artifacts** uploads the `.apk` + `.aab`.

## Shipped

- `7c09b73` — pre-write config (first-run wizard fix).
- `d1d33d7` — DEBIAN_FRONTEND + keystore env + step timeouts.
- `f0ae28c` — printf-pipe attempt #1 (superseded).
- `28547f5` — script(1) PTY wrap (superseded).
- `3857760` — drop bare bubblewrap --version (superseded).
- `e57508a` — pre-write config v2 (canonical).
- `f43fa49` — symlink cmdline-tools → tools.
- `12f2731` — drop `|| true`, PTY-wrap build with `yes y`.
- `24339df` — PTY-wrap init with `yes ""` (superseded by 349e82f).
- `349e82f` — swap init for update.
- `d4c63d0` — local HTTP server for icon fetch (superseded by 1962bf3).
- `1962bf3` — sed-based icon URL rewrite + verify.
