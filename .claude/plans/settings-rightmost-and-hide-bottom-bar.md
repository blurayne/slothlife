# Settings as rightmost icon + hide bottom bar when panel is open

## Context

Current bottom-right corner has three icon buttons in this order
(left → right): **settings (gear)**, **sound**, **fullscreen**, at
`right: 114px / 66px / 18px`. The user wants the gear to be the
**rightmost** icon — i.e. the one farthest to the right of the screen
— since it's the primary entry point into the panel.

Additionally, while the settings panel is open, the other bottom
buttons (sound, fullscreen, and even the gear itself in some readings,
but the gear must remain reachable to close the panel) should hide so
the panel feels modal and the corner stays clean.

## Changes

### `assets/styles.css`

- Swap the `right:` offsets so the gear sits at `right: 18px`
  (rightmost), sound at `right: 66px`, fullscreen at `right: 114px`:

  ```css
  #ic-full     { right:114px; }
  #ic-sound    { right:66px;  }
  #ic-settings { right:18px;  }
  ```

- Add a body-level state class that hides the non-settings icon
  buttons while the panel is open:

  ```css
  body.panel-open .icon-btn:not(#ic-settings){
    opacity: 0;
    pointer-events: none;
    transition: opacity .18s;
  }
  ```

  (The gear itself stays visible so the user can close the panel from
  the same spot.)

### `assets/main.js`

In `applyPanelState()` (around line 105), toggle the new body class so
the CSS rule above engages:

```js
function applyPanelState(){
  panel.classList.toggle('hidden', !panelOpen);
  icSettings.classList.toggle('active', panelOpen);
  document.body.classList.toggle('panel-open', panelOpen);
}
```

Nothing else changes — the existing click-outside-to-close handler
already covers tapping the canvas to dismiss.

## Critical files

- `assets/styles.css` — three `#ic-*` right offsets + new
  `body.panel-open .icon-btn:not(#ic-settings)` rule
- `assets/main.js` — single line in `applyPanelState`

## Verification

1. `node --check assets/main.js`.
2. `python3 -m http.server 8765` and open `http://localhost:8765/`.
3. Confirm the rightmost icon at the bottom is now the gear.
4. Click the gear → panel slides in, sound + fullscreen icons fade out.
5. Click the gear again (or tap the canvas) → panel closes, sound +
   fullscreen icons fade back in.
6. Click sound or fullscreen with the panel closed — they still work.
