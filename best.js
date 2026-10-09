const KEYS = { normal: 'dachshund-snake:best', easy: 'dachshund-snake:best:easy' };
const keyFor = mode => (mode === 'easy' ? KEYS.easy : KEYS.normal);

export function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadBest(storage, mode = 'normal') {
  try {
    const n = parseInt(storage?.getItem(keyFor(mode)), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveBest(storage, n, mode = 'normal') {
  try {
    storage?.setItem(keyFor(mode), String(n));
  } catch {
    // Storage blocked (private mode etc.) — best score just won't persist.
  }
}
