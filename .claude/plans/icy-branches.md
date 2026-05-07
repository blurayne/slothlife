# Plan: Icy branches in winter and cold rain

## Context

Promote the IDEAS.md "Icy branches in winter" entry to a real
feature. User extended the original spec: trigger should also
fire during rainy scenes (winter rain, cold late-autumn /
early-spring rain). Adds genuine seasonal + weather pressure
to currently visual-only states.

The mechanic: a per-branch `icy` flag, rolled when conditions
warrant, that causes any gripped limb on that branch to drift
toward the tip. Slipping past the tip releases that limb;
losing all four limbs triggers the existing fall path. Visually
a cool-blue gradient hugs the branch's upper edge.

## Trigger conditions

A "freeze" cycle is active when EITHER:

- **Calendar-cold:** `getSeasonInfo(seasonTime).day < 2`
  (January-February — the existing winter band, `main.js:4912`).
- **Cold rain:** `rainIntensity > 0.55` **and**
  `getSeasonInfo(seasonTime).winterness > 0.3` (heavy storm in
  cold-ish weather; same `rainIntensity` threshold the existing
  thunder gating uses at `main.js:5117`).

Outside both, branches thaw — the flag is cleared.

## Per-branch icing probability

Each branch carries an `.icy` flag (default `false`). At the
start of every freeze cycle, walk all branches and roll:

- **Jan-Feb deep winter** (`info.winterness >= 0.7`): ~30 % chance.
- **Cold rain** (rain trigger only): ~15 % chance.
- Bias toward **deeper branches** (`b.depth >= 2`); skip the trunk.

State stored on `Branch`:

```js
b.icy        = false;          // set on freeze, cleared on thaw
b.icyEpoch   = -1;             // generation counter — guards re-rolls
```

A new helper `_updateBranchIcing(dt)` runs once per frame from
the main update loop. It compares the current freeze-state to
`b.icyEpoch`; when the epoch changes (freeze begins or ends),
it re-rolls every branch's `.icy`. Costs one walk over
`allBranches()` per state-change, ~zero cost steady-state.

## Slip mechanic

Inside `Sloth._updateBodyPhysics()` (`main.js:2761`), after the
constraint loop at line 2806, iterate every limb that's
currently gripped and apply slip:

```js
const SLIP_RATE = 0.025;  // per second; t goes 0..1 across the branch
for(const limb of this.limbs){
  if(!limb.gripped || !limb.branch || !limb.branch.icy) continue;
  limb.t += SLIP_RATE * dt;
  if(limb.t >= 1.0){
    limb.gripped = false;
    limb.branch  = null;
    // _updateBodyPhysics:2762-2763 sees nGrip drop and triggers
    // _beginFall() when nGrip reaches 0 — no extra fall code needed.
  }
}
```

`SLIP_RATE = 0.025` puts a limb gripped at `t = 0.5` 20 seconds
from slipping past the tip. Plenty of time to swing away. The
existing fall path (`nGrip === 0` → `_beginFall()`) handles the
all-four-limbs-released terminal case.

Slip only applies in `state === 'HANGING'`. Other states
(WINDUP, REACHING, EATING, SLEEPING, STARVING, FALLING,
TRANSITION) skip the slip pass — sleeping on an icy branch
shouldn't slip you to your death without warning, and reach
animations need stable grip points.

## Visual — icy-blue gradient on the upper edge

In `Branch.draw()` (`main.js:1749`), after the main
`ctx.stroke()` at line 1791, draw a second pass:

```js
if(this.icy){
  const minY = Math.min(sy, ey, p1y, p2y) - this.thick;
  const maxY = Math.max(sy, ey, p1y, p2y) + this.thick;
  const grad = ctx.createLinearGradient(0, minY, 0, maxY);
  grad.addColorStop(0,    'rgba(200, 230, 250, 0.75)');
  grad.addColorStop(0.4,  'rgba(200, 230, 250, 0.30)');
  grad.addColorStop(1,    'rgba(200, 230, 250, 0)');
  ctx.strokeStyle = grad;
  ctx.lineWidth   = Math.max(this.thick, 0.5);
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.bezierCurveTo(p1x, p1y, p2x, p2y, ex, ey);
  ctx.stroke();
}
```

Vertical linear gradient (canvas-y) from above the branch's
bounding box to below it. The upper edge of the stroke picks
up the higher-alpha icy-blue stop; the lower edge fades to
transparent. Result reads as frost on the top of the branch,
not a uniform paint job. Reuses the `sx/sy/p1x/p1y/p2x/p2y/ex/ey`
already computed in `Branch.update()` (`main.js:1735-1741`).

## Critical files

- `/home/user/slothlife/assets/main.js`
  - `Branch` constructor (search for `this.spring` near the top
    of the class) — add `b.icy = false; b.icyEpoch = -1;`
  - `Branch.draw()` at `:1749` — append the icy-overlay pass
    after `ctx.stroke()` at `:1791`.
  - `Sloth._updateBodyPhysics()` at `:2761` — append the slip
    pass after the constraint loop at `:2806`.
  - **New:** `_updateBranchIcing(dt)` helper, sibling of
    `_updateSeasonApples(dt)` / `_updateSeasonLeaves(dt)` at
    `:4142` / `:4256`. Called from the main update loop where
    those existing helpers are called.
- `IDEAS.md` — remove the "Icy branches in winter" entry from
  the Weather & hazards section (it's now planned).
- `PLAN.md` — add a checkbox entry pointing at the .claude/plans
  detail file (this one, to be renamed under
  `.claude/plans/icy-branches.md` for the actual ship).

No CSS changes — the icy effect is canvas-drawn.

## Verification

1. **Calendar freeze (Jan-Feb):** Force `seasonTime` so
   `info.day < 1`. About 30 % of `b.depth >= 2` branches show
   the icy upper-edge gradient. Sloth hangs on an icy branch
   → drifts toward the tip → slips off after ~20 s, falls.
   Mid-slip, tap a clean branch → swing succeeds, slip ends
   (limb.t reset on grip).
2. **Cold rain (autumn/spring storm):** Force
   `rainIntensity > 0.6` and `info.winterness > 0.4`. About
   15 % of deep branches ice over; same slip behaviour.
3. **Summer rain:** Force `rainIntensity > 0.6` with
   `info.winterness === 0`. **No** branches ice over.
4. **Thaw:** Step `seasonTime` from January into March → on
   the next frame after the trigger condition flips false,
   all `b.icy` flip back to false; the icy gradient disappears.
5. **Sleep on an icy branch:** sloth in SLEEPING state shows
   the gradient but does NOT slip. Wake → enters HANGING →
   slip resumes.

## Tuning knobs

Pulled to module-level constants for easy adjustment:

```js
const ICY_PROB_WINTER  = 0.30;
const ICY_PROB_RAIN    = 0.15;
const ICY_RAIN_THRESH  = 0.55;   // rainIntensity to trigger
const ICY_COLD_THRESH  = 0.30;   // winterness for cold rain
const ICY_SLIP_RATE    = 0.025;  // limb.t per second
```

If the slip ends up too punishing in playtesting, drop
`ICY_SLIP_RATE` to 0.015 (33 s slip from t=0.5). If not
threatening enough, bump to 0.05 (10 s).

## Out of scope

- Audio cue for icing onset / slip. A faint creak / drip would
  sell the moment but a new MP3 sample is a separate ship.
- Ice-cracking animation when the limb releases past the tip.
  The existing release-and-fall path is dramatic enough; visual
  flourish can come later.
- Differential slip rate by branch slope (steeper branches
  slipping faster). Constant rate keeps the per-frame math
  trivial; can revisit if playtesting feels off.
- Persistent ice that survives a freeze→thaw→freeze cycle on
  the same branches. Re-rolling each cycle keeps the system
  stateless beyond the boolean.
- Sun-melt timing (warm midday in winter thaws ice, refreezes
  at night). The trigger conditions can be extended to include
  `sun.opacity` later if needed.

## Follow-up: cold-rain trigger removed

User decided that rain alone shouldn't freeze branches.
The `inColdRain` branch in `_updateBranchIcing()`, plus
`ICY_PROB_RAIN`, `ICY_RAIN_THRESH`, and `ICY_COLD_THRESH`
constants, were removed. The `'cold-rain'` mode value is
gone from `_icyFreezeMode`. Icing now only fires in:

- **Calendar-cold (Jan-Feb)** — `info.day < 2`, the natural
  trigger.
- **Dev FORCE ICY toggle** — debug-only override at
  `ICY_PROB_FORCE = 0.90`.

The slip mechanic, render overlay, and tuning constants
(`ICY_PROB_WINTER`, `ICY_SLIP_RATE`) all stay. The render-
loop fix from `116f995` (don't null `limb.branch` on slip;
pin `limb.t = 1.0`) also stays.

## Shipped

- `cfd6fd8` — feat: icy branches in Jan-Feb and during cold
  rain. Five `ICY_*` tuning constants near the hunger
  constants, `Branch.icy/icyEpoch` fields on the constructor,
  `_updateBranchIcing()` helper wired into the main update
  loop alongside `_updateSeasonLeaves`/`_updateSeasonApples`,
  slip loop in `Sloth._updateBodyPhysics()` gated on
  `state === 'HANGING'`, second-pass icy-blue gradient stroke
  in `Branch.draw()` after the main stroke, and a
  `_icyFreezeMode = 'pending-rebuild'` nudge in `buildTree()`
  so a tree regenerated mid-freeze gets its new branches
  rolled on the next update tick.
