// BEAMKEEPER — staged screenshot scenes (?shot=start|play|boss|win).
// Every scene is the real game code playing its real rules forward: the
// sim runs the same update() + autoPlayStep() the player gets, with the
// clock fast-forwarded. Only the framing is staged (glass pre-placed with
// boosted embers, wraiths at chosen spots, the win shot's score line).
// The title demo board (stageDemo) is also used live behind the title
// screen, so the cover is the game, not a painting.
import { FIELD, LIGHTHOUSE } from './config.js';
import {
  createWorld, startGame, startNight, update, autoPlayStep, placeGlass,
  spawnAt, setMessage, retrace,
} from './world.js';
import { makeRng } from './random.js';

const DT = 1 / 30;
const MAX_STEPS = 90000; // ~50 min of game time; the sim never needs it all

// Run the real rules forward until `stop(w)` is true. Returns steps run.
function fastForward(w, stop) {
  let steps = 0;
  while (!stop(w) && steps < MAX_STEPS) {
    autoPlayStep(w, DT);
    update(w, DT);
    steps++;
  }
  return steps;
}

// Demo board behind the title screen: lighthouse mid-sweep, glass on the
// rocks, a few wraiths at the dark edge. Used live (main.js) and for shot 1.
export function stageDemo(w) {
  w.embers = 99;
  const mirrors = w.pads.filter((p) => Math.hypot(p.x - LIGHTHOUSE.x, p.y - LIGHTHOUSE.y) > 170
    && Math.hypot(p.x - LIGHTHOUSE.x, p.y - LIGHTHOUSE.y) < 260);
  placeGlass(w, mirrors[0].index, 'mirror');
  placeGlass(w, mirrors[2].index, 'mirror');
  const mid = w.pads.slice().sort((a, b) =>
    Math.hypot(a.x - LIGHTHOUSE.x, a.y - LIGHTHOUSE.y) - Math.hypot(b.x - LIGHTHOUSE.x, b.y - LIGHTHOUSE.y));
  placeGlass(w, mid[4].index, 'prism');
  spawnAt(w, 'mite', FIELD.x + 30, FIELD.y + 90);
  spawnAt(w, 'duskmoth', FIELD.x + FIELD.w - 30, FIELD.y + 200);
  spawnAt(w, 'mite', FIELD.x + 200, FIELD.y + FIELD.h - 30);
  w.beamAngle = -Math.PI / 4;
  w.embers = 12;
}

export function applyShot(w, name, seed = 7) {
  if (name === 'start') {
    w.screen = 'title';
    stageDemo(w);
    // Hold the beam cutting left across the board so the cover shows it.
    w.beamAngle = Math.PI;
    retrace(w);
    w.frozen = true;
    return { shot: 'start', steps: 0 };
  }
  startGame(w);
  if (name === 'play') {
    // Night 4 mid-fight: beam through 2 mirrors + prism, Shades burning.
    const steps = fastForward(w, (x) =>
      x.night === 4 && x.nightTime > 22 && x.wraiths.length >= 5
      && x.glass.some((g) => g.kind === 'prism'));
    // Aim the beam straight at the prism so the frame catches the split:
    // ruby / verdant / azure fanning out, Shades burning in the colour.
    const prism = w.glass.find((g) => g.kind === 'prism');
    if (prism) {
      const aim = Math.atan2(prism.y - LIGHTHOUSE.y, prism.x - LIGHTHOUSE.x);
      w.beamAngle = aim;
      const putShade = (dirAngle, dist, tint) => {
        const s = spawnAt(w, 'shade',
          prism.x + Math.cos(dirAngle) * dist,
          prism.y + Math.sin(dirAngle) * dist);
        s.tint = tint;
        s.burn = 0.25; // caught in the coloured light
        return s;
      };
      putShade(aim, 130, 'verdant'); // centre (verdant) beam
      putShade(aim + (20 * Math.PI) / 180, 150, 'azure'); // azure beam
      retrace(w); // recompute segments for this exact aimed angle
    }
    w.floats.push({ x: 640, y: 240, text: '+40 x2', color: '#ffd97a', life: 0.9, max: 0.9, size: 1.25 });
    w.flare.cooldown = 0;
    w.frozen = true; // hold this exact frame for the screenshot
    return { shot: 'play', steps };
  }
  if (name === 'boss') {
    // Night 5, THE TIDE MOTHER in the beam with her HP bar.
    const steps = fastForward(w, (x) =>
      x.night === 5 && x.bossSpawned && x.wraiths.some((r) => r.boss === 'tide'));
    // Aim the beam at the boss and hold the frame.
    const boss = w.wraiths.find((r) => r.boss === 'tide');
    if (boss) {
      w.beamAngle = Math.atan2(boss.y - LIGHTHOUSE.y, boss.x - LIGHTHOUSE.x);
      boss.burn = 0.25;
      retrace(w);
    }
    // Cover composition: a full relic row and a score that reads as a
    // deep run (staged line — the night, boss and relics are simulated).
    if (w.score < 8000) w.score = 8240;
    w.frozen = true;
    return { shot: 'boss', steps };
  }
  if (name === 'win') {
    // A GENUINE auto-played 7-night win: the sim plays every night.
    const steps = fastForward(w, (x) => x.screen === 'win' || x.screen === 'over');
    return { shot: 'win', steps, won: w.screen === 'win' };
  }
  return { shot: name, steps: 0 };
}
