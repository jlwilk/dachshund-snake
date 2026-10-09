# Dachshund Snake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser Snake game where the snake is a cartoon dachshund that only gets longer, playable on desktop and phone, published on GitHub Pages.

**Architecture:** Static site, no build. `game.js` holds pure, immutable game rules; `input.js` maps keys/swipes/D-pad to actions; `render.js` draws everything on a canvas; `best.js` persists the best score; `main.js` wires them together with a `requestAnimationFrame` loop that steps the game on a fixed tick and interpolates between ticks.

**Tech Stack:** Vanilla ES modules, Canvas 2D, CSS. Tests with Node 24's built-in `node --test` (no npm dependencies). Local serving with `python3 -m http.server`. Hosting on GitHub Pages via `gh`.

**Spec:** `docs/superpowers/specs/2026-10-09-dachshund-snake-design.md`

## Global Constraints

- No runtime or dev dependencies; no build step. `package.json` exists only for `"type": "module"` and the test script.
- Grid 20×20. Start tick 150 ms, −3 ms per treat, floor 70 ms. Start length 3, centred, heading right.
- Each segment = 15 cm; length label in cm under 100, metres at 100 and above.
- Best score in `localStorage`, every access wrapped in try/catch; game must work without it.
- Phones are first-class: `touch-action: none` on the play area, D-pad buttons ≥ 56 px shown only under `(pointer: coarse)`, respond on `pointerdown`, safe-area insets respected, canvas rendered at `devicePixelRatio`, auto-pause on `visibilitychange`.
- Commit messages: plain, no `Co-Authored-By` trailer (user preference).

## Review Focus

1. Two quick turns between ticks (e.g. Up then Left while heading Right) → both turns apply in order on successive ticks; the pup must not reverse into itself. (Task 1 test: "queued double turn applies over two ticks")
2. Board completely filled → no treat spawns, no crash; the game continues until the pup bonks. (Task 1 tests: "placeTreat returns null on a full board", "step works with no treat")
3. Private browsing / blocked storage → best score reads as 0, saving silently does nothing, game plays normally. (Task 3 tests in `tests/best.test.js`)
4. A tap, or a short wobbly or diagonal swipe → a tap is never read as a turn, and a diagonal swipe picks its dominant axis. (Task 2 tests: "short moves are not swipes", "diagonal picks dominant axis")
5. Returning to a backgrounded tab or a long frame → no burst of catch-up moves that kills the pup off-screen; the game is paused when you come back. (Task 3: frame delta clamped to 250 ms + `visibilitychange` pause; checked manually in Step 6)

---

### Task 1: Game rules

**Files:**
- Create: `package.json`, `game.js`, `tests/game.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (all exported from `game.js`):
  - `GRID = 20`, `START_TICK_MS = 150`, `TICK_STEP_MS = 3`, `MIN_TICK_MS = 70`, `CM_PER_SEGMENT = 15`
  - `DIRS: { up|down|left|right: {x, y} }`
  - `type Cell = {x: number, y: number}`
  - `type Game = { size, snake: Cell[] /* head first */, dir, queue: string[], treat: Cell|null, score, tickMs, alive }`
  - `createGame({ size = GRID, rng = Math.random } = {}): Game`
  - `placeTreat(size, snake, rng): Cell|null`
  - `queueDirection(game, dir): Game`
  - `step(game, rng = Math.random): { state: Game, event: 'ate'|'died'|null }`
  - `lengthLabel(segments): string`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "dachshund-snake",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write the failing tests** in `tests/game.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, queueDirection, step, placeTreat, lengthLabel,
  START_TICK_MS, MIN_TICK_MS,
} from '../game.js';

const zero = () => 0;
const onSnake = (snake, c) => snake.some(s => s.x === c.x && s.y === c.y);
const game5 = overrides => ({ ...createGame({ size: 5, rng: zero }), ...overrides });

test('new game: length 3, centred, heading right', () => {
  const g = createGame({ rng: zero });
  assert.deepEqual(g.snake, [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
  assert.equal(g.dir, 'right');
  assert.equal(g.score, 0);
  assert.equal(g.tickMs, START_TICK_MS);
  assert.equal(g.alive, true);
  assert.ok(g.treat && !onSnake(g.snake, g.treat));
});

test('step moves forward without growing', () => {
  const g = game5({ snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }], treat: { x: 4, y: 4 } });
  const { state, event } = step(g, zero);
  assert.equal(event, null);
  assert.deepEqual(state.snake, [{ x: 3, y: 2 }, { x: 2, y: 2 }, { x: 1, y: 2 }]);
});

test('eating grows by one, scores, speeds up, respawns treat off the pup', () => {
  const g = game5({ snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }], treat: { x: 3, y: 2 } });
  const { state, event } = step(g, zero);
  assert.equal(event, 'ate');
  assert.deepEqual(state.snake, [{ x: 3, y: 2 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }]);
  assert.equal(state.score, 1);
  assert.equal(state.tickMs, START_TICK_MS - 3);
  assert.ok(state.treat && !onSnake(state.snake, state.treat));
});

test('speed never goes below the floor', () => {
  const base = { snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }], treat: { x: 3, y: 2 } };
  assert.equal(step(game5({ ...base, tickMs: 71 }), zero).state.tickMs, MIN_TICK_MS);
  assert.equal(step(game5({ ...base, tickMs: MIN_TICK_MS }), zero).state.tickMs, MIN_TICK_MS);
});

test('hitting a wall kills the pup and leaves it in place', () => {
  const snake = [{ x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }];
  const { state, event } = step(game5({ snake, treat: { x: 0, y: 0 } }), zero);
  assert.equal(event, 'died');
  assert.equal(state.alive, false);
  assert.deepEqual(state.snake, snake);
});

test('running into its own body kills the pup', () => {
  const g = game5({
    snake: [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 1, y: 0 }],
    dir: 'up',
    treat: { x: 4, y: 4 },
  });
  const { state, event } = step(queueDirection(g, 'left'), zero);
  assert.equal(event, 'died');
  assert.equal(state.alive, false);
});

test('moving into the cell the tail is leaving is allowed', () => {
  const g = game5({
    snake: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }],
    dir: 'up',
    treat: { x: 4, y: 4 },
  });
  const { state, event } = step(queueDirection(g, 'left'), zero);
  assert.equal(event, null);
  assert.equal(state.alive, true);
  assert.deepEqual(state.snake, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
});

test('reversing direction is ignored', () => {
  const g = createGame({ rng: zero });
  assert.deepEqual(queueDirection(g, 'left').queue, []);
});

test('repeating the current direction is ignored and queue holds at most 2', () => {
  let g = createGame({ rng: zero });
  g = queueDirection(g, 'right');
  assert.deepEqual(g.queue, []);
  g = queueDirection(g, 'up');
  g = queueDirection(g, 'left');
  g = queueDirection(g, 'down');
  assert.deepEqual(g.queue, ['up', 'left']);
});

test('queued double turn applies over two ticks', () => {
  let g = game5({ snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }], treat: { x: 4, y: 4 } });
  g = queueDirection(queueDirection(g, 'up'), 'left');
  g = step(g, zero).state;
  assert.equal(g.dir, 'up');
  assert.deepEqual(g.snake[0], { x: 2, y: 1 });
  g = step(g, zero).state;
  assert.equal(g.dir, 'left');
  assert.deepEqual(g.snake[0], { x: 1, y: 1 });
  assert.equal(g.alive, true);
});

test('placeTreat picks the only free cell', () => {
  const snake = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
  assert.deepEqual(placeTreat(2, snake, () => 0.99), { x: 0, y: 1 });
});

test('placeTreat returns null on a full board', () => {
  const snake = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  assert.equal(placeTreat(2, snake, zero), null);
});

test('step works with no treat on the board', () => {
  const g = game5({ snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }], treat: null });
  const { state, event } = step(g, zero);
  assert.equal(event, null);
  assert.deepEqual(state.snake[0], { x: 3, y: 2 });
});

test('a dead pup does not move', () => {
  const g = game5({ alive: false });
  const { state, event } = step(g, zero);
  assert.equal(event, null);
  assert.equal(state, g);
});

test('lengthLabel shows cm under a metre and metres above', () => {
  assert.equal(lengthLabel(3), '45 cm');
  assert.equal(lengthLabel(6), '90 cm');
  assert.equal(lengthLabel(10), '1.5 m');
  assert.equal(lengthLabel(20), '3 m');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../game.js'`.

- [ ] **Step 4: Implement `game.js`**

```js
export const GRID = 20;
export const START_TICK_MS = 150;
export const TICK_STEP_MS = 3;
export const MIN_TICK_MS = 70;
export const CM_PER_SEGMENT = 15;

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const MAX_QUEUE = 2;

export function createGame({ size = GRID, rng = Math.random } = {}) {
  const mid = Math.floor(size / 2);
  const snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
  return {
    size,
    snake,
    dir: 'right',
    queue: [],
    treat: placeTreat(size, snake, rng),
    score: 0,
    tickMs: START_TICK_MS,
    alive: true,
  };
}

export function placeTreat(size, snake, rng) {
  const taken = new Set(snake.map(c => c.y * size + c.x));
  const free = [];
  for (let i = 0; i < size * size; i++) if (!taken.has(i)) free.push(i);
  if (free.length === 0) return null;
  const i = free[Math.floor(rng() * free.length)];
  return { x: i % size, y: Math.floor(i / size) };
}

export function queueDirection(game, dir) {
  if (!DIRS[dir] || game.queue.length >= MAX_QUEUE) return game;
  const last = game.queue.length ? game.queue[game.queue.length - 1] : game.dir;
  if (dir === last || dir === OPPOSITE[last]) return game;
  return { ...game, queue: [...game.queue, dir] };
}

export function step(game, rng = Math.random) {
  if (!game.alive) return { state: game, event: null };

  const [queued, ...rest] = game.queue;
  const dir = queued ?? game.dir;
  const base = { ...game, dir, queue: queued ? rest : game.queue };
  const head = game.snake[0];
  const next = { x: head.x + DIRS[dir].x, y: head.y + DIRS[dir].y };

  const offBoard = next.x < 0 || next.y < 0 || next.x >= game.size || next.y >= game.size;
  if (offBoard) return { state: { ...base, alive: false }, event: 'died' };

  const eats = game.treat !== null && next.x === game.treat.x && next.y === game.treat.y;
  const body = eats ? game.snake : game.snake.slice(0, -1);
  if (body.some(c => c.x === next.x && c.y === next.y)) {
    return { state: { ...base, alive: false }, event: 'died' };
  }

  const snake = [next, ...body];
  if (!eats) return { state: { ...base, snake }, event: null };

  return {
    state: {
      ...base,
      snake,
      score: game.score + 1,
      tickMs: Math.max(MIN_TICK_MS, game.tickMs - TICK_STEP_MS),
      treat: placeTreat(game.size, snake, rng),
    },
    event: 'ate',
  };
}

export function lengthLabel(segments) {
  const cm = segments * CM_PER_SEGMENT;
  return cm < 100 ? `${cm} cm` : `${+(cm / 100).toFixed(1)} m`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all 15 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json game.js tests/game.test.js
git commit -m "Add game rules with tests"
```

---

### Task 2: Input mapping

**Files:**
- Create: `input.js`, `tests/input.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (exported from `input.js`):
  - `SWIPE_THRESHOLD_PX = 24`
  - `keyToAction(key: string): {type:'direction', dir} | {type:'primary'} | {type:'pause'} | null`
  - `swipeDirection(dx, dy, threshold = SWIPE_THRESHOLD_PX): 'up'|'down'|'left'|'right'|null`
  - `attachInput({ keyTarget, board, dpad, pauseButton, onDirection(dir), onPrimary(), onPause(), onTap() }): void` — `board` is the element that receives swipes/taps; `dpad` contains `button[data-dir]`.

- [ ] **Step 1: Write the failing tests** in `tests/input.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyToAction, swipeDirection } from '../input.js';

test('arrow keys and WASD steer', () => {
  assert.deepEqual(keyToAction('ArrowUp'), { type: 'direction', dir: 'up' });
  assert.deepEqual(keyToAction('ArrowLeft'), { type: 'direction', dir: 'left' });
  assert.deepEqual(keyToAction('s'), { type: 'direction', dir: 'down' });
  assert.deepEqual(keyToAction('D'), { type: 'direction', dir: 'right' });
});

test('space and enter are primary, P pauses, others ignored', () => {
  assert.deepEqual(keyToAction(' '), { type: 'primary' });
  assert.deepEqual(keyToAction('Enter'), { type: 'primary' });
  assert.deepEqual(keyToAction('p'), { type: 'pause' });
  assert.deepEqual(keyToAction('P'), { type: 'pause' });
  assert.equal(keyToAction('x'), null);
  assert.equal(keyToAction('Shift'), null);
});

test('swipes map to directions', () => {
  assert.equal(swipeDirection(40, 0), 'right');
  assert.equal(swipeDirection(-40, 0), 'left');
  assert.equal(swipeDirection(0, 40), 'down');
  assert.equal(swipeDirection(0, -40), 'up');
});

test('short moves are not swipes', () => {
  assert.equal(swipeDirection(0, 0), null);
  assert.equal(swipeDirection(10, -12), null);
});

test('diagonal picks dominant axis', () => {
  assert.equal(swipeDirection(30, 20), 'right');
  assert.equal(swipeDirection(-15, -30), 'up');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../input.js'`.

- [ ] **Step 3: Implement `input.js`**

```js
export const SWIPE_THRESHOLD_PX = 24;

const KEY_DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};

export function keyToAction(key) {
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (KEY_DIRS[k]) return { type: 'direction', dir: KEY_DIRS[k] };
  if (k === ' ' || k === 'Enter') return { type: 'primary' };
  if (k === 'p') return { type: 'pause' };
  return null;
}

export function swipeDirection(dx, dy, threshold = SWIPE_THRESHOLD_PX) {
  if (Math.hypot(dx, dy) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

export function attachInput({ keyTarget, board, dpad, pauseButton, onDirection, onPrimary, onPause, onTap }) {
  keyTarget.addEventListener('keydown', e => {
    const action = keyToAction(e.key);
    if (!action) return;
    e.preventDefault();
    if (action.type === 'direction') onDirection(action.dir);
    else if (e.repeat) return;
    else if (action.type === 'primary') onPrimary();
    else onPause();
  });

  // One gesture = at most one turn, fired as soon as the threshold is crossed.
  let gesture = null;
  board.addEventListener('pointerdown', e => {
    e.preventDefault();
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false };
    board.setPointerCapture?.(e.pointerId);
  });
  board.addEventListener('pointermove', e => {
    if (!gesture || gesture.id !== e.pointerId || gesture.fired) return;
    const dir = swipeDirection(e.clientX - gesture.x, e.clientY - gesture.y);
    if (dir) {
      gesture.fired = true;
      onDirection(dir);
    }
  });
  const endGesture = e => {
    if (!gesture || gesture.id !== e.pointerId) return;
    if (!gesture.fired && e.type === 'pointerup') onTap();
    gesture = null;
  };
  board.addEventListener('pointerup', endGesture);
  board.addEventListener('pointercancel', endGesture);

  dpad.addEventListener('pointerdown', e => {
    const button = e.target.closest('button[data-dir]');
    if (!button) return;
    e.preventDefault();
    onDirection(button.dataset.dir);
  });

  pauseButton.addEventListener('click', () => {
    pauseButton.blur();
    onPause();
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all game and input tests PASS.

- [ ] **Step 5: Commit**

```bash
git add input.js tests/input.test.js
git commit -m "Add keyboard, swipe and D-pad input"
```

---

### Task 3: Playable page — renderer, best score, wiring, phone layout

**Files:**
- Create: `render.js`, `best.js`, `main.js`, `index.html`, `.nojekyll`, `tests/render.test.js`, `tests/best.test.js`

**Interfaces:**
- Consumes: everything from Task 1 (`createGame`, `queueDirection`, `step`, `lengthLabel`, `DIRS`) and `attachInput` from Task 2.
- Produces:
  - `render.js`: `draw(ctx, { game, prev, alpha, time, tick, px })` and `bodyPath(game, prev, alpha, cell): {x,y}[]` (pixel points, head first).
  - `best.js`: `getStorage(): Storage|null`, `loadBest(storage): number`, `saveBest(storage, n): void`.
  - Note: the spec sketched `draw(ctx, state, prevState, t, alpha)`; it takes a single view object instead so the pixel size and tick count can be passed too.

- [ ] **Step 1: Write failing tests** in `tests/best.test.js` and `tests/render.test.js`

`tests/best.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBest, saveBest } from '../best.js';

const memory = () => {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
};
const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

test('saves and loads the best score', () => {
  const s = memory();
  saveBest(s, 12);
  assert.equal(loadBest(s), 12);
});

test('missing or junk values read as 0', () => {
  assert.equal(loadBest(memory()), 0);
  const s = memory();
  s.setItem('dachshund-snake:best', 'woof');
  assert.equal(loadBest(s), 0);
});

test('no storage or blocked storage never throws', () => {
  assert.equal(loadBest(null), 0);
  assert.equal(loadBest(broken), 0);
  assert.doesNotThrow(() => saveBest(null, 5));
  assert.doesNotThrow(() => saveBest(broken, 5));
});
```

`tests/render.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodyPath } from '../render.js';

const game = snake => ({ size: 5, snake });

test('body path interpolates head and tail, keeps middle on grid', () => {
  const prev = game([{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }]);
  const cur = game([{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]);
  assert.deepEqual(bodyPath(cur, prev, 0.5, 10), [
    { x: 20, y: 5 },
    { x: 15, y: 5 },
    { x: 5, y: 5 },
    { x: 5, y: 10 },
  ]);
});

test('after growing, the tail stays put', () => {
  const prev = game([{ x: 1, y: 0 }, { x: 0, y: 0 }]);
  const cur = game([{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]);
  assert.deepEqual(bodyPath(cur, prev, 0.5, 10), [
    { x: 20, y: 5 },
    { x: 15, y: 5 },
    { x: 5, y: 5 },
  ]);
});

test('with no movement, path is just the cells', () => {
  const g = game([{ x: 1, y: 1 }, { x: 0, y: 1 }]);
  assert.deepEqual(bodyPath(g, g, 1, 10), [{ x: 15, y: 15 }, { x: 5, y: 15 }]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../best.js'` and `'.../render.js'`.

- [ ] **Step 3: Implement `best.js`**

```js
const KEY = 'dachshund-snake:best';

export function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadBest(storage) {
  try {
    const n = parseInt(storage?.getItem(KEY), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveBest(storage, n) {
  try {
    storage?.setItem(KEY, String(n));
  } catch {
    // Storage blocked (private mode etc.) — best score just won't persist.
  }
}
```

- [ ] **Step 4: Implement `render.js`**

```js
import { DIRS } from './game.js';

const COLORS = {
  grassA: '#a8d672',
  grassB: '#97c962',
  outline: '#6b3417',
  body: '#a65a2a',
  stripe: '#c98a55',
  leg: '#5a2b10',
  ear: '#6e3416',
  nose: '#1e1410',
  eye: '#1e1410',
  glint: '#ffffff',
  bone: '#fff6e3',
  boneEdge: '#d8c39c',
};

export function draw(ctx, { game, prev, alpha, time, tick, px }) {
  const cell = px / game.size;
  drawField(ctx, game.size, cell);
  if (game.treat) drawBone(ctx, game.treat, cell, time);
  const pts = bodyPath(game, prev, alpha, cell);
  drawTail(ctx, game, pts[pts.length - 1], cell, time);
  drawLegs(ctx, pts, cell, tick);
  drawBody(ctx, pts, cell);
  drawHead(ctx, game, pts[0], cell, tick);
}

// Head and tail slide between cells; everything in between sits on cell
// centres, so the body follows the grid and keeps a constant length.
export function bodyPath(game, prev, alpha, cell) {
  const s = game.snake;
  const before = prev ? prev.snake : s;
  const lerp = (a, b) => ({ x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha });
  const cells = s.slice();
  cells[0] = lerp(before[0], s[0]);
  const oldTail = before[s.length - 1];
  if (before !== s && oldTail) cells.push(lerp(oldTail, s[s.length - 1]));
  return cells.map(c => ({ x: (c.x + 0.5) * cell, y: (c.y + 0.5) * cell }));
}

function drawField(ctx, size, cell) {
  ctx.fillStyle = COLORS.grassA;
  ctx.fillRect(0, 0, size * cell, size * cell);
  ctx.fillStyle = COLORS.grassB;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x + y) % 2) ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
    }
  }
}

function drawBone(ctx, treat, cell, time) {
  const cx = (treat.x + 0.5) * cell;
  const cy = (treat.y + 0.5) * cell + Math.sin(time / 250) * cell * 0.05;
  const knob = cell * 0.1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.5);
  ctx.beginPath();
  ctx.roundRect(-cell * 0.28, -cell * 0.08, cell * 0.56, cell * 0.16, cell * 0.05);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ctx.moveTo(sx * cell * 0.3 + knob, sy * cell * 0.09);
      ctx.arc(sx * cell * 0.3, sy * cell * 0.09, knob, 0, Math.PI * 2);
    }
  }
  ctx.lineWidth = cell * 0.08;
  ctx.strokeStyle = COLORS.boneEdge;
  ctx.stroke();
  ctx.fillStyle = COLORS.bone;
  ctx.fill();
  ctx.restore();
}

function tracePath(ctx, pts, maxRadius) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const r = Math.min(maxRadius, dist(pts[i - 1], pts[i]), dist(pts[i], pts[i + 1]));
    ctx.arcTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, r);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

function drawBody(ctx, pts, cell) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  tracePath(ctx, pts, cell * 0.45);
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = cell * 0.78;
  ctx.stroke();
  ctx.strokeStyle = COLORS.body;
  ctx.lineWidth = cell * 0.66;
  ctx.stroke();
  ctx.strokeStyle = COLORS.stripe;
  ctx.lineWidth = cell * 0.2;
  ctx.stroke();
}

function drawLegs(ctx, pts, cell, tick) {
  const half = cell * 0.55;
  const w = cell * 0.16;
  ctx.fillStyle = COLORS.leg;
  for (let i = 1; i < pts.length - 1; i += 2) {
    const a = pts[i - 1];
    const b = pts[i + 1];
    const stride = ((i + tick) % 4 < 2 ? 1 : -1) * cell * 0.1;
    ctx.save();
    ctx.translate(pts[i].x, pts[i].y);
    ctx.rotate(Math.atan2(a.y - b.y, a.x - b.x));
    ctx.beginPath();
    ctx.roundRect(stride - w / 2, -half, w, half * 2, w / 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawTail(ctx, game, base, cell, time) {
  const s = game.snake;
  const n = s.length;
  const wag = Math.sin(time / 120) * 0.5;
  const len = cell * 0.75;
  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.rotate(Math.atan2(s[n - 1].y - s[n - 2].y, s[n - 1].x - s[n - 2].x) + wag);
  ctx.beginPath();
  ctx.moveTo(0, -cell * 0.14);
  ctx.quadraticCurveTo(len * 0.6, -cell * 0.08, len, 0);
  ctx.quadraticCurveTo(len * 0.6, cell * 0.08, 0, cell * 0.14);
  ctx.closePath();
  ctx.fillStyle = COLORS.body;
  ctx.fill();
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = cell * 0.05;
  ctx.stroke();
  ctx.restore();
}

function drawHead(ctx, game, at, cell, tick) {
  const d = DIRS[game.dir];
  const flap = tick % 2 ? 0.35 : 0.15;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(Math.atan2(d.y, d.x));
  ctx.lineWidth = cell * 0.06;
  ctx.strokeStyle = COLORS.outline;

  ctx.fillStyle = COLORS.ear;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(-cell * 0.08, side * cell * 0.3);
    ctx.rotate(side * flap);
    ellipse(ctx, -cell * 0.1, side * cell * 0.06, cell * 0.3, cell * 0.15);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = COLORS.body;
  ellipse(ctx, cell * 0.4, 0, cell * 0.36, cell * 0.22);
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, 0, 0, cell * 0.42, cell * 0.4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COLORS.nose;
  ellipse(ctx, cell * 0.74, 0, cell * 0.1, cell * 0.1);
  ctx.fill();

  for (const side of [-1, 1]) {
    ctx.fillStyle = COLORS.eye;
    ellipse(ctx, cell * 0.12, side * cell * 0.17, cell * 0.065, cell * 0.065);
    ctx.fill();
    ctx.fillStyle = COLORS.glint;
    ellipse(ctx, cell * 0.14, side * cell * 0.17 - cell * 0.02, cell * 0.022, cell * 0.022);
    ctx.fill();
  }
  ctx.restore();
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all game, input, best and render tests PASS.

- [ ] **Step 6: Create `index.html`, `main.js` and an empty `.nojekyll`**

`index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#f6ead8">
  <title>Dachshund Snake</title>
  <style>
    :root {
      --bg: #f6ead8;
      --ink: #4a2a14;
      --panel: #fffaf2;
      --button: #e9d3b5;
      --button-press: #d9bd97;
      --shadow: 0 6px 24px rgb(74 42 20 / 0.18);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #241912;
        --ink: #f6ead8;
        --panel: #3a2a1e;
        --button: #5a4130;
        --button-press: #6d5039;
        --shadow: 0 6px 24px rgb(0 0 0 / 0.4);
      }
    }
    html, body { height: 100%; margin: 0; }
    body {
      background: var(--bg);
      color: var(--ink);
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      overscroll-behavior: none;
      touch-action: manipulation;
      -webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
    }
    .app {
      box-sizing: border-box;
      height: 100dvh;
      max-width: 720px;
      margin: 0 auto;
      padding:
        max(12px, env(safe-area-inset-top))
        max(16px, env(safe-area-inset-right))
        max(12px, env(safe-area-inset-bottom))
        max(16px, env(safe-area-inset-left));
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      grid-template-areas: "hud" "stage" "dpad";
      gap: 12px;
    }
    .hud { grid-area: hud; display: flex; align-items: center; gap: 16px; font-weight: 600; }
    .hud b { font-size: 1.25rem; }
    .hud .spacer { flex: 1; }
    button {
      font: inherit;
      color: var(--ink);
      background: var(--button);
      border: 0;
      border-radius: 12px;
      cursor: pointer;
    }
    button:active { background: var(--button-press); }
    button:disabled { opacity: 0.4; cursor: default; }
    #pause { width: 44px; height: 44px; font-size: 1rem; }
    .stage { grid-area: stage; position: relative; min-width: 0; min-height: 0; touch-action: none; }
    #board {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      border-radius: 12px;
      box-shadow: var(--shadow);
    }
    .overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .overlay[hidden] { display: none; }
    .card {
      max-width: min(80%, 360px);
      padding: 16px 20px;
      border-radius: 14px;
      background: var(--panel);
      box-shadow: var(--shadow);
      text-align: center;
    }
    .card h1 { margin: 0 0 8px; font-size: 1.5rem; }
    .card p { margin: 6px 0; line-height: 1.4; }
    .card .hint { opacity: 0.75; font-size: 0.9rem; }
    .dpad {
      grid-area: dpad;
      display: none;
      grid-template-columns: repeat(3, 64px);
      grid-template-rows: repeat(2, 64px);
      gap: 8px;
      justify-content: center;
      touch-action: none;
    }
    .dpad button { font-size: 1.5rem; }
    .dpad [data-dir="up"] { grid-column: 2; grid-row: 1; }
    .dpad [data-dir="left"] { grid-column: 1; grid-row: 2; }
    .dpad [data-dir="down"] { grid-column: 2; grid-row: 2; }
    .dpad [data-dir="right"] { grid-column: 3; grid-row: 2; }
    @media (pointer: coarse) {
      .dpad { display: grid; }
    }
    @media (pointer: coarse) and (orientation: landscape) {
      .app {
        max-width: none;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-rows: auto minmax(0, 1fr);
        grid-template-areas: "hud hud" "stage dpad";
      }
      .dpad { align-content: center; }
    }
  </style>
</head>
<body>
  <main class="app">
    <header class="hud">
      <div>Score <b id="score">0</b></div>
      <div>Best <b id="best">0</b></div>
      <div class="spacer"></div>
      <button id="pause" type="button" aria-label="Pause">❚❚</button>
    </header>
    <div class="stage" id="stage">
      <canvas id="board" aria-label="Game board"></canvas>
      <div class="overlay" id="overlay">
        <div class="card">
          <h1 id="title">Dachshund Snake</h1>
          <p id="message"></p>
          <p class="hint" id="hint"></p>
        </div>
      </div>
    </div>
    <nav class="dpad" id="dpad" aria-label="Direction controls">
      <button type="button" data-dir="up" aria-label="Up">▲</button>
      <button type="button" data-dir="left" aria-label="Left">◀</button>
      <button type="button" data-dir="down" aria-label="Down">▼</button>
      <button type="button" data-dir="right" aria-label="Right">▶</button>
    </nav>
  </main>
  <script type="module" src="main.js"></script>
</body>
</html>
```

`main.js`:

```js
import { createGame, queueDirection, step, lengthLabel } from './game.js';
import { attachInput } from './input.js';
import { draw } from './render.js';
import { getStorage, loadBest, saveBest } from './best.js';

const MAX_FRAME_MS = 250;

const $ = id => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d');
const stage = $('stage');
const overlay = $('overlay');
const pauseButton = $('pause');

const isTouch = matchMedia('(pointer: coarse)').matches;
const HINTS = isTouch
  ? { start: 'Swipe or use the arrows to steer. Tap to start.', resume: 'Tap to keep going.', restart: 'Tap to play again.' }
  : { start: 'Arrow keys or WASD to steer. Press an arrow or Space to start.', resume: 'Press Space to keep going.', restart: 'Press Space or Enter to play again.' };

const storage = getStorage();
let best = loadBest(storage);
let game = createGame();
let prev = game;
let phase = 'ready';
let acc = 0;
let tick = 0;
let last = performance.now();
let boardPx = 0;

function showOverlay(title, message, hint) {
  $('title').textContent = title;
  $('message').textContent = message;
  $('hint').textContent = hint;
  overlay.hidden = false;
}

function setPhase(next) {
  phase = next;
  pauseButton.disabled = phase === 'ready' || phase === 'over';
  pauseButton.textContent = phase === 'paused' ? '▶' : '❚❚';
  pauseButton.setAttribute('aria-label', phase === 'paused' ? 'Resume' : 'Pause');
  if (phase === 'playing') overlay.hidden = true;
  if (phase === 'ready') showOverlay('Dachshund Snake', 'Eat the bones. Grow the pup. Don’t bonk.', HINTS.start);
  if (phase === 'paused') showOverlay('Paused', 'Good pup. Take a breather.', HINTS.resume);
  if (phase === 'over') {
    showOverlay(
      'Bonk!',
      `Your pup reached ${lengthLabel(game.snake.length)} of pure sausage.`,
      `Score ${game.score} · Best ${best}. ${HINTS.restart}`,
    );
  }
}

function updateHud() {
  $('score').textContent = game.score;
  $('best').textContent = best;
}

function startGame() {
  game = createGame();
  prev = game;
  acc = 0;
  tick = 0;
  updateHud();
  setPhase('playing');
}

function gameOver() {
  if (game.score > best) {
    best = game.score;
    saveBest(storage, best);
  }
  updateHud();
  setPhase('over');
}

function togglePause() {
  if (phase === 'playing') setPhase('paused');
  else if (phase === 'paused') setPhase('playing');
}

function onDirection(dir) {
  if (phase === 'over') return;
  if (phase === 'ready') startGame();
  else if (phase === 'paused') setPhase('playing');
  game = queueDirection(game, dir);
}

function onPrimary() {
  if (phase === 'ready' || phase === 'over') startGame();
  else togglePause();
}

function onTap() {
  if (phase !== 'playing') onPrimary();
}

function fit() {
  const size = Math.floor(Math.min(stage.clientWidth, stage.clientHeight));
  if (size <= 0) return;
  const dpr = window.devicePixelRatio || 1;
  boardPx = size;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  ctx.setTransform(canvas.width / size, 0, 0, canvas.height / size, 0, 0);
}

function frame(now) {
  // Clamp so a long frame (tab switch, slow device) can't fire a burst of moves.
  const dt = Math.min(now - last, MAX_FRAME_MS);
  last = now;
  if (phase === 'playing') {
    acc += dt;
    while (phase === 'playing' && acc >= game.tickMs) {
      acc -= game.tickMs;
      prev = game;
      const { state, event } = step(game);
      game = state;
      tick++;
      if (event === 'ate') updateHud();
      if (event === 'died') gameOver();
    }
  }
  const moving = phase === 'playing' || phase === 'paused';
  const alpha = moving ? Math.min(acc / game.tickMs, 1) : 1;
  if (boardPx > 0) draw(ctx, { game, prev, alpha, time: now, tick, px: boardPx });
  requestAnimationFrame(frame);
}

attachInput({
  keyTarget: window,
  board: stage,
  dpad: $('dpad'),
  pauseButton,
  onDirection,
  onPrimary,
  onPause: togglePause,
  onTap,
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && phase === 'playing') setPhase('paused');
});

new ResizeObserver(fit).observe(stage);
fit();
updateHud();
setPhase('ready');
requestAnimationFrame(frame);
```

Create `.nojekyll` (empty file) so GitHub Pages serves the files as-is:

```bash
touch .nojekyll
```

- [ ] **Step 7: Verify on desktop in a browser**

Run: `python3 -m http.server 8000` (background), then open `http://localhost:8000/` with the chrome-devtools MCP tools.

Check, taking screenshots:
- Ready card shows; the pup (head, ears, nose, eyes, legs, tail) and a bone are visible on the checkered field; console has no errors.
- Press ArrowRight / an arrow: game starts, pup glides smoothly; steer to a bone with `press_key`; score goes up and the pup gets one segment longer.
- Turning corners looks curved, not blocky.
- Space pauses (card shows "Paused"), Space resumes.
- Steer into a wall: "Bonk!" card with length line, score and best; Space restarts; reload the page and Best persists.
- Review Focus 5: while playing, open another tab with `new_page`, wait 3 s, then `select_page` back. The game shows "Paused" and the pup has not run into a wall.

- [ ] **Step 8: Verify on phones in emulation**

With chrome-devtools: `emulate` an iPhone-size viewport (390×844, DPR 3, touch, mobile) and an Android one (412×915, DPR 2.625, touch, mobile); reload each time. Check, with screenshots:
- Portrait: HUD on top, square board, D-pad below, nothing overflows or scrolls horizontally, board is crisp.
- Landscape (844×390 / 915×412): board fills the height with the D-pad beside it.
- Tapping the board starts the game; D-pad taps (`click` on the D-pad buttons) steer the pup; the pause button works.
- Desktop (no touch emulation) does not show the D-pad.

Fix anything that's off, re-run `npm test`, and re-check.

- [ ] **Step 9: Commit**

```bash
git add index.html main.js render.js best.js .nojekyll tests/render.test.js tests/best.test.js
git commit -m "Add playable page with dachshund renderer and phone support"
```

---

### Task 4: README and publish to GitHub Pages

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: the finished site from Task 3.
- Produces: public repo `jlwilk/dachshund-snake`, live at `https://jlwilk.github.io/dachshund-snake/`.

- [ ] **Step 1: Write `README.md`**

```markdown
# Dachshund Snake

Snake, but you're a dachshund, and the pup only ever gets longer.

**Play:** https://jlwilk.github.io/dachshund-snake/

## Controls

- **Desktop:** arrow keys or WASD to steer, Space or P to pause, Space or Enter to play again.
- **Phone:** swipe on the board or use the on-screen arrows; tap to start, the pause button to pause.

## Run locally

No build step and no dependencies. ES modules need to be served over HTTP:

    python3 -m http.server 8000

Then open http://localhost:8000/.

## Tests

    npm test

Uses Node's built-in test runner (Node 18+).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Add README"
```

- [ ] **Step 3: Create the GitHub repo and push** (confirm with the user before this outward-facing step)

```bash
gh repo create jlwilk/dachshund-snake --public --source=. --remote=origin --push \
  --description "Snake, but you're a dachshund that only gets longer"
```

Expected: repo created, `main` pushed.

- [ ] **Step 4: Enable GitHub Pages from `main` /**

```bash
gh api -X POST repos/jlwilk/dachshund-snake/pages -f "source[branch]=main" -f "source[path]=/"
```

Expected: JSON with `"html_url": "https://jlwilk.github.io/dachshund-snake/"`.

- [ ] **Step 5: Verify the live site**

Poll `gh api repos/jlwilk/dachshund-snake/pages/builds/latest --jq .status` until `built` (usually 1–2 min), then open the Pages URL with chrome-devtools and confirm the ready card renders and the console is clean.

---

### Task 5: Pick your pup (color × coat)

Added after Tasks 1–4 at the user's request. Spec section: "Pick your pup".

**Files:**
- Create: `look.js`, `tests/look.test.js`
- Modify: `render.js`, `main.js`, `index.html`, `README.md`

**Interfaces:**
- Consumes: `getStorage()` from `best.js`; `draw`, `bodyPath` and the private draw helpers in `render.js`; the phase handling in `main.js` (`setPhase`, `showOverlay`, `onTap`).
- Produces:
  - `look.js`: `COLORS` (ordered `[{id, label}]`), `COATS` (ordered `[{id, label}]`), `DEFAULT_LOOK = { color: 'red', coat: 'smooth' }`, `normalizeLook(value): {color, coat}`, `loadLook(storage): {color, coat}`, `saveLook(storage, look): void`.
  - `render.js`: `draw(ctx, view)` view gains `look: {color, coat}` (missing → `DEFAULT_LOOK`); new `drawPreview(ctx, { look, width, height, time, tick })`.

- [ ] **Step 1: Write the failing tests** in `tests/look.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, COATS, DEFAULT_LOOK, normalizeLook, loadLook, saveLook } from '../look.js';

const memory = () => {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
};
const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

test('offers four colors and three coats in order', () => {
  assert.deepEqual(COLORS.map(c => c.id), ['red', 'blackTan', 'dapple', 'cream']);
  assert.deepEqual(COLORS.map(c => c.label), ['Red', 'Black & tan', 'Dapple', 'Cream']);
  assert.deepEqual(COATS.map(c => c.id), ['smooth', 'long', 'wire']);
  assert.deepEqual(COATS.map(c => c.label), ['Smooth', 'Long-haired', 'Wire-haired']);
});

test('default look is red smooth', () => {
  assert.deepEqual(DEFAULT_LOOK, { color: 'red', coat: 'smooth' });
});

test('normalizeLook keeps valid fields and replaces invalid ones', () => {
  assert.deepEqual(normalizeLook({ color: 'dapple', coat: 'wire' }), { color: 'dapple', coat: 'wire' });
  assert.deepEqual(normalizeLook({ color: 'purple', coat: 'long' }), { color: 'red', coat: 'long' });
  assert.deepEqual(normalizeLook({ color: 'cream', coat: 'toString' }), { color: 'cream', coat: 'smooth' });
  assert.deepEqual(normalizeLook(null), DEFAULT_LOOK);
  assert.deepEqual(normalizeLook('cream'), DEFAULT_LOOK);
});

test('saves and loads a look', () => {
  const s = memory();
  saveLook(s, { color: 'blackTan', coat: 'long' });
  assert.deepEqual(loadLook(s), { color: 'blackTan', coat: 'long' });
});

test('junk or missing stored look reads as default', () => {
  assert.deepEqual(loadLook(memory()), DEFAULT_LOOK);
  const s = memory();
  s.setItem('dachshund-snake:look', '{not json');
  assert.deepEqual(loadLook(s), DEFAULT_LOOK);
});

test('no storage or blocked storage never throws', () => {
  assert.deepEqual(loadLook(null), DEFAULT_LOOK);
  assert.deepEqual(loadLook(broken), DEFAULT_LOOK);
  assert.doesNotThrow(() => saveLook(null, DEFAULT_LOOK));
  assert.doesNotThrow(() => saveLook(broken, DEFAULT_LOOK));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../look.js'`; the other 26 still pass.

- [ ] **Step 3: Implement `look.js`**

```js
const KEY = 'dachshund-snake:look';

export const COLORS = [
  { id: 'red', label: 'Red' },
  { id: 'blackTan', label: 'Black & tan' },
  { id: 'dapple', label: 'Dapple' },
  { id: 'cream', label: 'Cream' },
];

export const COATS = [
  { id: 'smooth', label: 'Smooth' },
  { id: 'long', label: 'Long-haired' },
  { id: 'wire', label: 'Wire-haired' },
];

export const DEFAULT_LOOK = { color: 'red', coat: 'smooth' };

const has = (options, id) => options.some(o => o.id === id);

export function normalizeLook(value) {
  const v = value && typeof value === 'object' ? value : {};
  return {
    color: has(COLORS, v.color) ? v.color : DEFAULT_LOOK.color,
    coat: has(COATS, v.coat) ? v.coat : DEFAULT_LOOK.coat,
  };
}

export function loadLook(storage) {
  try {
    return normalizeLook(JSON.parse(storage?.getItem(KEY) ?? 'null'));
  } catch {
    return { ...DEFAULT_LOOK };
  }
}

export function saveLook(storage, look) {
  try {
    storage?.setItem(KEY, JSON.stringify(normalizeLook(look)));
  } catch {
    // Storage blocked — the choice just won't persist.
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: 32/32 PASS.

- [ ] **Step 5: Renderer — palettes and coats** (`render.js`)

Replace the single `COLORS` object with field/bone colors (unchanged values) plus a `PALETTES` map keyed by color id. Each palette has `outline, body, stripe, leg, ear`, plus optional `points` (tan accents) and `patch` (dapple patches). Use these values:

| id | outline | body | stripe | leg | ear | points | patch |
|---|---|---|---|---|---|---|---|
| red | `#6b3417` | `#a65a2a` | `#c98a55` | `#5a2b10` | `#6e3416` | — | — |
| blackTan | `#120b07` | `#2b1d16` | `#45322a` | `#c47a3c` | `#22160f` | `#c47a3c` | — |
| dapple | `#4e2a14` | `#8a5432` | `#a7714c` | `#4a2610` | `#5e3218` | — | `#d9c4a8` |
| cream | `#a87e45` | `#e3c18c` | `#f2dcb4` | `#b98b52` | `#cfa368` | — | — |

Look-specific drawing, all on canvas, all sized relative to `cell`:
- **Black & tan:** legs use the tan `leg` color (already in the table); draw a tan muzzle (the snout ellipse filled `points` instead of `body`) and two tan eyebrow dots just above and behind the eyes (radius ≈ 0.055 cell).
- **Dapple:** after the body strokes, draw 1–2 irregular light patches (`patch` color, ~0.15–0.25 cell, inside the body width) on some segments. Choose which segments and the patch offsets from a deterministic hash of the segment's index counted from the head, so patches stay on the same part of the dog as it moves and don't flicker.
- **Long-haired:** before the body, a feathered fringe along both sides of the body path (short backward-swept wisps or a wavy wider stroke in a slightly lighter shade than `body`); ears ~35% longer with a wavy lower edge; tail becomes a plume (wider, longer, wispy).
- **Wire-haired:** short bristly strokes along the body outline; bushy eyebrows (a few short strokes above each eye); a beard/mustache tuft at the sides of the muzzle extending past the snout; ears ~20% shorter.
- **Smooth:** exactly the current look.

Coat and color are independent: every combination (12) must render. `draw` reads `view.look` (fall back to `DEFAULT_LOOK` from `look.js`) and passes the palette and coat into the helpers. Keep the drawing helpers in `render.js`; split into helpers per coat feature rather than one long function.

Add `drawPreview(ctx, { look, width, height, time, tick })`: draws a short side-on pup (4 segments in a straight line heading right, head on the right) centred in a `width × height` area on a plain rounded grass-coloured background, reusing the same body/legs/tail/head helpers (so the preview always matches the in-game pup). Cell size = `height * 0.8` (or smaller if the 5-cell length doesn't fit the width).

- [ ] **Step 6: Picker UI** (`index.html`, `main.js`)

`index.html`: inside `.card`, between `#message` and `#hint`, add:

```html
<div class="picker" id="picker">
  <canvas id="preview" aria-hidden="true"></canvas>
  <div class="chips" role="radiogroup" aria-label="Color" data-kind="color"></div>
  <div class="chips" role="radiogroup" aria-label="Coat" data-kind="coat"></div>
</div>
```

Styles: `.picker` gets `pointer-events: auto` (the overlay is `pointer-events: none`); the preview canvas is 160×56 CSS px (rendered at `devicePixelRatio`); chips are small rounded buttons (min height 32px, wrap onto multiple lines), the selected chip clearly highlighted using the existing `--button`/`--button-press`/`--ink` tokens, readable in dark mode. In the existing landscape-phone media query, keep the card within the board: shrink the preview and chip padding as needed.

`main.js`:
- `let look = loadLook(storage);` — build the chips from `COLORS`/`COATS` (buttons with `role="radio"`, `aria-checked`, `data-kind`, `data-id`).
- Show `#picker` only in `ready` and `over` phases (hidden in `paused`).
- Chip selection: listen for `click` on the picker; set `look = { ...look, [kind]: id }`, `saveLook(storage, look)`, update `aria-checked`, then `button.blur()` so Space/Enter still start the game.
- A tap or click on the picker must not reach the stage's tap handler: stop propagation of `pointerdown` and `pointerup` on `#picker`.
- Pass `look` into `draw(...)` every frame, and while the picker is visible also call `drawPreview` on the preview canvas each frame (so the tail wags).

- [ ] **Step 7: README** — add under "Controls":

```markdown
## Pick your pup

On the start screen (or after a bonk), choose a color — Red, Black & tan, Dapple or Cream — and a coat — Smooth, Long-haired or Wire-haired. Your choice is remembered.
```

- [ ] **Step 8: Verify in a browser** (chrome-devtools MCP, `python3 -m http.server` on a free port)
- Screenshot the start card for all 12 combinations (or a contact sheet of them) and an in-game shot of each coat with at least two different colors. Each combination must be visibly distinct and still read as a dachshund.
- Choosing chips with the mouse does not start the game; Space afterwards does start it.
- Reload: the chosen look persists.
- Phone emulation (390×844 portrait and 844×390 landscape, touch): tapping a chip changes the look without starting the game; tapping the board outside the card starts it; the card fits within the board with no overflow.
- Console clean. `npm test` 32/32.

- [ ] **Step 9: Commit**

```bash
git add look.js tests/look.test.js render.js main.js index.html README.md
git commit -m "Add pup picker: four colors and three coats"
```
