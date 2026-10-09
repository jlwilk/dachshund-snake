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
