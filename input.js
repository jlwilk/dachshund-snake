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
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const action = keyToAction(e.key);
    if (!action) return;
    // Space/Enter on a focused button (e.g. a picker chip) should press that
    // button, not start the game. Buttons blur after a mouse click, so Space
    // still starts the game after picking with the mouse.
    if (action.type === 'primary' && e.target.closest?.('button')) return;
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
