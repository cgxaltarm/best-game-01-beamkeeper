// BEAMKEEPER — the beam tracer. Pure functions, no DOM, Node-testable.
// The beam is a CONE: every segment widens as it travels, so a wraith is
// exposed for a real stretch of each sweep instead of an instant (a thin
// line beam kills nothing — see DESIGN §2 / prototype finding #1).
//
// traceBeam(origin, angle, glass, opts) walks one ray from the lighthouse,
// bouncing off mirrors, branching at splitters, focusing through lenses and
// splitting into three coloured beams at prisms, and returns the list of
// cone segments the renderer draws and the damage step tests against.
//
// A segment: { x1, y1, x2, y2, color, focused, w0, w1 }
//   (x1,y1)->(x2,y2) is the centre line; w0/w1 are the half-widths at each
//   end, so the cone widens along its length. color is 'white' | 'ruby' |
//   'verdant' | 'azure'. focused segments come out of a lens.
import { rayDisc, reflectDir, normAngle, DEG, TAU } from './random.js';
import { colourMult } from './config.js';

export const PAD_R = 26;
const DEFAULTS = {
  range: 980,
  halfAngleDeg: 14,
  baseHalfWidth: 6,
  maxSegments: 24,
  maxReflections: 8,
  lensFocus: 2.5,
  lensRange: 300,
  prismSpreadDeg: 20,
  splitterBranchDeg: 90,
};

// Half-width of the cone `d` px along a segment.
function halfWidth(d, halfAngleRad, base, focused) {
  const spread = focused ? halfAngleRad * 0.5 : halfAngleRad;
  const b = focused ? base * 0.6 : base;
  return b + Math.tan(spread) * d;
}

export function traceBeam(origin, angle, glass, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const halfRad = o.halfAngleDeg * DEG;
  const segments = [];
  // Ray queue: each entry is one beam leg to trace.
  const queue = [{
    x: origin.x, y: origin.y, angle: normAngle(angle), color: 'white',
    focused: false, range: o.range, reflections: 0, fromPad: -1, depth: 0,
  }];
  let guard = 0;
  while (queue.length > 0 && segments.length < o.maxSegments && guard++ < 200) {
    const ray = queue.shift();
    const dx = Math.cos(ray.angle), dy = Math.sin(ray.angle);
    // Nearest glass pad this leg hits, inside its range.
    let hit = null;
    for (let i = 0; i < glass.length; i++) {
      if (i === ray.fromPad) continue;
      const g = glass[i];
      const t = rayDisc(ray.x, ray.y, dx, dy, g.x, g.y, PAD_R);
      if (t !== null && t <= ray.range && (hit === null || t < hit.t)) hit = { t, index: i, g };
    }
    const endD = hit === null ? ray.range : hit.t;
    const ex = ray.x + dx * endD, ey = ray.y + dy * endD;
    const w0 = halfWidth(0, halfRad, o.baseHalfWidth, ray.focused);
    const w1 = halfWidth(endD, halfRad, o.baseHalfWidth, ray.focused);
    segments.push({ x1: ray.x, y1: ray.y, x2: ex, y2: ey, color: ray.color, focused: ray.focused, w0, w1 });
    if (hit === null) continue;
    if (segments.length >= o.maxSegments) break;
    const g = hit.g;
    const hx = ray.x + dx * hit.t, hy = ray.y + dy * hit.t;
    // Step just past the pad so the next leg cannot re-hit it.
    const step = (a, extra = 0) => ({
      x: hx + Math.cos(a) * (PAD_R + 2 + extra),
      y: hy + Math.sin(a) * (PAD_R + 2 + extra),
    });
    if (g.kind === 'pillar') {
      continue; // stone blocks the beam dead.
    }
    if (g.kind === 'mirror') {
      if (ray.reflections >= o.maxReflections) continue;
      const r = reflectDir(dx, dy, g.angle ?? 0);
      const na = Math.atan2(r.dy, r.dx);
      const p = step(na);
      queue.push({ x: p.x, y: p.y, angle: normAngle(na), color: ray.color, focused: ray.focused, range: o.range, reflections: ray.reflections + 1, fromPad: hit.index, depth: ray.depth + 1 });
    } else if (g.kind === 'splitter') {
      const p = step(ray.angle);
      queue.push({ x: p.x, y: p.y, angle: ray.angle, color: ray.color, focused: ray.focused, range: o.range, reflections: ray.reflections, fromPad: hit.index, depth: ray.depth + 1 });
      const ba = normAngle(ray.angle + o.splitterBranchDeg * DEG);
      const bp = step(ba);
      queue.push({ x: bp.x, y: bp.y, angle: ba, color: ray.color, focused: ray.focused, range: o.range, reflections: ray.reflections, fromPad: hit.index, depth: ray.depth + 1 });
    } else if (g.kind === 'lens') {
      const p = step(ray.angle);
      queue.push({ x: p.x, y: p.y, angle: ray.angle, color: ray.color, focused: true, range: o.lensRange, reflections: ray.reflections, fromPad: hit.index, depth: ray.depth + 1 });
    } else if (g.kind === 'prism') {
      for (const [ci, color] of ['ruby', 'verdant', 'azure'].entries()) {
        const a = normAngle(ray.angle + (ci - 1) * o.prismSpreadDeg * DEG);
        const p = step(a);
        queue.push({ x: p.x, y: p.y, angle: a, color, focused: false, range: o.range, reflections: ray.reflections, fromPad: hit.index, depth: ray.depth + 1 });
      }
    }
  }
  return segments;
}

// Is point (px,py) — a wraith centre — inside the cone of `seg`?
// `pad` is the wraith's radius: the centre may sit just outside the edge
// while its body is still in the light.
export function inBeam(px, py, seg, pad = 0) {
  const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - seg.x1) * dx + (py - seg.y1) * dy) / len2;
  // The cone has flat caps: a point past either end is outside the light,
  // however wide the far end is. (Without this, the wide tip would claim
  // wraiths standing beyond the beam's reach.)
  if (t < -0.001 || t > 1.001) return false;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const cx = seg.x1 + dx * t, cy = seg.y1 + dy * t;
  const d = Math.hypot(px - cx, py - cy);
  const half = seg.w0 + (seg.w1 - seg.w0) * t;
  return d <= half + pad;
}

// Damage multiplier for one beam segment hitting a wraith definition.
// Colour match x2 / mismatch x0.5, Shade immune to white, Prowler armoured.
export function segmentMult(seg, def, lensFocus) {
  const isShade = def && def.shade === true;
  let m = colourMult(seg.color, def ? def.tint : null, isShade);
  if (def && def.armoured) m *= 0.5;
  if (seg.focused) m *= lensFocus;
  return m;
}
