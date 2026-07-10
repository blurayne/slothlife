# Performance pass + lighting/rendering upgrade (tree & sloth)

## Context

Profiling (headless Chromium, software raster, 1280×800) showed the game
averaging ~80–94 ms/frame across scenarios (noon, storm, sunset, summer,
autumn wind, night). The frame loop does large amounts of redundant
per-frame work, and the tree/sloth lighting had a few gaps (no
directional light at night, canopy leaves ignore the sun-shade system,
bark stripes re-randomise every frame and shimmer).

### Measured hot spots

- `Wind.sample(m)` runs 3 fBm evaluations (8 perlin octaves) per call and
  its result is **linear in `m`** — yet it's called once per branch per
  physics tick (~300×/frame) plus grass/rain/cloud/particle call sites.
- `getSeasonInfo(seasonTime)` allocates a fresh info object and is called
  per branch in `Branch.draw()` + `_drawLeaves()` (~500×/frame).
- `allBranches()` flattens the whole tree into a new array every frame
  during spring/autumn (`_updateSeasonLeaves`) and summer
  (`_updateSeasonApples`).
- Leaf drawing: `save/translate/rotate/restore` per leaf plus a fresh
  `rgba(...)` fillStyle string per leaf per frame.
- Branch drawing: 3× `Math.round` + template string per branch per frame.
- Clouds: 7 clouds × 3 passes × 4 puffs = 84 ellipse rasterisations and
  21 fillStyle strings per frame.
- `drawSummerSunRays`: 12 identical radial gradients rebuilt per frame.
- Sky/haze/ground gradients rebuilt per frame even when colours are
  unchanged.
- Stars: 90 fillStyle strings + 90 separate fills per frame.
- Sloth `_drawBody`: ~8 radial gradients rebuilt per frame.
- DOM writes every frame: TIME/MONTH/RAIN slider mirrors + wind meter
  width, even with the panel closed.
- `fruits` filtered twice per frame (identical predicates) allocating two
  arrays.
- Bark stripes call `Math.random()` per stripe per frame (also a visual
  bug: the bark shimmers).

## Changes

### Performance

1. **Wind cache** — compute the fBm base once per `Wind.tick()`; `sample(m)`
   returns `base·m`. Cache `Wind.str` per tick too. (Numerically identical.)
2. **Season cache** — compute `getSeasonInfo(seasonTime)` once per frame
   into a module global `SEASON`; hot paths read the cache.
3. **Branch list cache** — `allBranches()` memoises its flat list;
   `buildTree()` invalidates.
4. **Leaf draw** — use the `ellipse()` rotation parameter instead of
   save/translate/rotate/restore; cache per-leaf colour strings keyed by
   quantised autumn tint; canopy-level sun tint computed once per branch.
5. **Colour-string cache** — shared `rgbStr(r,g,b)`/`rgbaStr` memo used by
   branch + leaf + star hot paths.
6. **Cloud sprites** — each cloud pre-rendered to an offscreen sprite,
   re-rendered only when the (quantised) day/rain palette changes; per
   frame it's 7 `drawImage` calls instead of 84 ellipse fills.
7. **Sun rays** — build the radial gradient once, reuse for all 12 rays.
8. **Sky/ground/haze gradient cache** — keyed by quantised colours;
   rebuilt only when the palette actually changes.
9. **Star batching** — group stars into a few alpha buckets, one
   `fill()` per bucket.
10. **Sloth body gradients** — `_drawBody` translates to local space and
    caches its radial gradients (invalidated when the belly-scale bucket
    changes).
11. **DOM throttle** — slider mirrors only touch the DOM while the panel
    is open and at ~7 Hz; wind meter width only on 1% change; TIME LEFT
    label at 4 Hz.
12. **Misc** — single-pass fruit/leaf filtering only when something died;
    deterministic per-stripe bark offsets (kills the per-frame
    `Math.random()` and the shimmer).

### Lighting & rendering

1. **Moonlight** — the directional light source now falls back to the
   moon at night: `_sunBias` picks up a (weaker) moon bias and a new
   `_lightCool` factor lerps the highlight colour from warm sunlight
   (235,200,140) to cool moonlight (165,190,235) for branches, trunk and
   sloth. `drawSunShade` gets a matching cool soft-light pass at night.
2. **Canopy lighting** — leaves finally participate in the sun-shade
   system: per-branch warm/cool tint (computed once per branch, then
   baked into the cached leaf colour strings).
3. **Branch form highlight** — depth ≤ 2 branches get a thin top-edge
   highlight stroke during daylight for a cylindrical look.
4. **Trunk** — deterministic bark stripes, ambient-occlusion pool at the
   base, and a subtle warm top-light gradient by day.
5. **Sloth** — directional rim light along the sun/moon-facing edge of
   body + head, and a few deterministic fur tufts along the silhouette.

## Critical files

- `assets/main.js` — everything (single-module game).

## Verification

- `scratchpad/bench.js` (Playwright, software raster): before/after
  frame-time comparison across 6 scenarios.
- `scratchpad/shots.js`: before/after screenshots (noon, sunrise, sunset,
  night, summer, autumn, winter) — verify lighting reads correctly and
  nothing regressed.
- Manual sanity: sloth reach/eat/sleep/fall, rain/snow, pixel mode,
  BLUR BG on/off, panel sliders still live-update while open.
