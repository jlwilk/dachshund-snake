const KEY = 'dachshund-snake:best';

export function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadBest(storage) {
  try {
    const n = parseInt(storage?.getItem(KEY), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveBest(storage, n) {
  try {
    storage?.setItem(KEY, String(n));
  } catch {
    // Storage blocked (private mode etc.) — best score just won't persist.
  }
}
