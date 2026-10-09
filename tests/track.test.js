import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameEvent, track } from '../track.js';

const look = { color: 'blackTan', coat: 'smooth' };

test('start events are named by mode and titled with the pup', () => {
  assert.deepEqual(gameEvent('start', { mode: 'easy', look }), {
    path: 'start-easy',
    title: 'blackTan smooth',
    event: true,
  });
});

test('over events include the score', () => {
  assert.deepEqual(gameEvent('over', { mode: 'normal', look, score: 7 }), {
    path: 'over-normal',
    title: 'score 7 · blackTan smooth',
    event: true,
  });
});

test('track is a no-op without the counter and never throws', () => {
  assert.doesNotThrow(() => track(gameEvent('start', { mode: 'normal', look })));
  globalThis.goatcounter = { count() { throw new Error('blocked'); } };
  try {
    assert.doesNotThrow(() => track(gameEvent('start', { mode: 'normal', look })));
  } finally {
    delete globalThis.goatcounter;
  }
});

test('track forwards the event to the counter', () => {
  const sent = [];
  globalThis.goatcounter = { count: e => sent.push(e) };
  try {
    const e = gameEvent('over', { mode: 'easy', look, score: 3 });
    track(e);
    assert.deepEqual(sent, [e]);
  } finally {
    delete globalThis.goatcounter;
  }
});
