# Difficulty & starvation-speed history

How fast the sloth starves — the core difficulty lever — and how the
knobs that control it have changed over time. Written 2026-07-10 from a
git-history audit of `assets/main.js`.

## What controls starving speed

Hunger is a `0..1` value that decays every frame. Time-to-empty is:

```
drain_per_sec = HUNGER_DECAY_AWAKE × (asleep ? ASLEEP_MULT : 1) × P.hungerPace
seconds_to_empty = 1 / drain_per_sec
in-game months   = seconds_to_empty / DAY_CYCLE_S      (DAY_CYCLE_S = 90)
```

| Knob | Meaning | Current value | Source |
| --- | --- | --- | --- |
| `HUNGER_DECAY_AWAKE` | base awake drain / real sec | `1 / 120` | `assets/main.js` |
| `HUNGER_DECAY_ASLEEP` | asleep drain = awake × mult | `× 0.18` (82 % saving) | `assets/main.js` |
| `P.hungerPace` (default & effective) | global drain multiplier | **`1.90`** (2.0 baseline − 5 %) | `assets/main.js` / `index.html` |
| `HUNGER_LEAF_GAIN` | hunger refilled per leaf | `+0.01` | `assets/main.js` |
| `HUNGER_APPLE_GAIN` | hunger refilled per apple | `+0.10` | `assets/main.js` |
| `P.endMonths` | months to survive to win | `30` | `assets/main.js` |
| `P.dayPace` | game-clock speed | `1.0` | `assets/main.js` |

## Change-by-date table

`471b2e6` is the **initial git commit** — the project predates version
control, so the row before it ("pre-git baseline") is reconstructed from
that commit's own message rather than from a tracked diff. Every knob
except the asleep multiplier has held its `471b2e6` value ever since.

| Date (UTC) | Commit | Change | Asleep mult | Energy saving asleep | Awake drain | `hungerPace` default | `endMonths` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pre-git (≤ 2026-05-06) | — (per `471b2e6` msg) | baseline before git init | `× 0.70` | 30 % | (n/a in git) | (n/a in git) | (n/a) |
| 2026-05-06 18:54 | `471b2e6` | initial commit; hunger system as it stands today | `× 0.20` | 80 % | `1/120` | `2.0` | `30` |
| 2026-05-06 19:53 | `2954d7e` | "82 % energy saving while asleep (was 80 %)" | `× 0.18` | 82 % | `1/120` | `2.0` | `30` |
| 2026-05-06 → 2026-07-10 | (no change) | no starve constant touched in between | `× 0.18` | 82 % | `1/120` | `2.0`* | `30` |
| 2026-07-10 | (this change) | removed on-load calibration override; ship documented pace eased 5 % for win-rate | `× 0.18` | 82 % | `1/120` | **`1.90`** | `30` |

\* `2.0` was only ever the *nominal* default — until 2026-07-10 the
on-load calibration silently forced the effective value to ≈0.58 (see
below).

**Bottom line:** inside git history the starving-speed constants that
ever changed are (1) the asleep multiplier `0.20 → 0.18` on
2026-05-06 19:53 (`2954d7e`), and (2) `hungerPace` on 2026-07-10 — the
on-load calibration override was removed and the default set to `1.90`
(the `2.0` design baseline eased 5 % so the player loses less energy and
wins ~5 % more often; eating scores + hunger gains untouched). Awake
rate, leaf/apple gains, `endMonths`, and `dayPace` have been constant
since the first commit.

## Historical calibration gotcha (fixed 2026-07-10)

Until 2026-07-10, `index.html` shipped the `STARVING PACE` slider at
`2.0` but on load `calibrateHungerFor11_5Months()` ran once and
**overwrote** it:

```
required = (240 × dayPace) / (11.5 × DAY_CYCLE_S) × 2.5
         = (240 × 1)      / (11.5 × 90)          × 2.5  ≈ 0.58
```

So the game booted at `hungerPace ≈ 0.58` — **~3.4× gentler** than the
raw `2.0` default and than everything GAMEPLAY.md documented. That
on-load call was present from the first commit (`471b2e6`), so the
effective difficulty never matched the `2.0` the panel and docs implied.

The on-load call has now been removed, so the documented pace is what
actually runs. The shipped value is `1.90` (2.0 − 5 %). Effective
full→empty times now (`hungerPace = 1.90`, asleep `× 0.18`,
`DAY_CYCLE_S = 90`):

| State | Drain / sec | Full → empty | In-game months |
| --- | --- | --- | --- |
| Awake | `≈ 0.01583` | `≈ 63 s` | `≈ 0.70` |
| Asleep | `≈ 0.00285` | `≈ 351 s` | `≈ 3.9` |

(At the pre-fix `≈0.58` these were ~207 s / ~1150 s — i.e. the game just
got meaningfully harder, matching the documented design minus the 5 %
easing.)

The `calibrateHungerFor11_5Months()` helper + its dev-panel button are
still defined for manual experimentation; they simply no longer fire on
load. Its comments remain internally stale (header says "double" / the
code multiplies by `2.5`; the removed on-load comment said "≈0.23x"
while the formula yields `≈0.58x`; and its model assumes an asleep rate
of `1/240` rather than the real `1/120 × 0.18`) — worth a separate
cleanup if the button is ever revived.

## Which era does GAMEPLAY.md match?

`GAMEPLAY.md` was authored at 2026-05-06 20:28 (`a77c206`) and revised at
20:43 (`9361f8e`) — both **after** the `0.20 → 0.18` change (`2954d7e`,
19:53). It documents `HUNGER_DECAY_ASLEEP × 0.18` (82 % saving, and
explicitly notes "was 0.20, was 0.70 earlier"), `HUNGER_DECAY_AWAKE =
1/120`, leaf `+0.01`, apple `+0.10`, and `endMonths = 30`.

- **Constants: GAMEPLAY.md matches the `2954d7e` era (2026-05-06 19:53)
  onward — i.e. the current, live game.** No decay constant has changed
  since, so it has stayed in sync on those values continuously.
- **`hungerPace`, before 2026-07-10.** GAMEPLAY.md assumed `hungerPace =
  2.0` and derived all its survival times from it (e.g. "asleep from
  100 %: 333 s ≈ 3.7 months", "awake from 100 %: 60 s"). Because the
  on-load calibration forced `≈0.58`, those numbers described a
  configuration the game **never actually booted with** — real survival
  was ~3.4× longer. That dimension of GAMEPLAY.md matched no released
  build.
- **`hungerPace`, from 2026-07-10.** The override is removed and the
  shipped pace is `1.90` (2.0 − 5 %). GAMEPLAY.md's `2.0`-based survival
  times are now correct to within that documented 5 % (real times run
  ~5 % longer, e.g. asleep-from-full ≈ 351 s vs the doc's 333 s), and
  GAMEPLAY.md carries a pace note spelling out the offset. So for the
  first time the doc's difficulty math describes the actual build (bar
  the intentional 5 % win-rate easing).
