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
  (January-February — the existing winter band).
- **Cold rain:** `rainIntensity > 0.55` **and**
  `getSeasonInfo(seasonTime).winterness > 0.3` (heavy storm in
  cold-ish weather; same `rainIntensity` threshold the existing
  thunder gating uses at `main.js:5117`).

Outside both, branches thaw — every `b.icy` flips back to
`false` on the next epoch transition.

## Per-branch icing probability

Each `Branch` carries `icy` and `icyEpoch` fields (default
`false` / `-1`). A new module-level helper
`_updateBranchIcing()` runs once per frame from the main
update loop, alongside `_updateSeasonLeaves` and
`_updateSeasonApples`. It tracks the freeze state in two
module-level vars (`_icyFreezeMode`, `_icyFreezeEpoch`) and
only walks `allBranches()` when the mode transitions —
zero-cost in steady state.

When a transition happens:

- `mode === 'winter'` → 30 % per branch (`ICY_PROB_WINTER`).
- `mode === 'cold-rain'` → 15 % per branch (`ICY_PROB_RAIN`).
- `mode === 'none'` → all branches flipped to `icy = false`.

Only `b.depth >= 2` branches participate; the trunk + primary
forks stay clean (same depth gate as the apple system).

`buildTree()` resets `_icyFreezeMode = 'pending-rebuild'` after
a tree regen so newly-spawned branches get rolled on the next
update tick (otherwise they'd inherit `icy=false` and stay
ice-free until the next natural transition).

## Slip mechanic

Inside `Sloth._updateBodyPhysics()`, after the constraint loop
finishes, every gripped limb on an icy branch gets a per-frame
`+ICY_SLIP_RATE * dt` nudge to its `t`. When `limb.t >= 1.0`,
the limb releases (`gripped = false`, `branch = null`). The
existing `nGrip === 0 → _beginFall()` path at the top of the
same function handles the all-four-limbs-released case — no
extra fall code needed.

Slip only fires while `state === 'HANGING'` so:

- Sleeping on an icy branch shows the gradient but doesn't
  slip (sleep is the survival lever — slipping unwarned would
  feel cheap).
- Reach / windup / transition / eat animations need stable
  grip points for IK, so they're skipped too.
- Already-falling sloth obviously doesn't slip further.

`ICY_SLIP_RATE = 0.025` puts a limb gripped at `t = 0.5`
~20 seconds from slipping past the tip — plenty of time to
swing away.

## Visual

In `Branch.draw()`, after the main `ctx.stroke()`, draw a
second pass with a vertical `createLinearGradient` running
from above the branch's bounding box to below it:

- top stop @ alpha 0.75 — `rgba(200, 230, 250, 0.75)`
- mid stop @ 0.4 — alpha 0.30
- bottom stop @ 1.0 — alpha 0

Reuses `this.sx/sy/p1x/p1y/p2x/p2y/ex/ey` already computed
each frame in `Branch.update()`. The round-cap stroke picks up
the high-alpha top of the gradient on its upper edge, fading
to invisible on the lower edge — reads as frost on the top of
the branch, not a uniform paint job.

## Tuning knobs

All at module-level near the existing hunger / kill-hold
constants:

```js
const ICY_PROB_WINTER = 0.30;
const ICY_PROB_RAIN   = 0.15;
const ICY_RAIN_THRESH = 0.55;
const ICY_COLD_THRESH = 0.30;
const ICY_SLIP_RATE   = 0.025;
```

Drop `ICY_SLIP_RATE` to 0.015 if too punishing in playtesting
(33 s slip from t=0.5); bump to 0.05 if not threatening
enough (10 s).

## Critical files

- `/home/user/slothlife/assets/main.js`
  - 5 new `ICY_*` constants near the hunger constants.
  - `Branch` constructor: `this.icy = false; this.icyEpoch = -1;`
  - `Branch.draw()`: icy-overlay pass after the existing
    `ctx.stroke()`.
  - `Sloth._updateBodyPhysics()`: slip loop after the
    constraint loop, inside the `HANGING` state guard.
  - **New:** `_updateBranchIcing()` helper sibling of
    `_updateSeasonApples` / `_updateSeasonLeaves`, called
    from the main update loop.
  - `buildTree()`: nudges `_icyFreezeMode` to force a re-roll
    on tree regen.
- `IDEAS.md` — entry removed (now planned + shipped).
- `PLAN.md` — new "Shipped this batch" checkbox entry.

No CSS / HTML changes.

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
   `info.winterness === 0`. **No** branches ice over (the
   AND guard fails).
4. **Thaw:** Step `seasonTime` from January into March → on
   the next frame after the trigger condition flips false,
   every `b.icy` flips back to `false`; the icy gradient
   disappears.
5. **Sleep on an icy branch:** sloth in SLEEPING state shows
   the gradient but does NOT slip. Wake → enters HANGING →
   slip resumes.
6. **Tree regen mid-freeze:** Adjust the depth slider during
   January → the new branches roll their `.icy` flag on the
   next update tick (the `pending-rebuild` mode forces a
   re-roll).

## Out of scope

- Audio cue for icing onset / slip. A faint creak or drip
  would sell the moment but a new MP3 sample is a separate
  ship.
- Ice-cracking animation when the limb releases past the tip.
  The existing release-and-fall path is dramatic enough.
- Differential slip rate by branch slope (steeper branches
  slipping faster). Constant rate keeps the per-frame math
  trivial.
- Persistent ice that survives a freeze→thaw→freeze cycle on
  the same branches. Re-rolling each cycle keeps the system
  stateless beyond the boolean.
- Sun-melt timing (warm midday in winter thaws ice, refreezes
  at night). The trigger conditions can extend to read
  `sun.opacity` later if needed.

## Shipped

- (commit follows).
