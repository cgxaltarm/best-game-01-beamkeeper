// BEAMKEEPER — configuration. Every number the game runs on lives here,
// so balance tuning is a one-file edit. Values follow DESIGN.md §2.
// Canvas 1280x720. Play field: x 196..1084, y 56..636. Lighthouse centre.
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

export const FIELD = { x: 196, y: 56, w: 888, h: 580 };
export const LIGHTHOUSE = { x: 640, y: 346, r: 30 };

// Rock pads: a grid of places glass can stand on. The lighthouse clearing
// (within 92 px of centre) holds no pad.
export const PAD_R = 26;
export const PAD_COLS_X = [280, 370, 460, 550, 640, 730, 820, 910, 1000];
export const PAD_ROWS_Y = [110, 188, 266, 344, 422, 500, 578];

export const START_HP = 10;
export const START_EMBERS = 15;

// The beam: a CONE, not a line (DESIGN §2, prototype finding #1). A thin
// line exposes a point ~0.33 s per pass — a Mite can never die. The cone
// gives every point ~8% exposure per revolution.
export const BEAM = {
  halfAngleDeg: 20, // base half-angle; Moth-Glass Lens relic adds +10
  dps: 36, // white-beam damage per second inside the cone
  revSeconds: 12, // one full sweep per 12 s (Fleetfoot: 20% faster)
  range: 980, // max ray length in px
  maxSegments: 24,
  maxReflections: 8,
  baseHalfWidth: 6, // half-width at the lighthouse, before the cone widens
};

// Glass: 5 kinds. Costs in embers. Sell refunds 70%.
export const GLASS = {
  mirror:   { name: 'Mirror',   cost: 3, key: '1', blurb: 'Reflects the beam' },
  splitter: { name: 'Splitter', cost: 5, key: '2', blurb: 'Continues + 90° branch' },
  lens:     { name: 'Lens',     cost: 7, key: '3', blurb: 'Focuses x2.5, short range' },
  prism:    { name: 'Prism',    cost: 8, key: '4', blurb: 'Splits 3 coloured beams' },
  pillar:   { name: 'Pillar',   cost: 1, key: '5', blurb: 'Stone block, blocks path' },
};
export const SELL_REFUND = 0.7;
export const MIRROR_SNAP_DEG = 45; // 8 snap angles
export const PRISM_SPREAD_DEG = 20; // coloured beams fan out +/-20 deg
export const LENS_FOCUS = 2.5; // damage multiplier after a lens
export const LENS_RANGE = 300; // beam range after a lens, px
export const SPLITTER_BRANCH_DEG = 90;

// FLARE: Space. Full-circle burst, 3 s, 60 damage within 260 px, 45 s cd.
export const FLARE = { damage: 60, radius: 260, duration: 3, cooldown: 45 };

// Wraiths: 9 types + 3 bosses. tint: null (white-OK) or a prism colour.
// A Shade is immune to the white beam — only coloured beams hurt it.
// Prowler is armoured: all beam damage x0.5.
export const WRAITHS = {
  mite:     { name: 'Mite',     hp: 12,  speed: 21, embers: 2,  tint: null,      r: 9,  trait: 'fast' },
  wisp:     { name: 'Wisp',     hp: 8,   speed: 34, embers: 2,  tint: 'azure',   r: 7,  trait: 'zigzag' },
  duskmoth: { name: 'Duskmoth', hp: 20,  speed: 19, embers: 4,  tint: 'verdant', r: 11, trait: 'flies over pillars' },
  splitter: { name: 'Splitter', hp: 30,  speed: 18, embers: 5,  tint: 'ruby',    r: 12, trait: 'splits into 2 Mites' },
  burrower: { name: 'Burrower', hp: 25,  speed: 21, embers: 5,  tint: 'verdant', r: 10, trait: 'dives under glass' },
  prowler:  { name: 'Prowler',  hp: 50,  speed: 11, embers: 8,  tint: 'azure',   r: 14, trait: 'armoured x0.5', armoured: true },
  gloom:    { name: 'Gloom',    hp: 100, speed: 9, embers: 15, tint: 'ruby',    r: 18, trait: 'big, slow' },
  shade:    { name: 'Shade',    hp: 30,  speed: 16, embers: 10, tint: null,      r: 12, trait: 'ONLY coloured light hurts', shade: true },
};
export const BOSSES = {
  stag:  { name: 'THE WINTER STAG',  hp: 150,  speed: 16, embers: 100, tint: null, r: 26, night: 3, trait: 'charges the lighthouse', leak: 3 },
  tide:  { name: 'THE TIDE MOTHER',  hp: 350,  speed: 7, embers: 100, tint: null, r: 30, night: 5, trait: 'spawns Mites', leak: 3 },
  king:  { name: 'THE DROWNED KING', hp: 500, speed: 6,  embers: 100, tint: null, r: 32, night: 7, trait: 'darkens the beam -30%', leak: 3 },
};
// Colour multipliers for a beam of a given colour hitting a wraith tint.
export function colourMult(beamColor, wraithTint, isShade) {
  if (beamColor === 'white') return isShade ? 0 : 1;
  if (wraithTint === null || wraithTint === undefined) return 1;
  return beamColor === wraithTint ? 2 : 0.5;
}

// Nights: 7. Counts are the DESIGN totals; the boss arrives mid-night.
export const NIGHTS = [
  { n: 1, total: 14, spawnInterval: 2.2, comp: { mite: 14 } },
  { n: 2, total: 22, spawnInterval: 2.0, comp: { mite: 14, duskmoth: 8 } },
  { n: 3, total: 30, spawnInterval: 1.8, comp: { mite: 16, duskmoth: 6, prowler: 7 }, boss: 'stag' },
  { n: 4, total: 36, spawnInterval: 1.6, comp: { mite: 16, duskmoth: 6, splitter: 6, shade: 8 } },
  { n: 5, total: 42, spawnInterval: 1.4, comp: { mite: 16, duskmoth: 6, prowler: 6, burrower: 8, shade: 5 }, boss: 'tide' },
  { n: 6, total: 48, spawnInterval: 1.25, comp: { mite: 14, wisp: 10, duskmoth: 6, prowler: 6, gloom: 6, shade: 6 } },
  { n: 7, total: 56, spawnInterval: 1.1, comp: { mite: 16, wisp: 8, duskmoth: 8, splitter: 6, burrower: 6, prowler: 6, gloom: 4, shade: 2 }, boss: 'king' },
];
export const NIGHT_CLEAR_EMBERS = 25;
export const NIGHT_CLEAR_SCORE = 100; // x night number

// Relics: 8 in the pool, pick 1 of 3 each dawn.
export const RELICS = [
  { id: 'wick',     name: 'Wick of Plenty',   desc: '+1 ember per kill' },
  { id: 'candle',   name: 'Black Candle',     desc: 'Beam +15% damage' },
  { id: 'moth',     name: 'Moth-Glass Lens',  desc: 'Beam +10 deg wide' },
  { id: 'phoenix',  name: 'Phoenix Feather',  desc: 'Repair +2 HP once per night' },
  { id: 'fleet',    name: 'Fleetfoot',        desc: 'Sweep +20% faster' },
  { id: 'focused',  name: 'Focused Glass',    desc: 'Lens focuses x3.5' },
  { id: 'silvered', name: 'Silvered Edge',    desc: 'Mirrors reflect +1 extra segment' },
  { id: 'shard',    name: 'Spare Shard',      desc: 'FLARE cooldown -15 s' },
];

// Combo: kills within 2 s of each other raise the ember multiplier.
export const COMBO_WINDOW = 2;
export const COMBO_STEPS = [1, 1.25, 2, 3]; // 1st kill x1, then x1.25, x2, x3

export const PRISM_COLORS = ['ruby', 'verdant', 'azure'];
export const COLORS = {
  beamCore: '#ffb020', // deep saturated amber — the prototype's beige is fixed here
  beamEdge: '#ffd97a',
  beamSpine: '#fff7e0',
  ruby: '#ff5a6e',
  verdant: '#4ade80',
  azure: '#38bdf8',
  seaDeep: '#0a0e24',
  seaLight: '#131a3a',
  rock: '#2a3352',
  rockEdge: '#3d4a73',
  wraith: '#b79cff',
  panel: '#101736',
  panelEdge: '#2c3a6e',
  gold: '#ffd97a',
  ink: '#e8ecff',
  dim: '#8b96c9',
  red: '#ff5a6e',
  green: '#4ade80',
};
