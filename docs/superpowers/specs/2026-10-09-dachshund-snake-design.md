# Dachshund Snake — Design

## Intent

A casual, shareable browser game: classic Snake, except the snake is a
dachshund that only ever gets longer. Built for fun; success is a link you
can send to someone and they're playing (and smiling) within seconds, on
desktop or phone.

## Approach

Plain HTML/CSS/JS, no build step, no runtime dependencies. Hosted on GitHub
Pages from `main` in the public repo `jlwilk/dachshund-snake`.

## Gameplay

- Grid: 20×20 cells, square canvas scaled to fit the viewport.
- Tick-based movement. Starting tick 150 ms; each treat eaten reduces it by
  3 ms, floored at 70 ms.
- Pup starts length 3 in the middle, heading right.
- One treat on the board at a time, placed on a random empty cell.
- Eating a treat: +1 score, +1 segment (the pup never shrinks).
- Death: moving into a wall or into its own body ends the round. Moving into
  the cell the tail is vacating this tick is allowed.
- Reversing direction directly (e.g. right → left) is ignored. Direction
  changes are queued (max 2) so quick turns between ticks aren't lost.
- Game over screen shows score, best score, and a length line:
  "Your pup reached N cm of pure sausage" (each segment = 15 cm, so length
  is shown in cm under 100 and metres above).
- Best score saved in `localStorage` (wrapped in try/catch; game works
  without it).
- States: ready (press any arrow / tap to start), playing, paused, over.

## Controls

- Desktop: arrow keys or WASD to steer; Space/P to pause; Enter/Space to
  restart after game over.
- Mobile: swipe on the board to steer (min 24 px swipe); tap to start or
  restart. Also an on-screen D-pad (see Phone support) for players who
  prefer buttons.

## Phone support

Phones are a first-class target, not an afterthought.

- Viewport meta with `width=device-width, initial-scale=1,
  viewport-fit=cover`; layout respects safe-area insets (notch, home bar).
- Portrait-first layout: HUD on top, square board sized to
  `min(available width, available height minus HUD and D-pad)`, D-pad
  below. Landscape works too: the board fills the height and the D-pad sits
  beside it.
- Canvas is rendered at `devicePixelRatio` so the pup stays crisp on retina
  screens; resizes on orientation change.
- Touch handling: `touch-action: none` on the game area and
  `preventDefault` on touch moves, so swiping steers instead of scrolling
  the page, pull-to-refresh, or zooming. No double-tap zoom, no text
  selection or long-press callouts.
- Swipe direction is read as soon as the finger passes the threshold
  (not on lift), so turns feel immediate; one swipe = one turn.
- D-pad: four large (≥ 56 px) arrow buttons, shown only on touch devices
  (`pointer: coarse`), responding on `pointerdown` rather than click to
  avoid delay. A pause button sits in the HUD.
- Auto-pause when the tab is hidden or the phone is locked
  (`visibilitychange`).
- Verified in Chrome DevTools device emulation (iPhone and Android sizes,
  both orientations) in addition to desktop.

## Look

All drawn on canvas — no image assets.

- Field: warm two-tone green checkerboard.
- Body: one continuous rounded brown "sausage" stroked along segment
  centres (thick line with round joins/caps), so corners curve smoothly.
  Lighter tan belly stroke on top for depth.
- Legs: short dark-brown stubs on alternating segments, toggling each tick
  for a trotting look.
- Head: rounded skull, elongated snout, black nose, eye, and a floppy ear
  that flaps slightly on each move; rotated to face the travel direction.
- Tail: tapered, wagging (sinusoidal angle over time).
- Treat: a little bone.
- Overlay text (score, messages) in HTML above the canvas, not on it.
- Animation: render loop on `requestAnimationFrame`, interpolating segment
  positions between ticks so motion is smooth.

## Files

- `index.html` — page, canvas, HUD, overlays, styles.
- `game.js` — pure game logic: `createGame(opts)`, `queueDirection(state,
  dir)`, `step(state, rng)` returning the new state and an event
  (`'ate' | 'died' | null`). No DOM access. ES module.
- `render.js` — `draw(ctx, state, prevState, t, alpha)`; all dachshund
  drawing.
- `input.js` — keyboard and swipe handlers mapping to directions/actions.
- `main.js` — wires together state, timing loop, input, render, HUD,
  localStorage.
- `tests/game.test.js` — `node --test` tests for game rules.
- `README.md` — what it is, play link, how to run locally.

## Testing

`node --test` against `game.js` covering: movement, growth on eating, wall
death, self-collision death, tail-vacating move allowed, reversal ignored,
direction queue, treat never spawns on the pup, speed-up and floor.
Rendering and input are verified by playing it in a browser, on desktop and in phone emulation.

## Pick your pup

Added 2026-10-09 at the user's request.

- Two independent choices, 12 combinations:
  - **Color:** Red (classic brown), Black & tan (near-black body with tan
    muzzle, eyebrow dots and legs), Dapple (brown base with irregular
    lighter patches that stay put on the body as it moves), Cream (pale
    golden).
  - **Coat:** Smooth (short hair, the original look), Long-haired (feathery
    fringe along the body, longer wavy ears, plumed tail), Wire-haired
    (bushy eyebrows and beard on the muzzle, scruffy body texture, shorter
    ears).
- Chosen on the start card and the game-over card (not while paused), as
  two rows of chip buttons. The card shows its own small live preview of
  the pup in the chosen look, because the card covers the pup on the board.
- Choosing a chip never starts or restarts the game; on phones a tap on a
  chip is not a board tap.
- The choice is remembered in `localStorage` (try/catch, same as best
  score); unknown or missing stored values fall back to Red / Smooth.

## Out of scope

Sound, levels/obstacles, online leaderboards.
