# A Sloth's Life — strategy & stats

A short field guide derived from the actual constants and code paths
in `assets/main.js`. Numbers cited inline link to their declaration
line so they stay verifiable as the game evolves.

## TL;DR — six rules

1. **Sleep is the survival lever.** Asleep, hunger drains 5.5×
   slower than awake. Idle for 3 + seconds and the sloth nods off
   automatically.
2. **Eat apples early** — spring + summer of year 1, before autumn
   shakes them off the tree (`main.js:4021-4050`). One apple = 33 s
   of sleep ≈ 0.37 in-game months of cushion.
3. **In autumn, hunt the ground.** Apples that drop land on the
   grass for ~22-30 s before they vanish. The sloth's arm
   auto-extends to grab the closest one (`main.js:2750-2775`).
4. **Stay above 10 % hunger before/during summer.** In months 6-8
   (Jul-Sep), at hunger ≤ 10 %, the sloth refuses to sleep
   (`main.js:6770-6787`). It will burn through the rest of its
   reserve at the awake rate — 5.5× faster — and starve in
   minutes.
5. **Winter is pure sleep.** No leaves, no apples. You survive on
   the stockpile you brought in.
6. **Save lives.** Each unspent life at the 30-month bell pays
   +250 score (`main.js:5726`). Three lives = up to +750.

## Stats

All values are at the default `dayPace = 1.0`, `hungerPace = 2.0`
(`main.js:46-47`).

| Constant | Value | Source |
|---|---|---|
| `HUNGER_DECAY_AWAKE` | 1/120 per real sec | `main.js:2020` |
| `HUNGER_DECAY_ASLEEP` | × 0.18 (82 % energy saving) | `main.js:2025` |
| `HUNGER_LEAF_GAIN` | +0.01 (+1 %) | `main.js:2026` |
| `HUNGER_APPLE_GAIN` | +0.10 (+10 %) | `main.js:2027` |
| `P.hungerPace` | 2.0 default | `main.js:47` |
| `DAY_CYCLE_S` | 90 real sec / in-game day | `main.js:4703` |
| `P.endMonths` | 30 (full game) | `main.js:49` |
| Apple density | 0.10 per deep branch (regrows each Jul-Aug) | `main.js:43, 4007, 4172-4193` |
| Leaf eaten | +1 score, +1 % hunger | `main.js:2810, 2027` |
| Apple eaten | +15 score, +10 % hunger | `main.js:2816, 2027` |
| Month survived | +50 score | `main.js:6741` |
| Win bonus | +250 × remaining lives | `main.js:5726` |
| Lightning timer | 6-20 real sec, 5 % hit roll | `main.js:5154-5172` |
| Branch grab range during fall | 50 px + RNG | `main.js:3140` |
| Summer wake-up | months 6-8, hunger ≤ 10 % | `main.js:6770-6787` |
| Apple drop | autumn random + Feb force-drop | `main.js:4021-4050` |
| Ground-apple grab window | 22-30 s before vanish | `main.js:4021-4050` |
| Leaf regrowth | every spring up to per-branch `fullLeafCount`; eaten leaves are permanently gone | `main.js:4140-4200` |
| Winter penalty | visual only (blue tint, no gameplay debuff) | `main.js:7001-7015` |

## How long is one game?

- 30 in-game months × 90 real sec = **2 700 real seconds = 45 real
  minutes**.
- The game starts in **April** (seasonTime = 0.25) and runs through
  **October of "year 3"** (~2.5 in-game years).

| Year | Months | Length |
|---|---|---|
| 1 | Apr-Jun | Spring (3 mo) |
| 1 | Jul-Sep | Summer (3 mo) |
| 1 | Oct-Dec | Autumn (3 mo) |
| 1 | Jan-Feb | Winter (2 mo) |
| 2 | Mar-Jun | Spring (4 mo) |
| 2 | Jul-Sep | Summer (3 mo) |
| 2 | Oct-Dec | Autumn (3 mo) |
| 2 | Jan-Feb | Winter (2 mo) |
| 3 | Mar-Jun | Spring (4 mo) |
| 3 | Jul-Sep | Summer (3 mo) |
| 3 | Oct (game-end) | Autumn (1 mo) |

## Survival math

### Doing absolutely nothing but sleeping

Hunger drains at `HUNGER_DECAY_ASLEEP × hungerPace = (1/120) ×
0.18 × 2.0 = 0.003` per real second. From full to empty: 333 real
seconds ≈ **5 min 33 s**.

But the run is more nuanced because of respawn and the summer
wake-up rule:

| Life | Start | What happens | End (cumulative real time) |
|---|---|---|---|
| 1 | 100 % hunger, April | Sleeps until hunger ≈ 10 % around mid-July (summer). Sloth wakes; awake drain (5.5× faster) burns the last 10 % in ~6 s. | ~310 s (5:10) |
| 2 | 80 % hunger, mid-July | Sleeps. Hunger dips to 10 % just *after* summer ends (early Oct), so summer-wake doesn't catch it. Sleeps to 0. | ~580 s (9:40) |
| 3 | 80 % hunger, autumn | Sleeps through autumn → winter. Reaches 0 in winter. Game over. | ~852 s (14:12) |

→ **~14 minutes real / ~9.5 in-game months survived** out of the
30-month game = ~31 % completion. Cause-of-death column reads
`💀 💀 💀`. Score is roughly **+450** (months × 50) with no apple
or leaf points.

### Doing absolutely nothing AND staying awake (worst case)

Drain = `(1/120) × 2.0 = 0.0167 / s`. Life 1 ≈ 60 s, lives 2-3 ≈
48 s each → **~2 min 45 s total**. Sleep is roughly 5× better.

### What one apple buys you

`+0.10` hunger:
- ≈ 33 s of sleep ≈ **0.37 in-game months**
- ≈ 6 s awake ≈ **0.07 in-game months**

### What one leaf buys you

`+0.01` hunger ≈ 3.3 s sleep ≈ **0.037 in-game months**.

So 1 apple ≈ 10 leaves of hunger value, but the leaf gives the
score popup (+1) too, and leaves regrow each spring while apples
do not.

### Single-life expectancy from full hunger

- Awake from 100 %: 60 s (≈ 0.67 in-game months)
- **Asleep from 100 %: 333 s (≈ 3.7 in-game months)**
- Asleep from 80 % (respawn): 267 s (≈ 3.0 in-game months)

## Month-by-month strategy (year 1)

| Month | Recommended action |
|---|---|
| **Apr (m=3)** | Game-start. Take stock: count apples on the tree. Eat any that are within easy reach to top off hunger toward 100 %. |
| **May (m=4)** | Continue eating apples opportunistically. Score: +15 each. They won't last past autumn. |
| **Jun (m=5)** | Last reliable apple-feast month. After this, summer arrives and the sleep-block becomes a real risk. |
| **Jul-Aug (m=6-7)** | **Summer apple regrowth window.** New apples appear on the tree (`main.js:4172-4193`). Stay above 10 % hunger so the summer-wake rule doesn't trigger; eat one apple any time hunger drops below ~25-30 %. |
| **Sep (m=8)** | Last summer month. Apples have stabilised; stockpile what's there before autumn knocks them off. Still summer rules — keep hunger above 10 %. |
| **Oct-Nov (m=9-10)** | **Autumn — apple shower.** Apples drop randomly. Watch for ground-apples and let the sloth's arm extend to grab them. This is the score-farming window. |
| **Dec (m=11)** | Last stragglers drop. Stockpile hunger toward 100 % before winter. |
| **Jan-Feb (m=0-1)** | **Winter.** Tree is bare. Pure sleep. Survive on the autumn stockpile. |
| **Mar (m=2)** | Spring returns; leaves regrow. Slow re-feeding via leaf snacking is back. Wait for any remaining apples to be visible again. |

Year 2 and year 3 repeat the cycle, but with progressively fewer
apples (each autumn drops some permanently) and progressively
fewer regrowable leaf slots (each eaten leaf removes a slot from
its branch's `fullLeafCount` budget). The endgame is a careful
balance between letting leaves regrow (don't eat too many) and
feeding the sloth enough to outlast winter 2 and winter 3.

## Scoring strategy

| Source | Per unit | Cap | Score driver? |
|---|---|---|---|
| Months survived | +50 | 30 mo × 50 = +1 500 | **Yes — biggest single contributor** |
| Lives kept on win | +250 | 3 × 250 = +750 | Yes — second biggest |
| Apples eaten | +15 | semi-renewable: tree regrows up to density every Jul-Aug (`main.js:4172-4193`) | Solid mid-game contribution |
| Leaves eaten | +1 | semi-renewable | Negligible |

**Realistic ceiling at default settings:** survive all 30 months
with all 3 lives intact and grab most apples = **1 500 + 750 +
~300-400 from apples + a few hundred leaves ≈ 2 500-2 800**.

The biggest score swing comes from staying alive through every
season, not from grinding leaves. Don't fall, don't starve, don't
stand in the lightning's randomly-chosen lane.

## Lightning, falls, weather

- **Lightning.** 6-20 second strike-attempt timer (`main.js:
  5154`). Each attempt rolls a 5 % chance to actually hit the
  sloth, but only if the sloth is in a hittable state
  (HANGING / WINDUP / REACHING / TRANSITION / EATING / SLEEPING —
  not STARVING or FALLING). The strike target is a random point
  along 60 % of trunk height; **it does NOT track the sloth's
  position or favour a specific climbing height** (`main.js:
  5175-5176`). The start-screen TIP that says "climb too high
  and lightning will find you" is flavour, not mechanic.
- **Falls.** Any uncaught fall ends at the ground after a 1.6 s
  death animation (`main.js:3162-3178`). During a fall, the
  sloth auto-grabs any branch within 50 px (with an RNG roll on
  `P.grabChance`). There's **no minimum-height "you can't fall
  off the tree from too low" threshold**; falling at any
  altitude with no branch within 50 px = game-over for that life.
- **Wind / rain / storms.** Storm timer is independent of season
  (`main.js:4982-4996`). No autumn-wind difficulty spike.
- **Winter.** Visual only — blue tint + ground fog. No cold
  debuff, no slow-down, no faster hunger drain.

## Caveats — known TIP-vs-mechanic mismatches

The start-screen TIP currently reads:
> A falling sloth can still grab a passing branch. Climb too high
> and lightning will find you; too low and you'll slip off the
> tree.

Both halves of the second sentence are flavour, not mechanic, as
of this writing:

- **"Climb too high → lightning":** lightning targets a random
  point on the trunk, independent of the sloth's height. See
  `main.js:5175-5176`.
- **"Climb too low → fall off the tree":** there is no
  height-banded fall threshold. Falls happen when grip is lost,
  and recovery is purely a 50-px-to-nearest-branch RNG roll.

If either rule is supposed to be real, the mechanic side is the
side to add. The TIP itself is fine if the player reads it as
narrative texture.

## Numbers may shift

Defaults to watch — these have been tuned multiple times in
recent commits and the strategy in this doc assumes the
post-2026-05-06 values:

- `HUNGER_DECAY_ASLEEP × 0.18` (was 0.20, was 0.70 earlier).
- `P.hungerPace = 2.0` (set via the dev panel).
- `P.shadeStrength = 1.6` (was 1.8 earlier — visual only,
  no gameplay impact).
- Winter band shortened from 3 months to 2 months (Jan-Feb only).

If those drift, the numeric tables above need a refresh.

## Is winning even possible? How big is the chance?

Yes — but it's tighter than the start screen suggests, and a
casual play-through is unlikely to make it to month 30.

### What "winning" means in code

The win check is a single line at `main.js:6750-6751`:

```js
if(P.endMonths > 0 && gameDaysElapsed >= P.endMonths) _endGame(true);
```

Reach 30 in-game months with **at least one life remaining**
and the game flips to the win banner. Lose all 3 lives before
month 30 → loss banner. Apples eaten doesn't matter; survival
time is the only condition.

### The hunger budget

Across the full 45-minute game the sloth burns roughly:

| Awake fraction | Effective drain | Drain over 30 mo |
|---|---|---|
| 5 % | `0.95 × 0.003 + 0.05 × 0.0167` ≈ 0.0037 / s | ≈ **10.0 hunger units** |
| 1 % (near-perfect sleep) | ≈ 0.0031 / s | ≈ **8.5 hunger units** |

Even with near-perfect sleep, you have to refill ~7-9 hunger
units of food across the game.

### The hunger supply

| Source | Amount | Hunger value |
|---|---|---|
| Starting hunger | 1.0 | 1.0 |
| Two respawns at 0.80 (after losing 2 lives) | +0.80 × 2 | 1.6 (only if you let those lives starve) |
| Apples — 4 harvests of ~10 fruit (Apr year 1 + Jul-Aug years 1-3) | ~30-40 fruit @ 0.10 | **~3.0-4.0** |
| Leaves — eaten through 3 spring regrowths, capped by initial `fullLeafCount` and reduced each time you eat one | rough estimate ~150-300 @ 0.01 | **~1.5-3.0** |
| **Realistic total available** | | **~7-10** |

Conclusion: the supply is tight against the demand. The game
*is* winnable, but it requires you to harvest most of what's on
the tree across both food sources. A run that ignores apples
or leaves can't make 30 months even with perfect sleep.

### Lightning is the second wall

Lightning fires only during thunderstorms (rain intensity > 0.65
plus a 55 % per-storm thunder roll, see `main.js:5117`). Storms
themselves run a 14-36 s storm + 35-105 s dry cycle.

Math (approximate, all RNG):

- ≈ 95 s per storm cycle, 35 % of storms have thunder.
- Thunder time per cycle: 25 s storm × 0.35 ≈ 9 s.
- Strike attempts during thunder: 1 per 13 s on average.
- Hit roll per attempt: 5 %.
- **Expected lightning hits in a 45-min game: ~1.**

So on average lightning takes **one life** per game. With 3
lives that's manageable, but RNG can run hot — variance is
~1 hit, so 2-3 hits in a single run isn't rare. Each hit kills
the current life immediately.

### Putting it together — win odds by player tier

These are estimates from the math above, not measured. They
assume default constants (post-2026-05-06 values) and the
default tree-generation seed.

| Tier | Behaviour | Lightning luck needed | Win rate |
|---|---|---|---|
| Random tapper, never sleeps | Awake-only run dies in ~3 min | n/a (dead before lightning matters) | **<1 %** |
| Casual sleeper, eats opportunistically | Sleeps when idle but ignores summer regrowth + autumn drops | normal (1 hit) | **~10-15 %** |
| Strategic player | Eats every available apple, snacks on leaves in spring 2 + 3, manages summer-wake rule, sacrifices life 1 to a summer starvation if needed | normal (1 hit) | **~40-55 %** |
| Expert + good RNG | All of the above + lucky lightning (0 hits) + good tree (above-median apple/leaf count) | very good (≤1 hit) | **~70-80 %** |
| Expert + bad RNG | All of the above + 3+ lightning hits | impossible (no lives left) | **~10 %** even for expert play |

### What "best possible" looks like

A theoretical win with all 3 lives kept and every apple/leaf
maximised:

- Months: 30 × 50 = **+1 500**
- Lives: 3 × 250 = **+750**
- Apples: ~35 × 15 = **+525**
- Leaves: ~250 × 1 = **+250**
- **Total: ~3 025 points**

Realistic winning score (1 life lost, average food gathering):
**~2 000-2 200**.

If the leaderboard's top scores cluster at 2 000-2 500 the
hunger economy is tuned about right. If they cluster <1 000
nobody is winning, and the multipliers (or food density)
should probably loosen. If they cluster ≥2 800 the win is too
easy.

### The two RNG-based reasons a winnable run can still fail

1. **Three lightning hits in one game** (≈ 8 % per the Poisson
   estimate above). Bad luck. No counterplay other than ducking
   into STARVING / FALLING states the moment thunder is audible
   — but those cost a life by themselves, so it's not really a
   strategy.
2. **Sparse tree generation.** The `appleCount` density is a
   probability per branch, not a count. If RNG gives a tree
   with few deep branches, you may simply not have enough
   apples + leaves in the world to refill 7-9 hunger units.
   Reroll by restarting a fresh game.

### TL;DR

> Yes, the game is winnable. Plan on harvesting almost
> everything the tree produces. Expect to lose one life to
> lightning. Keep an eye on summer-wake hunger. A skilled
> player wins ~50 % of the time at default settings; an expert
> with calm thunder ~75 %.
