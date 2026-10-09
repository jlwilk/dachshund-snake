import { DIRS } from './game.js';
import { normalizeLook } from './look.js';

const COLORS = {
  grassA: '#a8d672',
  grassB: '#97c962',
  nose: '#1e1410',
  eye: '#1e1410',
  glint: '#ffffff',
  bone: '#fff6e3',
  boneEdge: '#d8c39c',
};

const PALETTES = {
  red: { outline: '#6b3417', body: '#a65a2a', stripe: '#c98a55', leg: '#5a2b10', ear: '#6e3416' },
  blackTan: {
    outline: '#120b07', body: '#2b1d16', stripe: '#45322a', leg: '#c47a3c', ear: '#22160f', points: '#c47a3c',
  },
  dapple: {
    outline: '#4e2a14', body: '#8a5432', stripe: '#a7714c', leg: '#4a2610', ear: '#5e3218', patch: '#d9c4a8',
  },
  cream: { outline: '#a87e45', body: '#e3c18c', stripe: '#f2dcb4', leg: '#b98b52', ear: '#cfa368' },
};

export function draw(ctx, { game, prev, alpha, time, tick, px, look }) {
  const cell = px / game.size;
  drawField(ctx, game.size, cell);
  if (game.treat) drawBone(ctx, game.treat, cell, time);
  const s = game.snake;
  const n = s.length;
  const d = DIRS[game.dir];
  drawPup(ctx, {
    pts: bodyPath(game, prev, alpha, cell),
    headAngle: Math.atan2(d.y, d.x),
    tailAngle: Math.atan2(s[n - 1].y - s[n - 2].y, s[n - 1].x - s[n - 2].x),
    cell, time, tick, look,
  });
}

// A short side-on pup for the picker card, drawn with the same helpers as
// the board so the preview always matches the in-game dog.
export function drawPreview(ctx, { look, width, height, time, tick }) {
  // A long-haired plume and a wire beard make the pup a bit over 5 cells.
  const cell = Math.min(height * 0.8, width / 5.6);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, 0, 0, width, height, Math.min(12, height / 4));
  ctx.fillStyle = COLORS.grassA;
  ctx.fill();
  ctx.clip();
  const y = height / 2;
  const pts = [0, 1, 2, 3].map(i => ({ x: width / 2 + (1.75 - i) * cell, y }));
  drawPup(ctx, { pts, headAngle: 0, tailAngle: Math.PI, cell, time, tick, look });
  ctx.restore();
}

function drawPup(ctx, { pts, headAngle, tailAngle, cell, time, tick, look }) {
  const { color, coat } = normalizeLook(look);
  const p = PALETTES[color];
  drawTail(ctx, pts[pts.length - 1], tailAngle, cell, time, p, coat);
  if (coat === 'long') drawFringe(ctx, pts, cell, p);
  drawLegs(ctx, pts, cell, tick, p);
  drawBody(ctx, pts, cell, p);
  if (p.patch) drawPatches(ctx, pts, cell, p);
  if (coat === 'wire') drawBristles(ctx, pts, cell, p);
  drawHead(ctx, pts[0], headAngle, cell, tick, p, coat);
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
  roundRectPath(ctx, -cell * 0.28, -cell * 0.08, cell * 0.56, cell * 0.16, cell * 0.05);
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

// ctx.roundRect needs Safari 16+/Firefox 112+; fall back to arcTo corners.
function roundRectPath(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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

function drawBody(ctx, pts, cell, p) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  tracePath(ctx, pts, cell * 0.45);
  ctx.strokeStyle = p.outline;
  ctx.lineWidth = cell * 0.78;
  ctx.stroke();
  ctx.strokeStyle = p.body;
  ctx.lineWidth = cell * 0.66;
  ctx.stroke();
  ctx.strokeStyle = p.stripe;
  ctx.lineWidth = cell * 0.2;
  ctx.stroke();
}

// Points spaced `step` apart along the body polyline, measured from the head,
// so coat details travel with the dog instead of sliding along it.
// Each sample carries its unit direction toward the tail and its distance
// to the nearest bend (`toTurn`), so edge details can skip the corners.
function samplePath(pts, step, start, endTrim) {
  const out = [];
  const turns = pts.map((q, i) => i > 0 && i < pts.length - 1
    && Math.abs((q.x - pts[i - 1].x) * (pts[i + 1].y - q.y) - (q.y - pts[i - 1].y) * (pts[i + 1].x - q.x)) > 1e-6);
  let walked = 0;
  let next = start;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = dist(a, b);
    if (len === 0) continue;
    const t = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    while (next <= walked + len) {
      const f = (next - walked) / len;
      const toTurn = Math.min(turns[i] ? f * len : Infinity, turns[i + 1] ? (1 - f) * len : Infinity);
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, t, at: next, toTurn });
      next += step;
    }
    walked += len;
  }
  return out.filter(s => s.at <= walked - endTrim);
}

// Small deterministic hash in [0, 1) for stable per-segment variation.
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = c => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(n >> 16)} ${mix((n >> 8) & 255)} ${mix(n & 255)})`;
}

// Long-haired: a soft fur skirt along both sides of the body with feathery
// tufts swept back toward the tail, drawn under the body.
const FUR_CHUNK = 40;

function drawFringe(ctx, pts, cell, p) {
  const step = cell * 0.24;
  const tufts = samplePath(pts, step, cell * 0.35, cell * 0.15).flatMap(s => {
    const k = Math.round(s.at / step);
    return [-1, 1].map(side => ({
      x: s.x - s.t.y * side * cell * 0.3,
      y: s.y + s.t.x * side * cell * 0.3,
      nx: -s.t.y * side,
      ny: s.t.x * side,
      tx: s.t.x,
      ty: s.t.y,
      len: cell * (0.2 + hash(k * 2 + side) * 0.08),
      width: cell * 0.34,
      sweep: cell * 0.3,
    }));
  });
  // Chunked so no single path piles up hundreds of overlapping subpaths.
  const chunks = [];
  for (let i = 0; i < tufts.length; i += FUR_CHUNK) {
    const chunk = tufts.slice(i, i + FUR_CHUNK);
    chunks.push(() => chunk.forEach(t => tuftPath(ctx, t)));
  }
  furPass(
    ctx, cell, p.outline, lighten(p.body, 0.12),
    chunks,
    () => tracePath(ctx, pts, cell * 0.45),
    cell * 0.9,
  );
}

// One tapered tuft of fur: base centred on (x, y), pointing along n,
// swept by `sweep` along t.
function tuftPath(ctx, { x, y, nx, ny, tx, ty, len, width, sweep }) {
  const hw = width / 2;
  const tipX = x + nx * len + tx * sweep;
  const tipY = y + ny * len + ty * sweep;
  ctx.moveTo(x - tx * hw, y - ty * hw);
  ctx.quadraticCurveTo(x - tx * hw * 0.2 + nx * len * 0.7, y - ty * hw * 0.2 + ny * len * 0.7, tipX, tipY);
  ctx.quadraticCurveTo(x + tx * hw + nx * len * 0.3, y + ty * hw + ny * len * 0.3, x + tx * hw, y + ty * hw);
  ctx.closePath();
}

// Outline-then-fill so overlapping tufts merge into one furry silhouette.
// `traceTufts` (a function, or an array of them, one path each) adds closed
// shapes to the path; the optional `spine` is
// stroked `spineWidth` wide under them (the long coat's fur skirt).
function furPass(ctx, cell, outline, fill, traceTufts, spine = null, spineWidth = 0) {
  const edge = cell * 0.08;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  if (spine) {
    spine();
    ctx.lineWidth = spineWidth + edge;
    ctx.stroke();
  }
  const chunks = Array.isArray(traceTufts) ? traceTufts : [traceTufts];
  ctx.lineWidth = edge;
  for (const trace of chunks) {
    ctx.beginPath();
    trace();
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  for (const trace of chunks) {
    ctx.beginPath();
    trace();
    ctx.fill();
  }
  if (spine) {
    spine();
    ctx.strokeStyle = fill;
    ctx.lineWidth = spineWidth - edge;
    ctx.stroke();
  }
  ctx.restore();
}

// Wire-haired: scruffy spikes poking out of both sides (skipping the bends,
// where they would cross the body) plus a few lighter grizzled flecks.
function drawBristles(ctx, pts, cell, p) {
  const step = cell * 0.17;
  const samples = samplePath(pts, step, cell * 0.4, cell * 0.1);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = p.outline;
  ctx.lineWidth = cell * 0.05;
  ctx.beginPath();
  for (const s of samples) {
    if (s.toTurn < cell * 0.3) continue;
    const k = Math.round(s.at / step);
    for (const side of [-1, 1]) {
      const nx = -s.t.y * side;
      const ny = s.t.x * side;
      const r = cell * 0.34;
      const tip = cell * (0.42 + hash(k * 3 + side) * 0.07);
      const lean = cell * (0.03 + hash(k * 5 + side) * 0.05);
      const half = cell * 0.06;
      ctx.moveTo(s.x + nx * r - s.t.x * half, s.y + ny * r - s.t.y * half);
      ctx.lineTo(s.x + nx * tip + s.t.x * lean, s.y + ny * tip + s.t.y * lean);
      ctx.lineTo(s.x + nx * r + s.t.x * half, s.y + ny * r + s.t.y * half);
    }
  }
  ctx.stroke();
  ctx.strokeStyle = lighten(p.body, 0.3);
  ctx.lineWidth = cell * 0.045;
  ctx.beginPath();
  for (const s of samplePath(pts, cell * 0.1, cell * 0.4, cell * 0.1)) {
    const k = Math.round(s.at / (cell * 0.1));
    if (hash(k * 11) < 0.55 || s.toTurn < cell * 0.3) continue;
    const off = (hash(k * 7) - 0.5) * cell * 0.46;
    const x = s.x - s.t.y * off;
    const y = s.y + s.t.x * off;
    const a = Math.atan2(s.t.y, s.t.x) + (hash(k * 13) - 0.5) * 1.6;
    const l = cell * (0.05 + hash(k * 17) * 0.04);
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
  }
  ctx.stroke();
  ctx.restore();
}

// Dapple: light blotches tied to segments counted from the head, so they
// stay on the same part of the dog as it moves.
function drawPatches(ctx, pts, cell, p) {
  ctx.fillStyle = p.patch;
  for (let i = 1; i < pts.length - 2; i++) {
    if (hash(i * 7 + 1) < 0.35) continue;
    const a = pts[i];
    const b = pts[i + 1];
    const len = dist(a, b);
    if (len === 0) continue;
    const t = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const count = hash(i * 13 + 2) < 0.5 ? 1 : 2;
    for (let j = 0; j < count; j++) {
      const h = hash(i * 31 + j * 17);
      const along = (count === 1 ? 0.5 : 0.25 + j * 0.5) * len + (h - 0.5) * cell * 0.15;
      const side = (hash(i * 19 + j * 5) - 0.5) * cell * 0.2;
      const r = cell * (0.1 + h * 0.05);
      const cx = a.x + t.x * along - t.y * side;
      const cy = a.y + t.y * along + t.x * side;
      blob(ctx, cx, cy, r, h);
    }
  }
}

function blob(ctx, cx, cy, r, h) {
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const ang = h * 6 + k * 2.1;
    const rr = r * (0.65 + hash(h * 100 + k) * 0.35);
    const x = cx + Math.cos(ang) * r * 0.45;
    const y = cy + Math.sin(ang) * r * 0.45;
    ctx.moveTo(x + rr, y);
    ctx.arc(x, y, rr, 0, Math.PI * 2);
  }
  ctx.fill();
}

function drawLegs(ctx, pts, cell, tick, p) {
  const half = cell * 0.55;
  const w = cell * 0.16;
  ctx.fillStyle = p.leg;
  // Just front legs behind the head and back legs before the tail, however long the pup gets.
  const hips = [...new Set([1, Math.max(1, pts.length - 2)])];
  hips.forEach((i, n) => {
    const a = pts[i - 1];
    const b = pts[i + 1];
    const stride = ((n + tick) % 2 ? 1 : -1) * cell * 0.1;
    ctx.save();
    ctx.translate(pts[i].x, pts[i].y);
    ctx.rotate(Math.atan2(a.y - b.y, a.x - b.x));
    ctx.beginPath();
    roundRectPath(ctx, stride - w / 2, -half, w, half * 2, w / 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawTail(ctx, base, angle, cell, time, p, coat) {
  const wag = Math.sin(time / 120) * 0.5;
  const long = coat === 'long';
  const len = cell * (long ? 0.95 : 0.75);
  const w = cell * (long ? 0.17 : 0.14);
  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.rotate(angle + wag);
  if (long) drawPlume(ctx, len, cell, p);
  ctx.beginPath();
  ctx.moveTo(0, -w);
  ctx.quadraticCurveTo(len * 0.6, -w * 0.6, len, 0);
  ctx.quadraticCurveTo(len * 0.6, w * 0.6, 0, w);
  ctx.closePath();
  ctx.fillStyle = p.body;
  ctx.fill();
  ctx.strokeStyle = p.outline;
  ctx.lineWidth = cell * 0.05;
  ctx.stroke();
  ctx.restore();
}

// Long-haired tail: a feathery plume with tufts swept toward the tip.
function drawPlume(ctx, len, cell, p) {
  furPass(ctx, cell, p.outline, lighten(p.body, 0.12), () => {
    ctx.moveTo(len * 1.15, 0);
    ctx.ellipse(len * 0.55, 0, len * 0.6, cell * 0.2, 0, 0, Math.PI * 2);
    for (let k = 0; k < 4; k++) {
      for (const side of [-1, 1]) {
        tuftPath(ctx, {
          x: len * (0.15 + k * 0.22), y: side * cell * 0.12, nx: 0, ny: side, tx: 1, ty: 0,
          len: cell * (0.2 - k * 0.025), width: cell * 0.24, sweep: cell * 0.2,
        });
      }
    }
    tuftPath(ctx, { x: len * 1.05, y: 0, nx: 1, ny: 0, tx: 0, ty: 1, len: cell * 0.2, width: cell * 0.2, sweep: 0 });
  });
}

function drawHead(ctx, at, angle, cell, tick, p, coat) {
  const flap = tick % 2 ? 0.35 : 0.15;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  ctx.lineWidth = cell * 0.06;
  ctx.strokeStyle = p.outline;

  ctx.fillStyle = p.ear;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(-cell * 0.08, side * cell * 0.3);
    ctx.rotate(side * flap);
    earPath(ctx, side, cell, coat);
    ctx.fill();
    ctx.stroke();
    if (coat === 'long') drawEarStrands(ctx, side, cell, p);
    ctx.restore();
  }

  if (coat === 'wire') drawBeard(ctx, cell, p);
  ctx.fillStyle = p.points ?? p.body;
  ellipse(ctx, cell * 0.4, 0, cell * 0.36, cell * 0.22);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = p.body;
  ellipse(ctx, 0, 0, cell * 0.42, cell * 0.4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COLORS.nose;
  ellipse(ctx, cell * 0.74, 0, cell * 0.1, cell * 0.1);
  ctx.fill();

  if (p.points) drawBrowDots(ctx, cell, p);
  if (coat === 'wire') drawBushyBrows(ctx, cell, p);
  drawEyes(ctx, cell);
  ctx.restore();
}

// Ear in the ear's own frame: smooth is the original ellipse, long is ~35%
// longer with a wavy hanging edge, wire is ~20% shorter.
function earPath(ctx, side, cell, coat) {
  const cy = side * cell * 0.06;
  const ry = cell * 0.15;
  if (coat === 'wire') {
    ellipse(ctx, -cell * 0.07, cy, cell * 0.24, ry);
    return;
  }
  if (coat !== 'long') {
    ellipse(ctx, -cell * 0.1, cy, cell * 0.3, ry);
    return;
  }
  // Hangs further back than the smooth ear, with a scalloped, feathered end.
  const cx = -cell * 0.3;
  const rx = cell * 0.47;
  ctx.beginPath();
  for (let k = 0; k <= 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    const back = Math.max(0, -Math.cos(a));
    const wave = 1 + back * 0.16 * Math.abs(Math.sin(a * 5));
    const x = cx + Math.cos(a) * rx * wave;
    const y = cy + Math.sin(a) * ry * (1 + back * 0.25) * wave;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Long-haired: a couple of lighter wavy strands down each ear.
function drawEarStrands(ctx, side, cell, p) {
  ctx.save();
  ctx.strokeStyle = lighten(p.ear, 0.3);
  ctx.lineWidth = cell * 0.035;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const off of [-0.05, 0.05]) {
    const y0 = side * cell * (0.06 + off);
    ctx.moveTo(-cell * 0.1, y0);
    ctx.bezierCurveTo(-cell * 0.3, y0 + cell * 0.05, -cell * 0.45, y0 - cell * 0.05, -cell * 0.65, y0 + cell * 0.02);
  }
  ctx.stroke();
  ctx.restore();
}

function drawEyes(ctx, cell) {
  for (const side of [-1, 1]) {
    ctx.fillStyle = COLORS.eye;
    ellipse(ctx, cell * 0.12, side * cell * 0.17, cell * 0.065, cell * 0.065);
    ctx.fill();
    ctx.fillStyle = COLORS.glint;
    ellipse(ctx, cell * 0.14, side * cell * 0.17 - cell * 0.02, cell * 0.022, cell * 0.022);
    ctx.fill();
  }
}

// Black & tan: the classic tan dot above (behind) each eye.
function drawBrowDots(ctx, cell, p) {
  ctx.fillStyle = p.points;
  for (const side of [-1, 1]) {
    ellipse(ctx, 0, side * cell * 0.13, cell * 0.055, cell * 0.055);
    ctx.fill();
  }
}

// Wire furnishings (beard, brows): tan on a black & tan, otherwise
// a lighter shade of the coat.
function wireAccent(p) {
  return p.points ?? lighten(p.body, 0.3);
}

// Wire-haired: shaggy brows over the outer edge of each eye (drawn under
// the eyes so they never hide them).
function drawBushyBrows(ctx, cell, p) {
  furPass(ctx, cell * 0.8, p.outline, wireAccent(p), () => {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        tuftPath(ctx, {
          x: cell * (0.02 + k * 0.07), y: side * cell * 0.16, nx: 0.55, ny: side * 0.83, tx: 1, ty: 0,
          len: cell * (0.23 - k * 0.03), width: cell * 0.16, sweep: cell * 0.05,
        });
      }
    }
  });
}

// Wire-haired: a shaggy beard framing the muzzle, drawn under it so it shows
// as a scruffy fringe a little wider than the snout, hanging to the sides
// and just past the nose.
function drawBeard(ctx, cell, p) {
  furPass(ctx, cell * 0.7, p.outline, wireAccent(p), () => {
    ctx.moveTo(cell * 0.84, 0);
    ctx.ellipse(cell * 0.48, 0, cell * 0.36, cell * 0.27, 0, 0, Math.PI * 2);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        tuftPath(ctx, {
          x: cell * (0.3 + k * 0.13), y: side * cell * (0.24 - k * 0.03), nx: 0.25, ny: side * 0.97, tx: 1, ty: 0,
          len: cell * (0.12 - k * 0.015), width: cell * 0.14, sweep: cell * 0.04,
        });
      }
    }
    for (const y of [-0.1, 0, 0.1]) {
      tuftPath(ctx, {
        x: cell * 0.8, y: cell * y, nx: 1, ny: y, tx: 0, ty: 1,
        len: cell * 0.1, width: cell * 0.11, sweep: 0,
      });
    }
  });
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
