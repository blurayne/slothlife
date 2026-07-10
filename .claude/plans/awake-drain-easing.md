# Awake-only hunger easing (−10%)

## Context

Follow-up to the starving-pace change. Request: "lose less energy when
awake, make the game a little bit easier, +10% win chance." So the easing
targets the **awake** state specifically, leaving the sleep economy alone.

## Change

`assets/main.js`:
- `HUNGER_DECAY_AWAKE`: `1/120 → 1/120 × 0.90` (10% gentler awake drain).
- `HUNGER_DECAY_ASLEEP`: was `HUNGER_DECAY_AWAKE × 0.18` (derived) → now
  pinned to the absolute `1/120 × 0.18`, so easing awake does **not** drag
  the asleep rate down with it. Sleeping costs exactly what it did before.
- Untouched: `hungerPace 1.90`, leaf/apple **scores** (+1/+15) and hunger
  gains (+0.01/+0.10), `endMonths 30`, `dayPace 1.0`.

Comments near the constants + the in-loop decay comment updated (the
awake/asleep saving ratio now reads ~80% / 5×, purely because awake got
cheaper).

## Effect (headless-verified, hungerPace 1.90)

- Awake drain `0.01583 → 0.01425` /s (exactly −10%); awake full→empty
  `63 s → 70 s`.
- Asleep drain `0.00285` /s and full→empty `≈ 351 s` — unchanged.

Targets the documented main loss condition: the summer-wake window
(months 6-8, hunger ≤ 10% forces the sloth awake) now burns ~10% slower.

## Docs

GAMEPLAY.md (constants table, pace note, 5.5×→5× ratio, awake expectancy)
and DIFFICULTY.md (knobs table, change-log rows, effective table) synced.
