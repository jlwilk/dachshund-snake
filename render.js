import { DIRS } from './game.js';

const COLORS = {
  grassA: '#a8d672',
  grassB: '#97c962',
  outline: '#6b3417',
  body: '#a65a2a',
  stripe: '#c98a55',
  leg: '#5a2b10',
  ear: '#6e3416',
  nose: '#1e1410',
  eye: '#1e1410',
  glint: '#ffffff',
  bone: '#fff6e3',
  boneEdge: '#d8c39c',
};

export function draw(ctx, { game, prev, alpha, time, tick, px }) {
  const cell = px / game.size;
  drawField(ctx, game.size, cell);
  if (game.treat) drawBone(ctx, game.treat, cell, time);
  const pts = bodyPath(game, prev, alpha, cell);
  drawTail(ctx, game, pts[pts.length - 1], cell, time);
  drawLegs(ctx, pts, cell, tick);
  drawBody(ctx, pts, cell);
  drawHead(ctx, game, pts[0], cell, tick);
}

// Head and tail slide between cells; everything in between sits on cell
// centres, so the body follows the grid and keeps a constant length.
export function bodyPath(game, prev, alpha, cell) {
  const s = game.snake;
  const before = prev ? prev.snake : s;
  const lerp = (a, b) => ({ x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha });
  const cells = s.slice();
  cells[0] = lerp(before[0], s[0]);
  const oldTail = before[s.length - 1];
  if (before !== s && oldTail) cells.push(lerp(oldTail, s[s.length - 1]));
  return cells.map(c => ({ x: (c.x + 0.5) * cell, y: (c.y + 0.5) * cell }));
}

function drawField(ctx, size, cell) {
  ctx.fillStyle = COLORS.grassA;
  ctx.fillRect(0, 0, size * cell, size * cell);
  ctx.fillStyle = COLORS.grassB;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x + y) % 2) ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
    }
  }
}

function drawBone(ctx, treat, cell, time) {
  const cx = (treat.x + 0.5) * cell;
  const cy = (treat.y + 0.5) * cell + Math.sin(time / 250) * cell * 0.05;
  const knob = cell * 0.1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.5);
  ctx.beginPath();
  ctx.roundRect(-cell * 0.28, -cell * 0.08, cell * 0.56, cell * 0.16, cell * 0.05);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ctx.moveTo(sx * cell * 0.3 + knob, sy * cell * 0.09);
      ctx.arc(sx * cell * 0.3, sy * cell * 0.09, knob, 0, Math.PI * 2);
    }
  }
  ctx.lineWidth = cell * 0.08;
  ctx.strokeStyle = COLORS.boneEdge;
  ctx.stroke();
  ctx.fillStyle = COLORS.bone;
  ctx.fill();
  ctx.restore();
}

function tracePath(ctx, pts, maxRadius) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const r = Math.min(maxRadius, dist(pts[i - 1], pts[i]), dist(pts[i], pts[i + 1]));
    ctx.arcTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, r);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

function drawBody(ctx, pts, cell) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  tracePath(ctx, pts, cell * 0.45);
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = cell * 0.78;
  ctx.stroke();
  ctx.strokeStyle = COLORS.body;
  ctx.lineWidth = cell * 0.66;
  ctx.stroke();
  ctx.strokeStyle = COLORS.stripe;
  ctx.lineWidth = cell * 0.2;
  ctx.stroke();
}

function drawLegs(ctx, pts, cell, tick) {
  const half = cell * 0.55;
  const w = cell * 0.16;
  ctx.fillStyle = COLORS.leg;
  for (let i = 1; i < pts.length - 1; i += 2) {
    const a = pts[i - 1];
    const b = pts[i + 1];
    const stride = ((i + tick) % 4 < 2 ? 1 : -1) * cell * 0.1;
    ctx.save();
    ctx.translate(pts[i].x, pts[i].y);
    ctx.rotate(Math.atan2(a.y - b.y, a.x - b.x));
    ctx.beginPath();
    ctx.roundRect(stride - w / 2, -half, w, half * 2, w / 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawTail(ctx, game, base, cell, time) {
  const s = game.snake;
  const n = s.length;
  const wag = Math.sin(time / 120) * 0.5;
  const len = cell * 0.75;
  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.rotate(Math.atan2(s[n - 1].y - s[n - 2].y, s[n - 1].x - s[n - 2].x) + wag);
  ctx.beginPath();
  ctx.moveTo(0, -cell * 0.14);
  ctx.quadraticCurveTo(len * 0.6, -cell * 0.08, len, 0);
  ctx.quadraticCurveTo(len * 0.6, cell * 0.08, 0, cell * 0.14);
  ctx.closePath();
  ctx.fillStyle = COLORS.body;
  ctx.fill();
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = cell * 0.05;
  ctx.stroke();
  ctx.restore();
}

function drawHead(ctx, game, at, cell, tick) {
  const d = DIRS[game.dir];
  const flap = tick % 2 ? 0.35 : 0.15;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(Math.atan2(d.y, d.x));
  ctx.lineWidth = cell * 0.06;
  ctx.strokeStyle = COLORS.outline;

  ctx.fillStyle = COLORS.ear;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(-cell * 0.08, side * cell * 0.3);
    ctx.rotate(side * flap);
    ellipse(ctx, -cell * 0.1, side * cell * 0.06, cell * 0.3, cell * 0.15);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = COLORS.body;
  ellipse(ctx, cell * 0.4, 0, cell * 0.36, cell * 0.22);
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, 0, 0, cell * 0.42, cell * 0.4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COLORS.nose;
  ellipse(ctx, cell * 0.74, 0, cell * 0.1, cell * 0.1);
  ctx.fill();

  for (const side of [-1, 1]) {
    ctx.fillStyle = COLORS.eye;
    ellipse(ctx, cell * 0.12, side * cell * 0.17, cell * 0.065, cell * 0.065);
    ctx.fill();
    ctx.fillStyle = COLORS.glint;
    ellipse(ctx, cell * 0.14, side * cell * 0.17 - cell * 0.02, cell * 0.022, cell * 0.022);
    ctx.fill();
  }
  ctx.restore();
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
