# Match GAMEPLAY.md starving pace, eased 5% for win-rate

## Context

`DIFFICULTY.md` established that the shipped game ran ~3.4× gentler than
GAMEPLAY.md documented: the on-load `calibrateHungerFor11_5Months()` call
silently overrode the `hungerPace` slider default (`2.0`) with ≈0.58.
The request: make the game actually run at the documented pace, then ease
it 5 % (lose less energy → ~5 % better win odds) **without** touching the
score/hunger amounts eating gives.

## Changes

- `assets/main.js`
  - Remove the on-load `calibrateHungerFor11_5Months();` call so the
    documented `P.hungerPace` runs instead of the ≈0.58 override. Helper
    + dev-panel button kept for manual use.
  - `P.hungerPace` default `2.0 → 1.90` (2.0 baseline − 5 % energy loss).
  - Untouched: `HUNGER_DECAY_AWAKE = 1/120`, `HUNGER_DECAY_ASLEEP × 0.18`,
    `HUNGER_LEAF_GAIN +0.01`, `HUNGER_APPLE_GAIN +0.10`, leaf/apple
    **scores** (+1 / +15), `endMonths 30`, `dayPace 1.0`.
- `index.html` — `s-hungerPace` slider `value 2.0 → 1.90`, label `1.9x`.
- `GAMEPLAY.md` — pace note + constants-table `hungerPace 1.90`.
- `DIFFICULTY.md` — new change-log row, gotcha marked fixed, effective
  full→empty table recomputed at 1.90, GAMEPLAY.md-match section updated.

## Effect

Effective drain is exactly 5 % lower than the `2.0` baseline (awake +
asleep uniformly). Asleep-from-full ≈ 351 s (~3.9 in-game months) vs the
baseline 333 s; awake-from-full ≈ 63 s vs 60 s. Net vs the *previous
shipped build* (which ran ≈0.58) the game is markedly harder — that is
the point: it now matches the documented design, minus 5 %.

## Verification

- Headless probe (`scratchpad/effective.js`): `P.hungerPace === 1.9`,
  slider reads `1.9x`, asleep full→empty ≈ 351 s.
- `scratchpad/sanity.js`: full interaction sweep (taps, storm, pixel
  mode, winter, zoom/pan, rebuild, resize) error-free.
