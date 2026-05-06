# Plan: highscores — track survival time + cause of death per life

## Context

The leaderboard previously showed only NAME / SCORE (small board)
and NAME / SCORE / WHEN (top-100 dialog). Goal: unify the layout
across surfaces and surface two extra signals per row — how long
the run lasted *in-game*, and how each life was lost (so a
glance at the row tells the story of the run).

## Changes

Per-row schema additions (additive, optional):

```js
{ name, score, date,                    // existing
  survivedMonths,                        // floor(gameDaysElapsed) at end
  livesLost: [{reason, month}, ...],     // 0-3 entries
                                         // reason ∈ {fall|lightning|starve}
  endReason }                            // 'win' | 'gameover' | 'killed'
```

Run-state plumbing in `assets/main.js`:

* New `_livesLost` array logs each natural death's cause + month.
  Reset alongside `lives` in `beginPlaying` / `restartGame` and the
  load-time init block.
* `Sloth._die()` pushes one entry per call; cause derived from
  existing flags (`charred` → `'lightning'`, `STARVING`/`starveLetGo`
  → `'starve'`, else → `'fall'`).
* The player-kill path keeps its early return so the kill burns all
  remaining slots at render time without polluting the death log.
* Name-entry submit handler passes `survivedMonths` (= floor of
  `gameDaysElapsed`), `livesLost`, and `endReason ∈ {win|gameover|
  killed}` into `insertHighscore`.

Storage:

* localStorage gains the three optional keys — JSON tolerates
  missing fields, so old browser entries keep rendering with
  em-dash placeholders.
* Convex schema (`convex/schema.ts`) adds the three fields as
  `v.optional()` so existing rows still validate. The submit
  mutation (`convex/highscores.ts`) accepts + sanitises them
  (livesLost capped at 8, months at 10 000); the list query
  returns them.

Layout: all surfaces now render the same six-column table sorted
by score descending — `# | SLOTH | WHEN | LASTED | SCORE | LIVES`.
The LIVES column shows three glyphs per row, one per life slot:

| Slot fate | Glyph |
|---|---|
| starved | 💀 |
| struck by lightning | ⚡ |
| fell off tree | 🪵 |
| lost to player kill | ⚡ |
| survived to the end | 🏆 |

Format helpers:

* `formatGameDuration(months)` — `"3mo"`, `"1y 4mo"`, `"3y"`, `"—"`.
* `renderLivesCell(h)` — assembles the three glyph slots.

## Critical files

- `assets/main.js` (run state, Sloth._die, insertHighscore, render)
- `assets/styles.css` (six-column layout + icon styling)
- `convex/schema.ts` (optional fields)
- `convex/highscores.ts` (submit/list)

## Verification

1. Lose all three lives mixing causes → row shows three correct
   icons in chronological order.
2. Long-press the sloth on a fresh run → "you bastard" banner →
   row shows three ⚡.
3. Survive 30 in-game months → 🏆 in every un-lost slot, `2y 6mo`
   (or `3y` if no lives lost) in LASTED.

## Shipped

- `800e6c7` — highscores: track survival time + cause of death per life
