# Two-finger pinch zoom (toggleable, default off)

## Context

Add a Maps-style two-finger pinch to zoom the world (canvas content
only — HUDs and overlays must stay screen-space). Toggleable in the
panel, default OFF. Zoom range is `[1.0, MAX]` — pinching out can only
restore the original view, never shrink past it.

## Surface area / "find every part"

- **Camera transform** is applied at TWO call sites: `assets/main.js:5689`
  (main world render: bg, particles, trunk, grass, fruits, leaves, sloth,
  rain, lightning) and `assets/main.js:5822` (post-pixel reach overlay).
  Both must use the same zoom-aware matrix.
- **Coordinate conversion**: `canvasToWorldX(cx) = cx - sceneOffsetX`
  (`assets/main.js:3416`) is used by tap targeting (`__runTapLogic`),
  the kill-by-hold pointer hit-test, and the kill-by-hold cancel
  threshold. Need to update for zoom and add `canvasToWorldY`.
- **Sloth hit-test** (`Sloth.isHitByTap`) compares world coords; the
  existing call passes `(wx, cy)` — the Y was canvas-space because there
  was no vertical transform. With zoom we need world-space Y too.
- **Pointer handlers** currently track a single pointer (`isPanning`,
  `pendingTap`, `killHold`). We need a `Map` of active pointer
  positions to detect the second finger.
- **Pan velocity / inertia**: `sceneOffsetX = panStartOffset + dx`
  and `sceneOffsetX += panVelX * dt` (`assets/main.js:5673`) need the
  drag to map 1:1 in canvas pixels even when zoomed → divide by
  `worldZoom`.
- **HUDs / dim overlay / season tints / pause overlay / lightning
  flash / score popups outside camera transform**: all already
  screen-space. Untouched.
- **Restart**: `restartGame()` and `init()` should reset zoom to 1.0
  so a new run always starts un-zoomed.

## Design

### State

```js
let worldZoom        = 1.0;          // 1.0..ZOOM_MAX
const ZOOM_MIN       = 1.0;
const ZOOM_MAX       = 4.0;
const ZOOM_CENTER_X_FN = () => W * 0.5;   // anchored at canvas centre
const ZOOM_CENTER_Y_FN = () => H * 0.5;
const activePointers = new Map();    // pointerId → { x, y } in canvas px
let pinch = null;                    // { ids:[id1,id2], dist0, zoom0,
                                     //   anchorWX, anchorMidCx, offset0 }
```

`zoomMode` (default `false`) follows the existing `applyXxx` pattern.

### Camera transform helper (one source of truth)

```js
function applyCameraTransform(){
  const cx = W * 0.5, cy = H * 0.5;
  ctx.translate(cx, cy);
  ctx.scale(worldZoom, worldZoom);
  ctx.translate(-cx + sceneOffsetX, -cy);
}
```

Replace both `ctx.translate(sceneOffsetX, 0)` sites with
`applyCameraTransform()`.

### Coordinate inverse

```js
function canvasToWorldX(cx){
  return (cx - W * 0.5) / worldZoom + W * 0.5 - sceneOffsetX;
}
function canvasToWorldY(cy){
  return (cy - H * 0.5) / worldZoom + H * 0.5;
}
```

At zoom = 1 this matches the old `cx - sceneOffsetX` and `cy` exactly,
so existing call sites stay correct.

### Pointer pipeline

- `pointerdown`: add to `activePointers`. If `zoomMode` is on AND
  `activePointers.size === 2`, START PINCH:
  - cancel existing single-finger gestures: `pendingTap = null;
    isPanning = false; killHold = null; sloth.killHoldT = 0`
  - record `dist0`, midpoint, `zoom0 = worldZoom`, `offset0 = sceneOffsetX`,
    plus `anchorWX = canvasToWorldX(midCx)` so the X midpoint stays
    anchored as zoom changes.
- `pointermove`: update `activePointers`. If `pinch` is active:
  - new dist & midpoint
  - `worldZoom = clamp(zoom0 * dist/dist0, ZOOM_MIN, ZOOM_MAX)`
  - re-solve `sceneOffsetX` so `canvasToWorldX(newMidCx) === anchorWX`
- `pointerup`/`pointercancel`: remove pointer. If we drop below 2,
  end the pinch. **Don't** start a tap or pan on the last finger lift —
  consume that finger fully so a pinch doesn't accidentally swing the
  sloth on release.
- Single-pointer paths (pan / tap / kill) only fire when
  `activePointers.size === 1` AND no `pinch`.

### Pan zoom-awareness

- `pointermove` pan: `sceneOffsetX = panStartOffset + dx / worldZoom`
- frame-loop inertia: `sceneOffsetX += panVelX * dt / worldZoom`
- `panVelX` itself stays in canvas-px/s.

### Settings toggle

- Add `<div class="ptog-row"><span class="pname">ZOOM</span>
  <div class="tog" id="t-zoom"></div><span class="tlbl" id="l-zoom">OFF</span></div>`
  in the FEATURES section right next to SUN SHADE.
- `zoomMode` flag, `applyZoom()` / click handler mirroring the others.
- When the toggle is turned OFF mid-zoom, immediately
  `worldZoom = 1.0; pinch = null;` so the view snaps back.

### Reset on restart

`restartGame()` → `worldZoom = 1.0; pinch = null; activePointers.clear();`

## Critical files

- `index.html` — ZOOM toggle row.
- `assets/main.js`
  - DOM refs / `zoomMode` flag / `applyZoom` / click handler (~130-170)
  - `worldZoom`, `activePointers`, `pinch`, helpers
  - `canvasToWorldX` (~3416) + new `canvasToWorldY`
  - pointer handlers (`pointerdown` ~3437, `pointermove` ~3485, `_endPan` ~3515)
  - frame loop pan inertia (~5673)
  - `applyCameraTransform()` helper + replace at lines 5689, 5822
  - `restartGame()` zoom reset
  - `Sloth.isHitByTap` pass world-Y from `canvasToWorldY` at the call
    site (line ~3461) instead of bare `cy`.

## Verification

1. `node --check assets/main.js`.
2. `python3 -m http.server 8765`, open in a browser with touch
   emulation (or a touch device).
3. Toggle ZOOM **off** (default): pinch does nothing, single-finger
   pan/tap/kill behave exactly as before.
4. Toggle ZOOM **on**: pinch out → world zooms in around centre, X
   midpoint stays under fingers; pinch in → zooms back; cannot zoom
   below 1.0 (snaps to original view).
5. Pan while zoomed: drag distance feels 1:1 with the screen; HUD,
   hearts, score, bars all stay original size and position.
6. Tap a branch / apple while zoomed: sloth still swings to the right
   target. Tap-and-hold the (zoomed) sloth body: kill-by-hold still
   triggers correctly.
7. Lose / win and restart: new run starts at zoom 1.0.

## Commit

Single logical change → one commit:
`Two-finger pinch zoom (toggleable, default off)`.
