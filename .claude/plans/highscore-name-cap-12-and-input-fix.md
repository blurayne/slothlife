# Plan: highscore name cap 8 → 12 + fix the type-past-limit bug

## Context

User reported the name-entry dialog after a qualifying score
felt cramped at 8 chars and asked for **at least 12**. They also
noticed the visible field accepted **more characters than the
limit allowed**, so the typed name and the saved name disagreed.

Audit confirmed both:

* `index.html` `maxlength="8"` counts UTF-16 code units. Every
  JS sanitiser in the codebase counts code points (`[...str]`
  spread). Emoji and non-BMP chars (each 2 UTF-16 units = 1
  code point) overflow the JS limit before the browser stops
  them at 8 units. Net effect: the field visibly accepts e.g.
  4 emoji = 8 units = browser-cap, but the JS slice keeps only
  4 — disagreement.
* No `input` event listener was wired to `#ov-name-input`, so
  the only client-side cap before submit was the broken HTML
  `maxlength`. That's the root cause.

## Changes

* **`assets/main.js`**:
   * New `MAX_NAME_LEN = 12` constant near the leaderboard
     config block. Single source of truth client-side.
   * `insertHighscore` and the SAVE SCORE click handler swap
     `.slice(0, 8)` for `.slice(0, MAX_NAME_LEN)`.
   * New `input` event listener on `#ov-name-input` that
     mirrors the submit-time sanitiser: spread to code points,
     slice, join, write back. Cursor preserved via
     `setSelectionRange` so paste-into-the-middle doesn't jump
     the caret to the end on every overflow. Fires on typing,
     paste, drag-drop, IME commit, and programmatic `.value=`,
     so every overflow vector is covered.
* **`index.html`**: `maxlength="8"` → `12`; helper text
  "max 8 characters" → "max 12 characters".
* **`convex/highscores.ts`**: server-side handler `cps.slice(0, 8)`
  → `cps.slice(0, 12)`. Inline `12` (file is small; comment
  block above already names the rule).
* **`convex/schema.ts`**: comment "clipped to 8 chars" →
  "clipped to 12 chars".

## Critical files

- `assets/main.js` — constant + 2× slice + input listener.
- `index.html` — maxlength + helper text.
- `convex/highscores.ts` — slice in submit handler.
- `convex/schema.ts` — comment.

## Verification

1. Type 20 ASCII letters → field stops at 12.
2. Paste 30 chars → field truncates to 12 on `input`.
3. Paste 15 emoji (each 2 UTF-16 units = 30 units, but 15 code
   points) → field caps at 12 emoji, not 12 UTF-16 units.
4. Paste in the middle of "ABC" → cursor preserved at the paste
   point, not jumped to end.
5. Submit a 12-char name → leaderboard shows the full name on
   start screen, end screen, and the top-100 dialog (after
   Convex deploy lands).

## Deploy coordination

Client + server must ship in lock-step. GitHub Pages auto-deploys
on push to main; Convex needs `npx convex deploy` separately.
Until both are live, a 12-char client submission to an old 8-char
server gets truncated and the optimistic client display is
overwritten on the next leaderboard refresh. Run the Convex
deploy in the same window as the push.

## Shipped

- `04bb291` — name cap 8 → 12 + live code-point-aware input cap.
