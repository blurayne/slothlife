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

### Squirrels

Land-based counterpart to birds. A squirrel scampers in
along the grass, climbs the trunk for a beat, and either
heads back down or — rarely — runs out a low branch and
nicks an unguarded apple before darting off. Treat the
sloth as territorial: if the sloth is on a low branch with
food in arm's reach, the squirrel keeps clear. Otherwise
the sloth might lose 1-2 apples per game, which adds light
pressure to grab fruit early instead of letting it ripen
indefinitely.

Reuses `Fruit.detach()` to make the stolen apple visibly
fall and disappear off-screen with the squirrel rather than
hitting the grass.

### Insects

Two seasonal swarms, mostly cosmetic:

- **Butterflies / bees** spawn in spring + summer in calm
  weather, drifting around the upper canopy. No
  interaction; pure ambience.
- **Fireflies** at night in summer, faint warm-white
  pulses that drift around the lower trunk. A handful at
  most per frame so they read as individuals, not a
  cloud.

Same `FallingLeaf`-style sprite lifecycle. Density gated
on `getSeasonInfo` + the existing day-night opacity used
for the moon / clouds.

## Sky & atmosphere

### Night sky polish

- **Moon phases** that cycle slowly across in-game months
  (one full lunation per ~3 in-game months reads about
  right). Just a different mask on the existing moon
  sprite per phase.
- **Shooting stars** on rare clear nights — a single
  diagonal streak that fades over ~0.6 s. Spawn rate ~1
  in 5 in-game nights, gated on cloud cover ≈ 0.

Both should be stable per-game-day so a player who tabs
away and comes back doesn't see a different moon.

### Dawn fog and summer haze

A thin, semi-transparent horizontal band that sits between
the trees and the grass for the first ~0.5 in-game hour
each day, fading out as the sun climbs. Same band, more
sluggish, on hot summer days (gated on `getSeasonInfo`'s
summer fraction). Pure render-pass effect; no gameplay
hook.

### Puddle reflections after rain

When a storm has just ended (rainTargetIntensity dropped
to 0 in the last ~30 s), draw a couple of low-opacity
puddles on the grass that reflect a soft mirrored copy of
the lower trunk + a darker patch of sky. Fades over ~1
in-game day. Reuses the existing rain-end timer in
`updateRain`.

## Weather and hazards

### Icy branches in winter

In January / February, a low chance per branch to be
"icy" — the sloth's grip on an icy branch slowly slips
(positive `t` drift toward the branch tip) until either
the player swings to a new branch or the sloth falls off
the end. Visually, an extra cool-blue gradient over the
branch. No instant-fall — the slip is gradual so the
player has time to react.

Adds genuine winter pressure to a season that's currently
visual-only.

### Heat wave and drought

Mid-summer (July) gets a per-game roll for a heat wave:
hunger drains 1.3× faster while the sloth is in direct
sun, normal in shade. Layered with a drought variant —
no rain for ~2 in-game months, leaves dry out and yield
slightly less hunger when eaten (`HUNGER_LEAF_GAIN × 0.6`).
Together they make summer a real survival challenge
instead of just the "stay above 10 % hunger" rule.

The shade-vs-sun check already has half the plumbing —
the sun shadow on the sloth body is computed in
`assets/main.js` and could expose a "sloth is in shade"
flag.

### Wind-gust event

Occasional very-strong wind gusts that, beyond shaking
the tree more violently, also have a chance to knock
ripe apples loose and shake leaves into a flurry.
Telegraph it: a low rumble + visible distant tree-line
sway ~1.5 s before the gust hits, so a paying-attention
player can grab apples preemptively.

Reuses `Wind.str` + the existing autumn knock-off chance
in `_impactNewBranch`. The telegraph would be a new
audio cue.

## Progression and meta

### Daily challenge

A fixed-seed run where every player today gets the
same tree generation, same weather sequence, same RNG.
Scores on the daily challenge live on a separate
leaderboard so seed-luck doesn't dilute the regular
"beat your friends' best ever" board. Reset at midnight
UTC.

Needs a seedable RNG (see "Code & infra" below).

### Achievements

Lightweight badges for one-time accomplishments —
displayed on the start screen / end screen. Examples:

- *Quiet sloth* — finish a run without a single fall.
- *Sun catcher* — eat 10 apples in a single run.
- *Survivor* — win with all 3 lives intact.
- *Frugal* — win without eating any leaves.
- *Storm-chaser* — survive a lightning storm in
  summer (≥ 5 thunder events live through).

Stored in localStorage (or Convex when shared
highscores are on). Tiny glyph badges next to the
player's name on the leaderboard if they've earned one.

### Cosmetic sloth skins

A small set of fur-colour / accessory variants:
default brown, pale-cream, charcoal, and a few unlocks
gated on achievements (e.g. winter-survivor → frosted
fur tips). Selected on the start screen. Pure visual,
no stat changes.

## Accessibility and UX

### Reach-radius preview

When the player puts their finger down on a branch /
apple but hasn't released yet, fade in a soft circle
around the sloth showing the current arm-reach radius
(`armR`). Released targets inside the circle commit;
outside it fades out and the tap is a no-op (or plays
`Audio.playTargetInvalid()`). Cuts the "tapped, didn't
do what I expected" surprise.

Already half-built — the `armR` value is used in
`__runTapLogic` for the reach check. Just needs to be
drawn while a tap is pending.

### Colour-blind-safe LIVES icons

The cause-of-death glyphs (⚡ 🪵 💀 ❤️) read fine for
most users, but the legend's "won" ❤️ is the only
human-shape glyph among very different objects. Add a
text-only mode toggle that renders single-letter codes
instead (L / F / S / W) for users with emoji-rendering
issues or strong colour-blind needs. Toggle lives in
the settings panel under a new "Accessibility" section.

### First-run tutorial overlay

For users who launch the game for the first time
(localStorage flag), a 3-step coach mark sequence that
points at:

1. The hunger bar (in the HUD).
2. An apple in the tree (with "tap to eat").
3. The sloth (with "long-press to skip ahead… kidding,
   that kills it").

Dismissable; never shows again once flagged. Keeps the
start-screen rules text as the canonical reference but
pulls a new player through their first 30 seconds
without them having to read.

## Code and infra

### Seedable RNG

Replace the bare `Math.random()` calls in tree
generation, weather scheduling, lightning timing, and
fruit drops with a single seedable PRNG (mulberry32 or
sfc32 — both ~10 lines, no deps). Default seed is
`Date.now()` so behaviour is unchanged for casual play;
adding a seed query param (`?seed=12345`) lets the
daily-challenge mode work and lets bug reports include
a reproducible seed.

Touches a lot of files but most replacements are
mechanical. A grep for `Math.random` in `assets/main.js`
gives the surface area.

### Save and resume mid-run

Auto-save the game state to localStorage every ~30 real
seconds while playing. On a refresh / new tab, offer
"Resume" alongside the start button. Discards the save
on actual game-over (win or loss). Helps phone players
who get a phone call mid-run from losing a 30-minute
session.

Saved state is small: `gameDaysElapsed`, `hunger`,
`score`, `lives`, `_livesLost`, the current sloth
position + grip state, apple/leaf state per branch.
Probably ~5 KB serialized.

Out of scope: cloud sync. localStorage is per-browser;
if the player switches devices the save doesn't follow
them. Acceptable trade-off for the simplicity.
