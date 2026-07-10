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
| `P.hungerPace` (HTML default) | global drain multiplier | `2.0` slider default | `assets/main.js` / `index.html` |
| `P.hungerPace` (effective on load) | value actually in effect | **`≈ 0.58`** — see gotcha below | `calibrateHungerFor11_5Months()` |
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
| … 2026-05-06 → 2026-07-10 | (no change) | no starve/difficulty constant touched since | `× 0.18` | 82 % | `1/120` | `2.0` | `30` |

**Bottom line:** inside git history the *only* starving-speed constant
that ever changed is the asleep multiplier, `0.20 → 0.18`, on
2026-05-06 19:53 (`2954d7e`). Awake rate, `hungerPace`, leaf/apple
gains, `endMonths`, and `dayPace` have been constant since the first
commit.

## The calibration gotcha — effective `hungerPace` is ~0.58, not 2.0

`index.html` ships the `HUNGER PACE` slider at `2.0`, but on load
`calibrateHungerFor11_5Months()` runs once and **overwrites** it:

```
required = (240 × dayPace) / (11.5 × DAY_CYCLE_S) × 2.5
         = (240 × 1)      / (11.5 × 90)          × 2.5  ≈ 0.58
```

So the game actually boots at `hungerPace ≈ 0.58` (the panel then reads
`0.58x`), which is **~3.4× gentler** than the raw `2.0` default. This
on-load call has been present since the first commit (`471b2e6`), so the
effective starting difficulty has never been the `2.0` value.

Effective full→empty times at load (`hungerPace ≈ 0.58`, asleep `× 0.18`,
`DAY_CYCLE_S = 90`):

| State | Drain / sec | Full → empty | In-game months |
| --- | --- | --- | --- |
| Awake | `≈ 0.00483` | `≈ 207 s` | `≈ 2.3` |
| Asleep | `≈ 0.00087` | `≈ 1150 s` | `≈ 12.8` |

(For comparison, at the never-actually-used `hungerPace = 2.0`: awake
`60 s` / 0.67 mo, asleep `333 s` / 3.7 mo.)

Two stale comments live around this helper and are worth cleaning up
separately (not touched here): the header says it "doubles" the baseline
(`~5.75` months) while the code multiplies by `2.5` (`~4.6` months), and
the on-load comment says "≈0.23x" while the `× 2.5` formula yields
`≈0.58x`. The helper's internal model also assumes an asleep rate of
`1/240`, which no longer matches the real `1/120 × 0.18` — a mismatch the
`471b2e6` message already flagged.

## Which era does GAMEPLAY.md match?

`GAMEPLAY.md` was authored at 2026-05-06 20:28 (`a77c206`) and revised at
20:43 (`9361f8e`) — both **after** the `0.20 → 0.18` change (`2954d7e`,
19:53). It documents `HUNGER_DECAY_ASLEEP × 0.18` (82 % saving, and
explicitly notes "was 0.20, was 0.70 earlier"), `HUNGER_DECAY_AWAKE =
1/120`, leaf `+0.01`, apple `+0.10`, and `endMonths = 30`.

- **Constants: GAMEPLAY.md matches the `2954d7e` era (2026-05-06 19:53)
  onward — i.e. the current, live game.** No starve constant has changed
  since, so it has stayed in sync on those values continuously.
- **One exception — `hungerPace`.** GAMEPLAY.md assumes `hungerPace =
  2.0` and derives all its survival times from it (e.g. "asleep from
  100 %: 333 s ≈ 3.7 months", "awake from 100 %: 60 s"). Because the
  on-load calibration forces `≈0.58`, those numbers describe a
  configuration the game **never actually boots with** — real survival
  is ~3.4× longer (asleep from 100 %: `≈1150 s ≈ 12.8 months`; awake:
  `≈207 s`). This dimension of GAMEPLAY.md has never matched runtime.

So: GAMEPLAY.md's *decay constants* match the game from 2026-05-06 19:53
to today, but its *effective difficulty math* (built on `hungerPace =
2.0`) matches no released build.
