// Seeded RNG (mulberry32) + small helpers. The whole game runs off one
// stream per run so tests can replay a night exactly by seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(min, max) { return min + (max - min) * next(); },
    int(min, max) { return Math.floor(min + (max - min + 1) * next()); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    // Fisher-Yates shuffle, returns a new array.
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const t = out[i]; out[i] = out[j]; out[j] = t;
      }
      return out;
    },
  };
}

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export function normAngle(a) {
  a %= TAU;
  if (a < 0) a += TAU;
  return a;
}
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function dist2(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
}
// Distance from point (px,py) to segment (x1,y1)-(x2,y2), plus the
// projection fraction t along the segment (0 at start, 1 at end).
export function pointSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const cx = x1 + dx * t, cy = y1 + dy * t;
  return { d: Math.hypot(px - cx, py - cy), t };
}
// Ray (ox,oy) direction (dx,dy unit) vs circle (cx,cy,r): nearest hit
// distance along the ray, or null when there is no hit ahead.
export function rayDisc(ox, oy, dx, dy, cx, cy, r) {
  const oxc = cx - ox, oyc = cy - oy;
  const along = oxc * dx + oyc * dy;
  if (along < 0) return null;
  const perp2 = oxc * oxc + oyc * oyc - along * along;
  const r2 = r * r;
  if (perp2 > r2) return null;
  const half = Math.sqrt(Math.max(0, r2 - perp2));
  const t = along - half;
  return t < 0 ? 0 : t;
}
// Reflect direction (dx,dy) off a mirror whose face angle is `mirrorAngle`
// (the mirror line itself). Returns the new unit direction.
export function reflectDir(dx, dy, mirrorAngle) {
  const nx = -Math.sin(mirrorAngle), ny = Math.cos(mirrorAngle);
  const dot = dx * nx + dy * ny;
  return { dx: dx - 2 * dot * nx, dy: dy - 2 * dot * ny };
}
