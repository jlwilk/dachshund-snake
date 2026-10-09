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
