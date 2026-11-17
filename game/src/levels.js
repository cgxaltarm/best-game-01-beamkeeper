// BEAMKEEPER — night compositions and the dawn relic draft.
// A night is a shuffled queue of spawns: [{ type, at }] with `at` the
// seconds after night start, plus an optional boss that walks in mid-night.
import { NIGHTS, BOSSES, RELICS } from './config.js';

// Build the spawn queue for night `n` (1-based) with seeded RNG.
// Spawns are spread evenly across the night's spawn window; the boss, when
// there is one, enters once a third of the queue has spawned.
export function buildNight(n, rng) {
  const def = NIGHTS[n - 1];
  const types = [];
  for (const [type, count] of Object.entries(def.comp)) {
    for (let i = 0; i < count; i++) types.push(type);
  }
  const shuffled = rng.shuffle(types);
  const interval = def.spawnInterval;
  const queue = shuffled.map((type, i) => ({ type, at: 1 + i * interval }));
  let bossAt = null;
  if (def.boss) {
    bossAt = 1 + Math.floor(queue.length / 3) * interval;
  }
  return { n, total: def.total, interval, queue, boss: def.boss ?? null, bossAt, bossKey: def.boss ?? null };
}

// Human-readable incoming list for the HUD: [{ type, count, trait }].
export function incomingSummary(n) {
  const def = NIGHTS[n - 1];
  const out = [];
  for (const [type, count] of Object.entries(def.comp)) out.push({ type, count });
  if (def.boss) out.push({ type: def.boss, count: 1, boss: true });
  return out;
}

export function bossDef(key) { return BOSSES[key]; }

// Dawn draft: pick 3 distinct relic IDs the player does not already own.
export function draftRelics(ownedIds, rng) {
  const pool = RELICS.filter((r) => !ownedIds.includes(r.id));
  const shuffled = rng.shuffle(pool);
  return shuffled.slice(0, 3).map((r) => r.id);
}

export function relicById(id) { return RELICS.find((r) => r.id === id); }
