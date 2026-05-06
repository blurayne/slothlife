# Plan: GAMEPLAY.md — strategy + stats field guide

## Context

User asked: "how long could I survive doing absolutely nothing
than sleeping … what is the best strategy for the game to win?
which months should I eat? when should I sleep? please write a
file called GAMEPLAY.md with that game strategy and stats."

Already answered the do-nothing-but-sleep math in chat
(~14 min real / ~9.5 in-game months). User wanted that captured
in a durable doc plus a positive-play strategy. CLAUDE.md
forbids creating *.md docs except on explicit request — this
qualifies.

Two parallel Explore agents mapped all the mechanics needed to
make the strategy authoritative (apple lifecycle, scoring rules,
season effects, summer-wake rule, lightning targeting, fall
thresholds). Findings folded into the doc with line-number
citations so the numbers stay verifiable.

## Doc structure (`/home/user/slothlife/GAMEPLAY.md`)

1. **TL;DR** — six rules.
2. **Stats table** — every constant that affects play, with
   `main.js:LINE` source.
3. **How long is one game** — 30 in-game months = 45 real min;
   year/season table from start-in-April to game-end-in-October-
   of-year-3.
4. **Survival math**:
   * Doing absolutely nothing but sleeping — full life-by-life
     breakdown, including the summer-wake rule catching life 1.
   * Worst case (always awake): ~2:45.
   * Per-apple cushion: +0.10 hunger ≈ 33 s sleep.
   * Per-leaf cushion: +0.01 hunger ≈ 3.3 s sleep.
   * Single-life expectancy from full hunger.
5. **Month-by-month strategy** for year 1.
6. **Scoring strategy** — months drive score (1 500 max), lives
   second (750 max), apples modest, leaves negligible. Realistic
   ceiling 2 500-2 800.
7. **Lightning, falls, weather mechanics** — *with the explicit
   caveat that the start-screen TIP about lightning-by-height
   and falling-off-from-too-low is FLAVOUR, not mechanic*. The
   code targets lightning randomly (not sloth-position-aware)
   and has no height threshold for falls. Either rule, if real,
   needs to be added in code first.
8. **Numbers may shift** — closer noting which constants have
   moved recently (`HUNGER_DECAY_ASLEEP × 0.18`,
   `P.shadeStrength = 1.6`, winter band shortened to 2 months)
   so the doc has a "valid as of" anchor.

## Critical files

- `GAMEPLAY.md` (new, repo root) — the doc.
- `PLAN.md` — gets a checkbox + plan-link entry.

## Verification

1. `cat GAMEPLAY.md` renders as expected markdown.
2. Linked from PLAN.md.
3. No code change → no runtime test needed.

## Out of scope

- "Fixing" the lightning-vs-TIP discrepancy. Surfaced in the
  doc; user's call whether to ship a height-aware lightning
  rule or rewrite the TIP.
- German translation. App is English; doc stays English.

## Shipped

- `a77c206` — docs: add GAMEPLAY.md.
