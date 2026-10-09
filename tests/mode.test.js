import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES, DEFAULT_MODE, normalizeMode, loadMode, saveMode } from '../mode.js';

const memory = () => {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
};
const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

test('offers normal and easy in order', () => {
  assert.deepEqual(MODES.map(m => m.id), ['normal', 'easy']);
  assert.deepEqual(MODES.map(m => m.label), ['Normal', 'Easy']);
  assert.equal(DEFAULT_MODE, 'normal');
});

test('normalizeMode keeps valid ids and defaults everything else', () => {
  assert.equal(normalizeMode('easy'), 'easy');
  assert.equal(normalizeMode('normal'), 'normal');
  assert.equal(normalizeMode('hard'), 'normal');
  assert.equal(normalizeMode('toString'), 'normal');
  assert.equal(normalizeMode(null), 'normal');
  assert.equal(normalizeMode({ id: 'easy' }), 'normal');
});

test('saves and loads a mode', () => {
  const s = memory();
  saveMode(s, 'easy');
  assert.equal(loadMode(s), 'easy');
  assert.equal(s.getItem('dachshund-snake:mode'), 'easy');
});

test('junk or missing stored mode reads as default', () => {
  assert.equal(loadMode(memory()), 'normal');
  const s = memory();
  s.setItem('dachshund-snake:mode', 'turbo');
  assert.equal(loadMode(s), 'normal');
});

test('no storage or blocked storage never throws', () => {
  assert.equal(loadMode(null), 'normal');
  assert.equal(loadMode(broken), 'normal');
  assert.doesNotThrow(() => saveMode(null, 'easy'));
  assert.doesNotThrow(() => saveMode(broken, 'easy'));
});
