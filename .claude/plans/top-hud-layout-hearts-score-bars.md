# Top HUD: hearts → score (left) → bars (right)

## Context

Today the top HUD reads, left-to-right:
`[hearts]` ………… `[food icon | hunger | clock | survival]` ………… `[SCORE 1234]`
— hearts on the left, the bars centered, the word "SCORE" plus the
number on the right. The user wants the order rebalanced to:

`[hearts] [1234] ………… [food icon | hunger | clock | survival]`

i.e. score sits next to the hearts on the left without the "SCORE"
prefix, and the two bars (with their icons and clock) move to the
right edge of the screen.

## Changes

### `assets/main.js`

- **`drawScoreHUD()`** (around line 4712): switch to a left-anchored,
  number-only score placed just after the hearts.

  ```js
  function drawScoreHUD(){
    ctx.save();
    const s = HUD_SCALE;
    ctx.font = `bold ${Math.round(16 * s)}px "Courier New", monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const heartsRight = 18 + MAX_LIVES * 22 * s;
    const x = heartsRight + 12 * s;
    const y = 21 * s;
    const text = String(score);
    ctx.lineWidth = 3.5 * s;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = '#FFE678';
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  ```

- **`_hudBarsRect()`** (around line 4738): right-anchor the composite
  to `W - 18` (instead of centering between hearts and score). Reserve
  ~90 × s of width for the score so the bars never collide with it on
  small screens.

  ```js
  function _hudBarsRect(){
    const s            = HUD_SCALE;
    const h            = 12 * s;
    const gap          = 6 * s;
    const iconD        = h * 2;
    const heartsRight  = 18 + MAX_LIVES * 22 * s;
    const scoreReserved = 90 * s;            // room for ~5-6 digit score
    const minLeft      = heartsRight + 12 * s + scoreReserved + 18 * s;
    const rightEdge    = W - 18;
    const availW       = rightEdge - minLeft;
    const cappedW      = Math.max(160 * s, Math.min(384 * s, availW));
    const barsW        = cappedW - iconD * 2 - gap * 3;
    const hungerW      = Math.round(barsW * 0.60);
    const survivalW    = Math.max(40 * s, barsW - hungerW);
    // Right-anchor the [food | hunger | clock | survival] composite.
    const survivalX    = rightEdge - survivalW;
    const clockCx      = survivalX - gap - iconD * 0.5;
    const hungerX      = clockCx - iconD * 0.5 - gap - hungerW;
    const foodCx       = hungerX - gap - iconD * 0.5;
    const y            = 14 * s;
    return {
      y, h,
      foodX: foodCx, foodY: y + h * 0.5, foodR: iconD * 0.5,
      hungerX, hungerW,
      clockX: clockCx, clockY: y + h * 0.5, clockR: iconD * 0.5,
      survivalX, survivalW,
    };
  }
  ```

- All four `draw*` functions (`drawFoodIcon`, `drawHungerBar`,
  `drawClock`, `drawSurvivalBar`) call `_hudBarsRect()` for their
  positions, so they'll automatically follow.

## Critical files

- `assets/main.js` — `drawScoreHUD` (~4712) and `_hudBarsRect` (~4738).

## Verification

1. `node --check assets/main.js`.
2. `python3 -m http.server 8765` and open `http://localhost:8765/`.
3. Top row reads, left → right:
   `❤️❤️❤️ 0 ……………… 🍴 [hunger] 🕒 [survival]`.
4. Score number updates (eat a leaf → "1", apple → "11", survive a
   month → "+50"). No "SCORE" word.
5. Resize the window narrow (~480 px) — bars shrink but stay clear of
   the score; nothing overlaps the hearts.
6. The month label still reads inside the survival bar; the clock
   hand still sweeps; the food icon still draws at the left of the
   composite.
