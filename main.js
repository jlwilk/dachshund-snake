import { createGame, queueDirection, step, lengthLabel } from './game.js';
import { attachInput } from './input.js';
import { draw, drawPreview } from './render.js';
import { getStorage, loadBest, saveBest } from './best.js';
import { MODES, loadMode, saveMode } from './mode.js';
import { COLORS, COATS, loadLook, saveLook } from './look.js';
import { gameEvent, track } from './track.js';

const MAX_FRAME_MS = 250;
// Ignore restart taps/keys right after death so a stray press can't skip the Bonk card.
const RESTART_LOCKOUT_MS = 400;

const $ = id => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d');
const stage = $('stage');
const overlay = $('overlay');
const pauseButton = $('pause');
const picker = $('picker');
const preview = $('preview');
const previewCtx = preview.getContext('2d');

const isTouch = matchMedia('(pointer: coarse)').matches;
const HINTS = isTouch
  ? { start: 'Swipe or use the arrows to steer. Tap to start.', resume: 'Tap to keep going.', restart: 'Tap to play again.' }
  : { start: 'Arrow keys or WASD to steer. Press an arrow or Space to start.', resume: 'Press Space to keep going.', restart: 'Press Space or Enter to play again.' };

const storage = getStorage();
let mode = loadMode(storage);
let playedMode = mode;
let best = loadBest(storage, mode);
let look = loadLook(storage);
let game = createGame();
let prev = game;
let phase = 'ready';
let acc = 0;
let tick = 0;
let last = performance.now();
let boardPx = 0;
let diedAt = -Infinity;

function showOverlay(title, message, hint, withPicker = false) {
  $('title').textContent = title;
  $('message').textContent = message;
  $('hint').textContent = hint;
  picker.hidden = !withPicker;
  overlay.hidden = false;
  if (withPicker) fitPreview();
}

function buildChips() {
  const options = { color: COLORS, coat: COATS, mode: MODES };
  for (const group of picker.querySelectorAll('.chips')) {
    const kind = group.dataset.kind;
    for (const { id, label } of options[kind]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.setAttribute('role', 'radio');
      button.dataset.kind = kind;
      button.dataset.id = id;
      group.append(button);
    }
  }
  syncChips();
}

function syncChips() {
  for (const button of picker.querySelectorAll('button')) {
    const current = button.dataset.kind === 'mode' ? mode : look[button.dataset.kind];
    button.setAttribute('aria-checked', String(current === button.dataset.id));
  }
}

function onChip(event) {
  const button = event.target.closest('button[data-kind]');
  if (!button) return;
  if (button.dataset.kind === 'mode') {
    mode = button.dataset.id;
    saveMode(storage, mode);
    best = loadBest(storage, mode);
    // The over card keeps describing the finished game; only the HUD follows the chip.
    updateHud(phase === 'over' ? 0 : game.score);
  } else {
    look = { ...look, [button.dataset.kind]: button.dataset.id };
    saveLook(storage, look);
  }
  syncChips();
  // Drop focus so Space/Enter go back to starting the game.
  button.blur();
}

function fitPreview() {
  const { clientWidth: w, clientHeight: h } = preview;
  if (!w || !h) return;
  const dpr = window.devicePixelRatio || 1;
  preview.width = Math.round(w * dpr);
  preview.height = Math.round(h * dpr);
  previewCtx.setTransform(preview.width / w, 0, 0, preview.height / h, 0, 0);
}

const bestLabel = m => (m === 'easy' ? 'Best (easy)' : 'Best');
const overHint = () => `Score ${game.score} · ${bestLabel(playedMode)} ${loadBest(storage, playedMode)}. ${HINTS.restart}`;

function setPhase(next) {
  phase = next;
  pauseButton.disabled = phase === 'ready' || phase === 'over';
  pauseButton.textContent = phase === 'paused' ? '▶' : '❚❚';
  pauseButton.setAttribute('aria-label', phase === 'paused' ? 'Resume' : 'Pause');
  if (phase === 'playing') overlay.hidden = true;
  if (phase === 'ready') showOverlay('Dachshund Snake', 'Eat the bones. Grow the pup. Don’t bonk.', HINTS.start, true);
  if (phase === 'paused') showOverlay('Paused', 'Good pup. Take a breather.', HINTS.resume);
  if (phase === 'over') {
    showOverlay(
      'Bonk!',
      `Your pup reached ${lengthLabel(game.snake.length)} of pure sausage.`,
      overHint(),
      true,
    );
  }
}

function updateHud(score = game.score) {
  $('score').textContent = score;
  $('best-label').textContent = bestLabel(mode);
  $('best').textContent = best;
}

function startGame() {
  playedMode = mode;
  game = createGame({ easy: mode === 'easy' });
  prev = game;
  acc = 0;
  tick = 0;
  updateHud();
  setPhase('playing');
  track(gameEvent('start', { mode: playedMode, look }));
}

function gameOver() {
  diedAt = performance.now();
  if (game.score > best) {
    best = game.score;
    saveBest(storage, best, mode);
  }
  updateHud();
  setPhase('over');
  track(gameEvent('over', { mode: playedMode, look, score: game.score }));
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
  if (phase === 'over' && performance.now() - diedAt < RESTART_LOCKOUT_MS) return;
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
  requestAnimationFrame(frame);
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
  if (boardPx > 0) draw(ctx, { game, prev, alpha, time: now, tick, px: boardPx, look });
  if (!overlay.hidden && !picker.hidden && preview.clientWidth > 0) {
    drawPreview(previewCtx, { look, width: preview.clientWidth, height: preview.clientHeight, time: now, tick });
  }
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

picker.addEventListener('click', onChip);
// Chip taps are not board taps: keep them away from the stage's tap handler.
for (const type of ['pointerdown', 'pointerup']) {
  picker.addEventListener(type, event => event.stopPropagation());
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && phase === 'playing') setPhase('paused');
});

window.addEventListener('blur', () => {
  if (phase === 'playing') setPhase('paused');
});

new ResizeObserver(fit).observe(stage);
new ResizeObserver(fitPreview).observe(preview);
buildChips();
fit();
updateHud();
setPhase('ready');
requestAnimationFrame(frame);
