// BEAMKEEPER — the world: state, rules, update step. No DOM here, so the
// same code runs in the browser and in the Node balance simulation.
// The renderer (render.js) only reads this state; input.js only calls the
// action functions below.
import {
  CANVAS_W, FIELD, LIGHTHOUSE, PAD_COLS_X, PAD_ROWS_Y, PAD_R, START_HP,
  START_EMBERS, BEAM, GLASS, SELL_REFUND, FLARE, WRAITHS, BOSSES,
  NIGHT_CLEAR_EMBERS, NIGHT_CLEAR_SCORE, COMBO_WINDOW, COMBO_STEPS,
  PRISM_COLORS,
} from './config.js';
import { makeRng, normAngle, clamp, TAU, DEG } from './random.js';
import { traceBeam, inBeam, segmentMult, PAD_R as BEAM_PAD_R } from './beam.js';
import { buildNight, draftRelics } from './levels.js';

export function buildPads() {
  const pads = [];
  let index = 0;
  for (const y of PAD_ROWS_Y) {
    for (const x of PAD_COLS_X) {
      const d = Math.hypot(x - LIGHTHOUSE.x, y - LIGHTHOUSE.y);
      if (d < 92) continue; // lighthouse clearing
      pads.push({ index: index++, x, y, kind: null, angle: 0, pad: true });
    }
  }
  return pads;
}

export function createWorld(seed = 7) {
  const rng = makeRng(seed);
  return {
    seed, rng,
    screen: 'title', // title | play | dawn | over | win
    paused: false,
    frozen: false, // screenshot staging: render the staged frame, don't advance
    muted: false,
    time: 0,
    night: 1,
    nightTime: 0,
    spawnQueue: [],
    spawnIndex: 0,
    bossSpawned: false,
    bossAt: null,
    bossKey: null,
    hp: START_HP,
    embers: START_EMBERS,
    score: 0,
    kills: 0,
    leaks: 0,
    leakLog: [],
    combo: 1, comboKills: 0, comboTimer: 0,
    beamAngle: -Math.PI / 2,
    glass: [], // { padIndex, x, y, kind, angle }
    pads: buildPads(),
    wraiths: [], // { id, type, boss, x, y, hp, maxHp, speed, tint, r, ... }
    floats: [],
    segments: [],
    flare: { active: 0, cooldown: 0 },
    relics: [],
    draft: [],
    message: '', messageT: 0,
    best: 0,
    nextId: 1,
    nightClears: 0,
    phoenixUsed: false,
    stats: { flareUses: 0, glassPlaced: 0 },
    overReason: '',
  };
}

// --- derived modifiers from owned relics ---
export function hasRelic(w, id) { return w.relics.includes(id); }
export function beamDps(w) {
  let dps = BEAM.dps * (hasRelic(w, 'candle') ? 1.15 : 1);
  if (w.wraiths.some((x) => x.boss === 'king')) dps *= 0.7; // Drowned King aura
  return dps;
}
export function beamHalfAngle(w) {
  return BEAM.halfAngleDeg + (hasRelic(w, 'moth') ? 10 : 0);
}
export function sweepRate(w) {
  return TAU / BEAM.revSeconds * (hasRelic(w, 'fleet') ? 1.2 : 1);
}
export function lensFocus(w) { return hasRelic(w, 'focused') ? 3.5 : BEAM.lensFocus; }
export function flareCooldown(w) { return FLARE.cooldown - (hasRelic(w, 'shard') ? 15 : 0); }
export function emberBonus(w) { return hasRelic(w, 'wick') ? 1 : 0; }

// --- actions ---
export function startGame(w) {
  w.screen = 'play';
  w.paused = false;
  w.night = 1; w.hp = START_HP; w.embers = START_EMBERS;
  w.score = 0; w.kills = 0; w.leaks = 0;
  w.combo = 1; w.comboKills = 0; w.comboTimer = 0;
  w.glass = []; w.wraiths = []; w.floats = [];
  w.relics = []; w.draft = [];
  w.flare = { active: 0, cooldown: 0 };
  w.nightClears = 0; w.phoenixUsed = false;
  w.stats = { flareUses: 0, glassPlaced: 0 };
  w.beamAngle = -Math.PI / 2;
  startNight(w, 1);
}

export function startNight(w, n) {
  const night = buildNight(n, w.rng);
  w.screen = 'play'; // dawn picks land back on the play screen
  w.night = n;
  w.nightTime = 0;
  w.spawnQueue = night.queue;
  w.spawnIndex = 0;
  w.bossSpawned = false;
  w.bossAt = night.bossAt;
  w.bossKey = night.bossKey;
  w.phoenixUsed = false;
  const bossName = night.boss ? ` — ${BOSSES[night.boss].name} walks tonight` : '';
  setMessage(w, `NIGHT ${n} OF 7${bossName}`);
}

export function setMessage(w, text) { w.message = text; w.messageT = 3; }

function padByIndex(w, i) { return w.pads.find((p) => p.index === i); }
export function glassAt(w, padIndex) { return w.glass.find((g) => g.padIndex === padIndex); }

export function placeGlass(w, padIndex, kind) {
  const pad = padByIndex(w, padIndex);
  if (!pad || glassAt(w, padIndex)) return false;
  const def = GLASS[kind];
  if (!def || w.embers < def.cost) return false;
  w.embers -= def.cost;
  w.glass.push({ padIndex, x: pad.x, y: pad.y, kind, angle: kind === 'mirror' ? -45 * DEG : 0 });
  w.stats.glassPlaced++;
  return true;
}

export function rotateGlass(w, padIndex, dir = 1) {
  const g = glassAt(w, padIndex);
  if (!g || g.kind !== 'mirror') return false;
  g.angle = normAngle(g.angle + dir * 45 * DEG);
  return true;
}

export function sellGlass(w, padIndex) {
  const i = w.glass.findIndex((g) => g.padIndex === padIndex);
  if (i === -1) return false;
  const g = w.glass[i];
  w.embers += Math.floor(GLASS[g.kind].cost * SELL_REFUND);
  w.glass.splice(i, 1);
  return true;
}

export function triggerFlare(w) {
  if (w.flare.cooldown > 0 || w.screen !== 'play') return false;
  w.flare.cooldown = flareCooldown(w);
  w.flare.active = FLARE.duration;
  w.stats.flareUses++;
  const cx = LIGHTHOUSE.x, cy = LIGHTHOUSE.y;
  for (const wr of w.wraiths.slice()) {
    if (Math.hypot(wr.x - cx, wr.y - cy) <= FLARE.radius + wr.r) {
      damageWraith(w, wr, FLARE.damage, 'FLARE');
    }
  }
  addFloat(w, cx, cy - 60, 'FLARE!', '#ffd97a', 1.2);
  return true;
}

export function pickRelic(w, id) {
  if (w.screen !== 'dawn' || !w.draft.includes(id)) return false;
  w.relics.push(id);
  if (id === 'phoenix' && w.hp < START_HP) w.hp = Math.min(START_HP, w.hp + 2);
  w.draft = [];
  startNight(w, w.night + 1);
  return true;
}

// --- spawning ---
function spawnPoint(w) {
  const side = w.rng.int(0, 3);
  const m = 14;
  if (side === 0) return { x: w.rng.range(FIELD.x + m, FIELD.x + FIELD.w - m), y: FIELD.y + m };
  if (side === 1) return { x: w.rng.range(FIELD.x + m, FIELD.x + FIELD.w - m), y: FIELD.y + FIELD.h - m };
  if (side === 2) return { x: FIELD.x + m, y: w.rng.range(FIELD.y + m, FIELD.y + FIELD.h - m) };
  return { x: FIELD.x + FIELD.w - m, y: w.rng.range(FIELD.y + m, FIELD.y + FIELD.h - m) };
}

function spawnWraith(w, type, x, y, bossKey = null) {  const def = bossKey ? BOSSES[bossKey] : WRAITHS[type];
  const p = x === undefined ? spawnPoint(w) : { x, y };
  const tint = type === 'shade' ? PRISM_COLORS[w.rng.int(0, 2)] : def.tint;
  const wr = {
    id: w.nextId++, type, boss: bossKey,
    x: p.x, y: p.y, hp: def.hp, maxHp: def.hp,
    speed: def.speed, tint, r: def.r,
    burn: 0, floatAcc: 0, floatTimer: 0,
    phase: w.rng.range(0, TAU),
    burrow: 0, burrowCycle: w.rng.range(2, 4),
    spawnTimer: bossKey === 'tide' ? 6 : 0,
    hitFlash: 0,
  };
  w.wraiths.push(wr);
  return wr;
}

// Staging helper for screenshots / tests: spawn one wraith at an exact spot.
export function spawnAt(w, type, x, y) {
  return spawnWraith(w, type, x, y);
}

// --- combat ---
function addFloat(w, x, y, text, color, size = 1) {
  w.floats.push({ x, y, text, color, life: 0.9, max: 0.9, size });
}

function damageWraith(w, wr, amount, source) {
  if (wr.hp <= 0) return;
  wr.hp -= amount;
  wr.hitFlash = 0.12;
  wr.floatAcc += amount;
  if (wr.hp <= 0) killWraith(w, wr, source);
}

function killWraith(w, wr, source) {
  const def = wr.boss ? BOSSES[wr.boss] : WRAITHS[wr.type];
  w.kills++;
  w.score += 10;
  // Combo: kills within the window step the multiplier up.
  if (w.comboTimer > 0) w.comboKills++; else w.comboKills = 1;
  w.comboTimer = COMBO_WINDOW;
  const step = Math.min(w.comboKills - 1, COMBO_STEPS.length - 1);
  w.combo = COMBO_STEPS[step];
  const gain = Math.round((def.embers + emberBonus(w)) * w.combo);
  w.embers += gain;
  addFloat(w, wr.x, wr.y - 14, `+${gain}${w.combo > 1 ? ' x' + w.combo : ''}`, '#ffd97a', w.combo >= 2 ? 1.25 : 1);
  if (wr.type === 'splitter') {
    for (let i = 0; i < 2; i++) {
      const m = spawnWraith(w, 'mite', wr.x + (i === 0 ? -14 : 14), wr.y + 8);
      m.hp = WRAITHS.mite.hp;
    }
  }
  w.wraiths = w.wraiths.filter((x) => x !== wr);
}

function leakWraith(w, wr) {
  const leak = wr.boss ? 3 : 1;
  w.hp -= leak;
  w.leaks++;
  w.leakLog.push({ type: wr.boss || wr.type, night: w.night, hpAfter: w.hp });
  addFloat(w, LIGHTHOUSE.x, LIGHTHOUSE.y - 44, `-${leak} HP`, '#ff5a6e', 1.3);
  w.wraiths = w.wraiths.filter((x) => x !== wr);
  if (hasRelic(w, 'phoenix') && !w.phoenixUsed && w.hp > 0) {
    w.phoenixUsed = true;
    w.hp = Math.min(START_HP, w.hp + 2);
    addFloat(w, LIGHTHOUSE.x, LIGHTHOUSE.y - 70, 'Phoenix Feather +2 HP', '#4ade80', 1.1);
  }
}

// --- the update step ---
export function update(w, dt) {
  if (w.screen !== 'play' || w.paused) return;
  dt = Math.min(dt, 0.05);
  w.time += dt;
  w.nightTime += dt;
  if (w.messageT > 0) w.messageT -= dt;
  if (w.comboTimer > 0) {
    w.comboTimer -= dt;
    if (w.comboTimer <= 0) { w.combo = 1; w.comboKills = 0; }
  }
  if (w.flare.cooldown > 0) w.flare.cooldown -= dt;
  if (w.flare.active > 0) w.flare.active -= dt;

  // Beam sweeps continuously — damage is periodic, timing matters.
  w.beamAngle = normAngle(w.beamAngle + sweepRate(w) * dt);

  // Spawning.
  while (w.spawnIndex < w.spawnQueue.length && w.spawnQueue[w.spawnIndex].at <= w.nightTime) {
    spawnWraith(w, w.spawnQueue[w.spawnIndex].type);
    w.spawnIndex++;
  }
  if (w.bossKey && !w.bossSpawned && w.bossAt !== null && w.nightTime >= w.bossAt) {
    w.bossSpawned = true;
    spawnWraith(w, w.bossKey, undefined, undefined, w.bossKey);
    setMessage(w, `${BOSSES[w.bossKey].name} HAS COME`);
  }

  // Trace the beam through the glass on the rocks.
  retrace(w);
  const dps = beamDps(w);

  // Move + burn wraiths.
  const pillars = w.glass.filter((g) => g.kind === 'pillar');
  for (const wr of w.wraiths.slice()) {
    if (wr.hp <= 0) continue;
    // Burrower dive cycle: under the glass, untargetable, faster.
    let burrowed = false;
    if (wr.type === 'burrower') {
      wr.burrowCycle -= dt;
      if (wr.burrowCycle <= 0) { wr.burrow = wr.burrow > 0 ? 0 : 1.5; wr.burrowCycle = wr.burrow > 0 ? 1.5 : w.rng.range(2.5, 4); }
      burrowed = wr.burrow > 0;
    }
    // Tide Mother spawns Mites while she lives.
    if (wr.boss === 'tide') {
      wr.spawnTimer -= dt;
      if (wr.spawnTimer <= 0) {
        wr.spawnTimer = 8;
        spawnWraith(w, 'mite', clamp(wr.x + w.rng.range(-30, 30), FIELD.x + 10, FIELD.x + FIELD.w - 10), clamp(wr.y + w.rng.range(-30, 30), FIELD.y + 10, FIELD.y + FIELD.h - 10));
      }
    }
    // Movement toward the lighthouse.
    let speed = wr.speed;
    const dxL = LIGHTHOUSE.x - wr.x, dyL = LIGHTHOUSE.y - wr.y;
    const distL = Math.hypot(dxL, dyL) || 1;
    if (wr.boss === 'stag' && distL < 220) speed *= 1.3; // the Stag charges
    if (burrowed) speed *= 1.6;
    let mx = (dxL / distL) * speed * dt;
    let my = (dyL / distL) * speed * dt;
    if (wr.type === 'wisp') {
      const s = Math.sin(w.time * 6 + wr.phase) * 26 * dt;
      mx += (-dyL / distL) * s;
      my += (dxL / distL) * s;
    }
    // Pillars block the ground-bound: slide around them.
    if (wr.type !== 'duskmoth' && pillars.length > 0) {
      const nx = wr.x + mx, ny = wr.y + my;
      for (const p of pillars) {
        if (Math.hypot(nx - p.x, ny - p.y) < BEAM_PAD_R + wr.r + 2) {
          const tx = -my, ty = mx; // sidestep tangentially
          mx = tx * 0.9; my = ty * 0.9;
          break;
        }
      }
    }
    wr.x = clamp(wr.x + mx, FIELD.x + 6, FIELD.x + FIELD.w - 6);
    wr.y = clamp(wr.y + my, FIELD.y + 6, FIELD.y + FIELD.h - 6);

    // Beam damage: centre inside any cone segment.
    if (!burrowed) {
      const def = wr.boss ? BOSSES[wr.boss] : WRAITHS[wr.type];
      for (const seg of w.segments) {
        if (inBeam(wr.x, wr.y, seg, wr.r)) {
          const mult = segmentMult(seg, def, lensFocus(w));
          if (mult > 0) {
            const dmg = dps * mult * dt;
            wr.hp -= dmg;
            wr.burn = 0.25;
            wr.floatAcc += dmg;
          }
          break; // one segment burns a wraith per tick
        }
      }
    }
    if (wr.burn > 0) wr.burn -= dt;
    if (wr.hitFlash > 0) wr.hitFlash -= dt;
    // Floating damage numbers, flushed twice a second per wraith.
    wr.floatTimer += dt;
    if (wr.floatAcc >= 5 && wr.floatTimer >= 0.5) {
      addFloat(w, wr.x, wr.y - wr.r - 6, `-${Math.round(wr.floatAcc)}`, '#ffb020', 0.9);
      wr.floatAcc = 0; wr.floatTimer = 0;
    }
    if (wr.hp <= 0) { killWraith(w, wr, 'beam'); continue; }
    // Reached the lighthouse: the flame takes the hit.
    const distNow = Math.hypot(LIGHTHOUSE.x - wr.x, LIGHTHOUSE.y - wr.y);
    if (distNow <= LIGHTHOUSE.r + wr.r + 2) leakWraith(w, wr);
  }

  // Floating numbers drift up and fade.
  for (const f of w.floats) { f.y -= 22 * dt; f.life -= dt; }
  w.floats = w.floats.filter((f) => f.life > 0);

  if (w.hp <= 0) {
    w.hp = 0;
    w.screen = 'over';
    w.overReason = `The dark took the flame on night ${w.night}.`;
    if (w.score > w.best) w.best = w.score;
    return;
  }

  // Night cleared: queue done, board empty, boss gone.
  const bossAlive = w.wraiths.some((x) => x.boss);
  if (w.spawnIndex >= w.spawnQueue.length && w.wraiths.length === 0 && !bossAlive) {
    w.nightClears++;
    w.score += NIGHT_CLEAR_SCORE * w.night;
    w.embers += NIGHT_CLEAR_EMBERS;
    if (w.night >= 7) {
      w.score += 500 * w.hp;
      if (w.score > w.best) w.best = w.score;
      w.screen = 'win';
      return;
    }
    w.draft = draftRelics(w.relics, w.rng);
    w.screen = 'dawn';
  }
}

// Recompute the beam segments for the world's current angle and glass.
// Used every tick by update(), and once by the screenshot staging after
// it aims the beam at a prism / boss.
export function retrace(w) {
  const glass = w.glass.map((g) => ({ x: g.x, y: g.y, kind: g.kind, angle: g.angle }));
  w.segments = traceBeam(
    { x: LIGHTHOUSE.x, y: LIGHTHOUSE.y }, w.beamAngle, glass,
    {
      range: BEAM.range,
      halfAngleDeg: beamHalfAngle(w),
      baseHalfWidth: BEAM.baseHalfWidth,
      maxSegments: BEAM.maxSegments,
      maxReflections: BEAM.maxReflections + (hasRelic(w, 'silvered') ? 1 : 0),
      lensFocus: lensFocus(w),
      lensRange: BEAM.lensRange,
    },
  );
}

// --- helpers for HUD / tests ---
export function incomingLeft(w) {
  const total = w.spawnQueue.length - w.spawnIndex;
  const alive = w.wraiths.length;
  return total + alive + (w.bossKey && !w.bossSpawned ? 1 : 0);
}

export function nightBossName(w) {
  return w.bossKey ? BOSSES[w.bossKey].name : null;
}

// --- auto-player: plays the real rules (used by the balance sim and the
// victory screenshot staging). Buys glass by priority, re-aims mirrors at
// the densest wraith cluster, fires FLARE into crowds near the flame.
export function autoPlayStep(w, dt) {
  // Dawn: take the best relic on offer (checked before the play gate —
  // the world sits on the dawn screen between nights).
  if (w.screen === 'dawn' && w.draft.length > 0) {
    const prio = ['candle', 'moth', 'shard', 'phoenix', 'fleet', 'focused', 'wick', 'silvered'];
    for (const id of prio) {
      if (w.draft.includes(id)) { pickRelic(w, id); break; }
    }
    return;
  }
  if (w.screen !== 'play') return;
  // 1. Buy glass while affordable, in priority order.
  const want = [];
  const mirrors = w.glass.filter((g) => g.kind === 'mirror').length;
  const prisms = w.glass.filter((g) => g.kind === 'prism').length;
  const lenses = w.glass.filter((g) => g.kind === 'lens').length;
  const splitters = w.glass.filter((g) => g.kind === 'splitter').length;
  if (mirrors < 2) want.push('mirror');
  if (w.night >= 2 && lenses < 1) want.push('lens');
  if (w.night >= 2 && prisms < 1) want.push('prism');
  if (w.night >= 4 && mirrors < 4) want.push('mirror');
  if (w.night >= 4 && prisms < 2) want.push('prism');
  if (w.night >= 5 && splitters < 1) want.push('splitter');
  if (w.night >= 6 && prisms < 3) want.push('prism');
  if (w.night >= 6 && lenses < 2) want.push('lens');
  for (const kind of want) {
    const pad = bestPadFor(w, kind);
    if (pad !== null && w.embers >= { mirror: 3, splitter: 5, lens: 7, prism: 8, pillar: 1 }[kind]) {
      placeGlass(w, pad, kind);
    }
  }
  // 2. Re-aim mirrors at the densest cluster every step (cheap: snapped).
  if (w.wraiths.length > 0) {
    const target = densestCluster(w);
    for (const g of w.glass) {
      if (g.kind !== 'mirror') continue;
      const bearing = Math.atan2(target.y - g.y, target.x - g.x);
      const m = normAngle((w.beamAngle + bearing) / 2);
      g.angle = Math.round(m / (45 * DEG)) * 45 * DEG % TAU;
    }
  }
  // 3. FLARE into a crowd near the flame, a boss in range, or Shades
  // closing in (FLARE is the one thing that always hurts a Shade).
  if (w.flare.cooldown <= 0) {
    const near = w.wraiths.filter((x) => Math.hypot(x.x - LIGHTHOUSE.x, x.y - LIGHTHOUSE.y) <= FLARE.radius);
    const bossNear = near.some((x) => x.boss);
    const shadeNear = w.wraiths.some((x) => x.type === 'shade' && Math.hypot(x.x - LIGHTHOUSE.x, x.y - LIGHTHOUSE.y) <= 300);
    if (near.length >= 4 || bossNear || shadeNear) triggerFlare(w);
  }
}

// Pads ranked for each glass kind: mirrors on the mid ring, lens close to
// the flame, prism mid-field where the beam crosses often, splitter wide.
const PAD_SPOTS = {
  mirror: [1, 2, 3, 4, 5, 6],
  lens: [0, 1, 2],
  prism: [2, 3, 4],
  splitter: [3, 4, 5],
};
export function bestPadFor(w, kind) {
  const cx = LIGHTHOUSE.x, cy = LIGHTHOUSE.y;
  const free = w.pads.filter((p) => !glassAt(w, p.index));
  if (free.length === 0) return null;
  const ring = (p) => Math.hypot(p.x - cx, p.y - cy);
  const sorted = free.slice().sort((a, b) => ring(a) - ring(b));
  if (kind === 'lens') return sorted[0].index; // closest free pad
  if (kind === 'prism') return sorted[0].index; // closest free pad: lit longest, coloured beams cover the approach
  if (kind === 'splitter') return sorted[Math.min(5, sorted.length - 1)].index;
  // mirror: spread around the ring — take the free pad nearest a 90-degree slot
  const used = w.glass.filter((g) => g.kind === 'mirror').length;
  const wantAngle = (used * Math.PI) / 2 + Math.PI / 4;
  let best = null, bestD = Infinity;
  for (const p of free) {
    const a = Math.atan2(p.y - cy, p.x - cx);
    let d = Math.abs(normAngle(a - wantAngle));
    if (d > Math.PI) d = TAU - d;
    const rScore = Math.abs(ring(p) - 200) / 100;
    const score = d + rScore;
    if (score < bestD) { bestD = score; best = p; }
  }
  return best ? best.index : sorted[0].index;
}

function densestCluster(w) {
  // Average position of the 5 wraiths nearest the lighthouse.
  const near = w.wraiths.slice().sort((a, b) => {
    const da = Math.hypot(a.x - LIGHTHOUSE.x, a.y - LIGHTHOUSE.y);
    const db = Math.hypot(b.x - LIGHTHOUSE.x, b.y - LIGHTHOUSE.y);
    return da - db;
  }).slice(0, 5);
  let x = 0, y = 0;
  for (const wr of near) { x += wr.x; y += wr.y; }
  return { x: x / Math.max(1, near.length), y: y / Math.max(1, near.length) };
}
