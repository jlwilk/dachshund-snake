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

const easy5 = overrides => ({ ...createGame({ size: 5, rng: zero, easy: true }), ...overrides });
const at = (x, y) => ({ x, y });

test('createGame defaults easy to false and passes easy through', () => {
  assert.equal(createGame({ rng: zero }).easy, false);
  assert.equal(createGame({ rng: zero, easy: true }).easy, true);
});

test('easy: equal room both ways turns clockwise at the right wall', () => {
  const g = easy5({ snake: [at(4, 2), at(3, 2), at(2, 2)], dir: 'right', treat: at(0, 4) });
  const { state, event } = step(g, zero);
  assert.equal(event, null);
  assert.equal(state.alive, true);
  assert.equal(state.dir, 'down');
  assert.deepEqual(state.snake[0], at(4, 3));
});

test('easy: turns toward the side with more room', () => {
  const g = easy5({ snake: [at(4, 3), at(3, 3), at(2, 3)], dir: 'right', treat: at(0, 0) });
  const { state } = step(g, zero);
  assert.equal(state.dir, 'up');
  assert.deepEqual(state.snake[0], at(4, 2));
});

test('easy: corner turns to the only open side', () => {
  const g = easy5({ snake: [at(4, 0), at(3, 0), at(2, 0)], dir: 'right', treat: at(0, 4) });
  const { state } = step(g, zero);
  assert.equal(state.alive, true);
  assert.equal(state.dir, 'down');
  assert.deepEqual(state.snake[0], at(4, 1));
});

test('easy: a body cell blocks one side so it turns the other way', () => {
  const g = easy5({ snake: [at(4, 2), at(3, 2), at(3, 3), at(4, 3), at(4, 4)], dir: 'right', treat: at(0, 0) });
  const { state } = step(g, zero);
  assert.equal(state.dir, 'up');
  assert.deepEqual(state.snake[0], at(4, 1));
});

test('easy: dies when both sides are blocked, snake unchanged', () => {
  const snake = [at(4, 2), at(3, 2), at(3, 1), at(4, 1), at(4, 0), at(3, 0), at(2, 0),
    at(2, 1), at(2, 2), at(2, 3), at(3, 3), at(4, 3), at(4, 4)];
  const g = easy5({ snake, dir: 'right', treat: at(0, 4) });
  const { state, event } = step(g, zero);
  assert.equal(event, 'died');
  assert.equal(state.alive, false);
  assert.deepEqual(state.snake, snake);
});

test('easy: auto-turn onto a treat eats it', () => {
  const g = easy5({ snake: [at(4, 2), at(3, 2), at(2, 2)], dir: 'right', treat: at(4, 3) });
  const { state, event } = step(g, zero);
  assert.equal(event, 'ate');
  assert.equal(state.snake.length, 4);
  assert.equal(state.score, 1);
});

test('easy: a queued in-bounds turn is used normally', () => {
  const g = queueDirection(easy5({ snake: [at(4, 2), at(3, 2), at(2, 2)], dir: 'right', treat: at(0, 4) }), 'up');
  const { state } = step(g, zero);
  assert.equal(state.dir, 'up');
  assert.deepEqual(state.snake[0], at(4, 1));
});

test('easy off still dies at the right wall', () => {
  const g = game5({ snake: [at(4, 2), at(3, 2), at(2, 2)], dir: 'right', treat: at(0, 4), easy: false });
  const { state, event } = step(g, zero);
  assert.equal(event, 'died');
  assert.equal(state.alive, false);
});

test('easy: a queued reversal of the auto-turn direction is dropped', () => {
  const g = easy5({ snake: [at(4, 2), at(3, 2), at(2, 2)], dir: 'up', queue: ['right', 'up'], treat: at(0, 0) });
  const first = step(g, zero);
  assert.equal(first.state.dir, 'down');
  const second = step(first.state, zero);
  assert.equal(second.state.alive, true);
  assert.equal(second.state.dir, 'down');
  assert.deepEqual(second.state.snake[0], at(4, 4));
});

test('easy: a queued non-reversal follow-up still applies after an auto-turn', () => {
  const g = easy5({ snake: [at(4, 2), at(3, 2), at(2, 2)], dir: 'up', queue: ['right', 'left'], treat: at(0, 0) });
  const first = step(g, zero);
  assert.equal(first.state.dir, 'down');
  const second = step(first.state, zero);
  assert.equal(second.state.alive, true);
  assert.equal(second.state.dir, 'left');
  assert.deepEqual(second.state.snake[0], at(3, 3));
});

test('easy: turns into the vacating tail cell when it is the only open side', () => {
  const snake = [at(4, 2), at(3, 2), at(3, 1), at(4, 1), at(4, 0), at(3, 0), at(2, 0),
    at(2, 1), at(2, 2), at(2, 3), at(3, 3), at(4, 3)];
  const g = easy5({ snake, dir: 'right', treat: at(0, 4) });
  const { state, event } = step(g, zero);
  assert.equal(event, null);
  assert.equal(state.alive, true);
  assert.equal(state.dir, 'down');
  assert.deepEqual(state.snake[0], at(4, 3));
});
