# Eating mouth animation + sleep lock

## Context

When the sloth successfully consumes a leaf or apple, hunger ticks up
and the eat sound plays, but there's no facial feedback — the smile
stays static. The user wants a 2-second chew animation on the mouth,
and during that window the sloth must not be able to fall asleep
(idle-sleep would otherwise interrupt the eating animation and look
janky).

## Changes

### `assets/main.js`

- **New field** in `Sloth` constructor next to `eatProgress` (around
  line 1728):

  ```js
  this.mouthChewT = 0;          // seconds remaining of chew animation
  ```

- **Decrement each frame** in `Sloth.update`, just after the existing
  `this.stateT += dt;` (line 1762):

  ```js
  if(this.mouthChewT > 0) this.mouthChewT = Math.max(0, this.mouthChewT - dt);
  ```

- **Trigger on consume** — set the timer to 2.0s only when food is
  actually eaten. In `_consumeEatTarget`:
  - Inside the `kind === 'leaf'` branch (after `Audio.playEatLeaf();`):
    `this.mouthChewT = 2.0;`
  - Inside the `kind === 'apple'` branch, *inside* the existing
    `if(f && f.alive !== false)` block (after `Audio.playEatApple();`):
    `this.mouthChewT = 2.0;`

- **Render the chew animation** in the head/face draw section. The
  existing smile (lines 2816-2830) becomes the `else` branch of:

  ```js
  if(this.mouthChewT > 0){
    // Chewing: open/close oscillation. 4 chews across the 2-second
    // window; oval mouth fills with a hint of pink "tongue" when open.
    const t = 2 - this.mouthChewT;                       // 0..2 seconds elapsed
    const open = 0.5 - 0.5 * Math.cos(t * Math.PI * 4);  // 0..1, four cycles
    ctx.fillStyle = '#1A0A04';
    ctx.beginPath();
    ctx.ellipse(bx, hy + 4.7, 2.4, 0.6 + open * 1.8, 0, 0, PI*2);
    ctx.fill();
    if(open > 0.4){
      ctx.fillStyle = 'rgba(220,130,110,0.75)';
      ctx.beginPath();
      ctx.ellipse(bx, hy + 5.1, 1.2, 0.4 * (open - 0.4), 0, 0, PI*2);
      ctx.fill();
    }
  } else {
    // existing GENTLE SMILE block
  }
  ```

- **Block idle-sleep while chewing** in the sleep gate (line 5369):

  ```js
  if(sloth && userIdleT > 3 && sloth.state === 'HANGING' &&
     !isSummerHungry && sloth.mouthChewT <= 0){
    sloth.state = 'SLEEPING';
    ...
  }
  ```

## Critical files

- `assets/main.js` — Sloth constructor, `update`, `_consumeEatTarget`,
  face-draw block (around line 2816), sleep gate (~line 5369).

## Verification

1. `node --check assets/main.js`.
2. `python3 -m http.server 8765`, open `http://localhost:8765/`.
3. Eat a leaf → mouth opens/closes ~4 times over 2 s, then returns to
   the resting smile.
4. Eat an apple → same chew animation; popup `+10` still appears.
5. Stop touching the screen for >3 s right after eating → the sloth
   should **not** fall asleep until the 2-second chew has finished.
6. Eat repeatedly → no flicker between smile and chew oval (timer
   resets cleanly).
