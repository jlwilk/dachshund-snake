const KEY = 'dachshund-snake:mode';

export const MODES = [
  { id: 'normal', label: 'Normal' },
  { id: 'easy', label: 'Easy' },
];

export const DEFAULT_MODE = 'normal';

export function normalizeMode(value) {
  return MODES.some(m => m.id === value) ? value : DEFAULT_MODE;
}

export function loadMode(storage) {
  try {
    return normalizeMode(storage?.getItem(KEY));
  } catch {
    return DEFAULT_MODE;
  }
}

export function saveMode(storage, mode) {
  try {
    storage?.setItem(KEY, normalizeMode(mode));
  } catch {
    // Storage blocked — the choice just won't persist.
  }
}
