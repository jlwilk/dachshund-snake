export const GRID = 20;
export const START_TICK_MS = 150;
export const TICK_STEP_MS = 3;
export const MIN_TICK_MS = 70;
export const CM_PER_SEGMENT = 15;

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const MAX_QUEUE = 2;
const CLOCKWISE = { right: 'down', down: 'left', left: 'up', up: 'right' };
const COUNTER_CLOCKWISE = { right: 'up', up: 'left', left: 'down', down: 'right' };

const inBounds = (size, c) => c.x >= 0 && c.y >= 0 && c.x < size && c.y < size;
const isBody = (snake, c) => snake.slice(0, -1).some(s => s.x === c.x && s.y === c.y);

// Open cells in a straight line from the head, stopping at a wall or body cell.
function room(game, dir) {
  const { x: dx, y: dy } = DIRS[dir];
  let c = { x: game.snake[0].x + dx, y: game.snake[0].y + dy };
  let n = 0;
  while (inBounds(game.size, c) && !isBody(game.snake, c)) {
    n++;
    c = { x: c.x + dx, y: c.y + dy };
  }
  return n;
}

// Easy mode: pick a perpendicular direction instead of hitting the wall, or null if boxed in.
function autoTurn(game, dir) {
  const open = [CLOCKWISE[dir], COUNTER_CLOCKWISE[dir]].filter(d => room(game, d) > 0);
  if (open.length < 2) return open[0] ?? null;
  return room(game, open[1]) > room(game, open[0]) ? open[1] : open[0];
}

export function createGame({ size = GRID, rng = Math.random, easy = false } = {}) {
  const mid = Math.floor(size / 2);
  const snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
  return {
    size,
    snake,
    dir: 'right',
    queue: [],
    treat: placeTreat(size, snake, rng),
    score: 0,
    tickMs: START_TICK_MS,
    alive: true,
    easy,
  };
}

export function placeTreat(size, snake, rng) {
  const taken = new Set(snake.map(c => c.y * size + c.x));
  const free = [];
  for (let i = 0; i < size * size; i++) if (!taken.has(i)) free.push(i);
  if (free.length === 0) return null;
  const i = free[Math.floor(rng() * free.length)];
  return { x: i % size, y: Math.floor(i / size) };
}

export function queueDirection(game, dir) {
  if (!DIRS[dir] || game.queue.length >= MAX_QUEUE) return game;
  const last = game.queue.length ? game.queue[game.queue.length - 1] : game.dir;
  if (dir === last || dir === OPPOSITE[last]) return game;
  return { ...game, queue: [...game.queue, dir] };
}

export function step(game, rng = Math.random) {
  if (!game.alive) return { state: game, event: null };

  const [queued, ...rest] = game.queue;
  let dir = queued ?? game.dir;
  const head = game.snake[0];
  let next = { x: head.x + DIRS[dir].x, y: head.y + DIRS[dir].y };

  if (!inBounds(game.size, next) && game.easy) {
    const turned = autoTurn(game, dir);
    if (turned) {
      dir = turned;
      next = { x: head.x + DIRS[dir].x, y: head.y + DIRS[dir].y };
    }
  }
  const base = { ...game, dir, queue: queued ? rest : game.queue };

  if (!inBounds(game.size, next)) return { state: { ...base, alive: false }, event: 'died' };

  const eats = game.treat !== null && next.x === game.treat.x && next.y === game.treat.y;
  const body = eats ? game.snake : game.snake.slice(0, -1);
  if (body.some(c => c.x === next.x && c.y === next.y)) {
    return { state: { ...base, alive: false }, event: 'died' };
  }

  const snake = [next, ...body];
  if (!eats) return { state: { ...base, snake }, event: null };

  return {
    state: {
      ...base,
      snake,
      score: game.score + 1,
      tickMs: Math.max(MIN_TICK_MS, game.tickMs - TICK_STEP_MS),
      treat: placeTreat(game.size, snake, rng),
    },
    event: 'ate',
  };
}

export function lengthLabel(segments) {
  const cm = segments * CM_PER_SEGMENT;
  return cm < 100 ? `${cm} cm` : `${+(cm / 100).toFixed(1)} m`;
}
