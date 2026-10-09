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

test('default look is black and tan smooth', () => {
  assert.deepEqual(DEFAULT_LOOK, { color: 'blackTan', coat: 'smooth' });
});

test('normalizeLook keeps valid fields and replaces invalid ones', () => {
  assert.deepEqual(normalizeLook({ color: 'dapple', coat: 'wire' }), { color: 'dapple', coat: 'wire' });
  assert.deepEqual(normalizeLook({ color: 'purple', coat: 'long' }), { color: 'blackTan', coat: 'long' });
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
