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
  restart.

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
Rendering and input are verified by playing it in a browser.

## Out of scope

Sound, levels/obstacles, online leaderboards, skins.
