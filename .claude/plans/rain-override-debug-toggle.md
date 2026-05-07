# Plan: lower icy rain threshold + dev-only RAIN OVERRIDE toggle

## Context

Two coupled changes:

1. **Icy branches should engage at lower rain levels.**
   `ICY_RAIN_THRESH` was `0.55`, meaning cold-rain icing only
   kicked in during heavy storms. User asked for the floor at
   `0.30` so a moderate storm in cold weather already starts
   icing branches.
2. **Dev-only manual rain control.** A debug-time override that
   takes the rain cycle off auto and lets the developer drive
   `rainIntensity` directly via a slider — useful for testing
   the new icing mechanic and anything else weather-driven
   without waiting for the random cycle.

The override is **dev-only**. When the override flag is OFF
(the default) nothing about the existing random rain cycle
changes — the slider just passively mirrors the live
`rainIntensity` so the dev can watch the auto cycle without
having to instrument the console.

## Existing pattern reused

The day/night `dayAuto` toggle (`main.js:1463`) is the exact
analogue: when `dayAuto === true`, the JS advances `dayTime`
each frame and writes back to the `s-time` slider DOM (slider
passively reflects); when `dayAuto === false`, the slider
drives `dayTime`. The new RAIN OVERRIDE follows the same shape
with the polarity inverted to match the user's wording
(override ON = manual).

The `rainMode` master on/off (`main.js:1473`) stays separate
and still wins (rainMode OFF → rain decays to 0 regardless of
override). RAIN OVERRIDE only has effect when `rainMode === true`.

## Changes

### 1. Lower the icy threshold

`assets/main.js`:

```diff
-const ICY_RAIN_THRESH = 0.55;
+const ICY_RAIN_THRESH = 0.30;
```

`ICY_COLD_THRESH` (winterness floor) stays at `0.30`, so cold
rain still has to be in cold-ish weather to ice anything —
summer rain is unaffected.

### 2. Override state + wiring

Module-scope state next to the `rainMode` block:

```js
let rainOverride      = false;
let rainOverrideValue = 0;
```

Toggle + slider DOM wiring mirrors the `dayAuto` block: click
flips `rainOverride`, slider `oninput` sets `rainOverrideValue`
+ value readout.

### 3. Branch in `updateRain(dt)`

```js
if(!rainMode){
  // existing decay-to-0
} else if(rainOverride){
  rainIntensity       = rainOverrideValue;
  rainTargetIntensity = rainOverrideValue;
  rainTimer           = 14 + Math.random() * 22;
  rainHasThunder      = false;
} else {
  // existing auto cycle
}
```

Resetting `rainTimer` + `rainHasThunder` in the override branch
means the auto cycle resumes fresh when the dev toggles
override OFF mid-test.

### 4. Mirror block after `updateRain(dt)` call

```js
if(!rainOverride){
  if(sRain){ sRain.value = rainIntensity.toFixed(2); }
  if(vRain){ vRain.textContent = rainIntensity.toFixed(2); }
  rainOverrideValue = rainIntensity;
}
```

The trailing `rainOverrideValue = rainIntensity` is the smooth-
pickup trick: when override OFF, the slider's intent stays in
lockstep with the live intensity, so flipping override ON
doesn't snap rain to a stale slider value.

### 5. New dev-only HTML rows in `index.html`

Two rows right under the existing `RAIN` master toggle:

- `<div class="ptog-row"><span class="pname">RAIN OVERRIDE</span> ...`
- `<div class="prow"><span class="pname">RAIN INTENSITY</span> ...`

Both inside the existing `.dev-only` block (`#panel:not(.locked) .dev-only{ display:none }`)
so they hide automatically in player mode.

## Critical files

- `/home/user/slothlife/assets/main.js`
  - `ICY_RAIN_THRESH` constant lowered.
  - New `rainOverride` / `rainOverrideValue` module-level state.
  - Toggle + slider wiring near the existing `tRain` handler.
  - `else if(rainOverride)` branch in `updateRain(dt)`.
  - Mirror block after the `updateRain(dt)` call site.
- `/home/user/slothlife/index.html`
  - Two new rows inside the dev-only RAIN section.

No CSS changes — reuses `.ptog-row`, `.prow`, `.pname`, `.tog`,
`.tlbl`, `.pval`, `.dev-only`.

## Verification

1. **Default play.** Override OFF, RAIN ON. Open dev mode →
   the RAIN INTENSITY slider passively ticks up during storms
   and decays during dry; the value readout tracks it.
2. **Engage override.** Toggle RAIN OVERRIDE → ON. Drag slider
   to 0.5 → rain visibly comes in to 0.5. Drag to 0 → rain
   stops. Drag to 1 → max rain.
3. **Disengage.** Toggle override → OFF. The auto cycle
   resumes from the current `rainIntensity`; the slider goes
   back to passively mirroring.
4. **Master RAIN toggle still wins.** Override ON + slider at
   0.8, click RAIN → OFF. Rain decays to 0 regardless;
   re-enable RAIN → rain comes back to 0.8.
5. **Lower icy threshold.** Set month to October
   (winterness ≈ 0.3-0.4) → toggle override ON → drag slider
   to 0.31. Within a frame, ~15 % of `b.depth >= 2` branches
   show the icy gradient. Drag slider to 0.29 → branches thaw
   on the next epoch flip.
6. **Player mode.** The new RAIN OVERRIDE toggle + slider are
   hidden.

## Out of scope

- Persisting `rainOverride` across page reloads — debug toggle,
  default OFF on every load is the right call.
- Driving `rainHasThunder` manually. Override only controls
  intensity; thunder still gates on the natural roll, which
  the override branch suppresses (rainHasThunder forced false).
- Showing the override state to the player — purely a dev tool.

## Shipped

- `6e7f0b2` — feat: lower icy rain threshold + dev-only
  RAIN OVERRIDE toggle. Both changes folded into one commit
  since the threshold drop is one line and the override
  feature touches the same `updateRain` function.
