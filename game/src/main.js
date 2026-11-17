// BEAMKEEPER — bootstrap: canvas, game loop, screen wiring, test hooks.
// The game itself lives in world.js (rules) + render.js (drawing);
// this file only connects them to the browser.
import { CANVAS_W, CANVAS_H } from './config.js';
import { createWorld, startGame, update, autoPlayStep } from './world.js';
import { render } from './render.js';
import { attachInput } from './input.js';
import { applyShot, stageDemo } from './shots.js';
import { sfx, startHum, setMuted } from './sound.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7) || 7;
const shot = params.get('shot') || null;

const world = createWorld(seed);
try {
  const best = Number(localStorage.getItem('beamkeeper-best') || 0);
  if (Number.isFinite(best)) world.best = best;
} catch { /* storage may be unavailable */ }

function saveBest() {
  try {
    if (world.best > 0) localStorage.setItem('beamkeeper-best', String(world.best));
  } catch { /* storage may be unavailable */ }
}

function onPlay() {
  startGame(world);
  startHum();
  sfx.horn();
}
function onPause() {
  if (world.screen !== 'play') return;
  world.paused = !world.paused;
  sfx.click();
}
function onMute() {
  world.muted = !world.muted;
  setMuted(world.muted);
  sfx.click();
}

attachInput(canvas, world, { onPlay, onPause, onMute });

// Title screen sits over a live demo board (real glass, real wraiths,
// the beam sweeping) so the cover frame is the game itself.
if (!shot) stageDemo(world);
if (shot) {
  const res = applyShot(world, shot, seed);
  world.shotResult = res;
}

// --- sound cues, polled from world state each frame ---
let lastKills = 0, lastHp = world.hp, lastNight = 1, lastScreen = world.screen;
function pollSfx() {
  if (world.kills > lastKills) { sfx.kill(); lastKills = world.kills; }
  if (world.hp < lastHp) { sfx.leak(); lastHp = world.hp; }
  if (world.night !== lastNight) {
    if (world.screen === 'play') sfx.horn();
    lastNight = world.night;
  }
  if (world.screen !== lastScreen) {
    if (world.screen === 'win') { sfx.win(); saveBest(); }
    if (world.screen === 'over') { sfx.lose(); saveBest(); }
    lastScreen = world.screen;
  }
}

// --- main loop ---
let last = performance.now();
let timeScale = 1;
let ambientT = 0;
function frame(now) {
  const rawDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const dt = rawDt * timeScale;
  if (world.frozen) {
    // Staged screenshot frame: render exactly what was staged, don't advance.
  } else if (world.screen === 'title') {
    // Ambient drift behind the title: the beam sweeps, wraiths crawl in
    // from the dark edge and loop back out. No damage, no leaks — it is
    // a backdrop, not a night.
    ambientT += dt;
    world.beamAngle += (Math.PI * 2 / 12) * dt;
    for (const wr of world.wraiths) {
      const dx = 640 - wr.x, dy = 346 - wr.y;
      const d = Math.hypot(dx, dy) || 1;
      wr.x += (dx / d) * 9 * dt;
      wr.y += (dy / d) * 9 * dt;
      if (d < 120) { wr.x = 220 + Math.random() * 840; wr.y = 80 + Math.random() * 520; }
    }
    world.time += dt;
  } else {
    update(world, dt);
  }
  pollSfx();
  try {
    render(ctx, world, now / 1000);
  } catch (err) {
    // A render bug must never freeze the game loop: log it and keep going.
    console.error('render error', err);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- test hooks (headless play / balance / screenshot runs) ---
window.__BEAMKEEPER__ = {
  world,
  version: 'beamkeeper-1.0',
  startGame: () => onPlay(),
  update: (dt) => update(world, dt),
  autoPlayStep: (dt) => autoPlayStep(world, dt),
  setTimeScale: (s) => { timeScale = s; },
  applyShot: (name) => applyShot(world, name, seed),
  state: () => ({
    screen: world.screen,
    night: world.night,
    hp: world.hp,
    score: world.score,
    kills: world.kills,
    embers: world.embers,
    glass: world.glass.length,
    wraiths: world.wraiths.length,
    relics: world.relics.slice(),
    paused: world.paused,
    shotResult: world.shotResult || null,
  }),
};
