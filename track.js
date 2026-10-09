// Anonymous play counts via GoatCounter (no cookies). The counter script loads
// async and may be blocked, so every call is optional and never throws.

export function gameEvent(kind, { mode, look, score }) {
  const pup = `${look.color} ${look.coat}`;
  return {
    path: `${kind}-${mode}`,
    title: kind === 'over' ? `score ${score} · ${pup}` : pup,
    event: true,
  };
}

export function track(event) {
  try {
    globalThis.goatcounter?.count?.(event);
  } catch {
    // Analytics must never break the game.
  }
}
