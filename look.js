const KEY = 'dachshund-snake:look';

export const COLORS = [
  { id: 'red', label: 'Red' },
  { id: 'blackTan', label: 'Black & tan' },
  { id: 'dapple', label: 'Dapple' },
  { id: 'cream', label: 'Cream' },
];

export const COATS = [
  { id: 'smooth', label: 'Smooth' },
  { id: 'long', label: 'Long-haired' },
  { id: 'wire', label: 'Wire-haired' },
];

export const DEFAULT_LOOK = { color: 'blackTan', coat: 'smooth' };

const has = (options, id) => options.some(o => o.id === id);

export function normalizeLook(value) {
  const v = value && typeof value === 'object' ? value : {};
  return {
    color: has(COLORS, v.color) ? v.color : DEFAULT_LOOK.color,
    coat: has(COATS, v.coat) ? v.coat : DEFAULT_LOOK.coat,
  };
}

export function loadLook(storage) {
  try {
    return normalizeLook(JSON.parse(storage?.getItem(KEY) ?? 'null'));
  } catch {
    return { ...DEFAULT_LOOK };
  }
}

export function saveLook(storage, look) {
  try {
    storage?.setItem(KEY, JSON.stringify(normalizeLook(look)));
  } catch {
    // Storage blocked — the choice just won't persist.
  }
}
