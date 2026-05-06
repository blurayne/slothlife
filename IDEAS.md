# Ideas / wishlist

A working backlog of future ideas for slothlife. Not a plan —
these are unsorted seeds. Promote any entry to `PLAN.md` (with
a detailed plan under `.claude/plans/`) when it's ready to
ship.

Add new ideas here freely. Keep each entry to a paragraph or
two; cross-link to existing systems / files when something
already exists that the idea would extend.

## Background life

### Animated birds

Small birds in the canopy / sky, in two related modes:

- **Flying-by.** A bird flies across the screen at a
  random altitude, wing-beat animated, using the same wind
  field the tree and falling leaves react to so a strong
  gust visibly speeds it along (or pushes it sideways). One
  to three birds in flight at once, max. Spawn rate gated
  on the current weather: more birds on calm sunny days,
  fewer in rain, none in heavy storms / lightning.
- **Landing on a branch for a short time.** Occasionally a
  flying bird targets a deep branch (`b.depth >= 3`),
  glides in, perches for a few seconds (small bobbing /
  head-turn idle animation), then takes off again. The
  branch sways slightly under the weight when it lands /
  leaves — reuse the existing branch-physics impulse path.
  Birds avoid branches the sloth is currently on / next
  to so they don't visually collide.

Implementation hooks in the existing code: the
`FallingLeaf` class is the closest analogue (autonomous
sprite that's spawned, animated, and despawned without
disturbing game state). The wind system in
`assets/main.js` already exposes `Wind.str` + direction
for the bird's motion, and `allBranches()` gives the
landing candidates. Day-night gating can read the existing
`getSeasonInfo` / sun position so birds only appear in
daylight (nightingales in the dark would be a separate
pass).

Audio: optional. A faint chirp on landing would sell the
moment; needs a new short MP3 sample under
`assets/audio/`. No chirp on flyovers (would get noisy
fast).

Out of scope on the first pass: birds interacting with
apples or leaves, predator behaviour, bird species
variety. Start with one silhouette, get the motion and
spawn rhythm right, then iterate.
