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

test('easy and normal bests are stored independently', () => {
  const s = memory();
  saveBest(s, 7, 'normal');
  saveBest(s, 3, 'easy');
  assert.equal(loadBest(s, 'normal'), 7);
  assert.equal(loadBest(s, 'easy'), 3);
  assert.equal(loadBest(memory(), 'easy'), 0);
});

test('a one-arg save is read back as the normal best', () => {
  const s = memory();
  saveBest(s, 9);
  assert.equal(loadBest(s), 9);
  assert.equal(loadBest(s, 'normal'), 9);
  assert.equal(loadBest(s, 'easy'), 0);
});
