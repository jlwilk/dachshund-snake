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
