// BEAMKEEPER — input: pointer + keyboard, and the UI geometry the
// renderer draws from (one source of truth for hit areas, so a click and
// its button can never drift apart).
import { FIELD, LIGHTHOUSE, GLASS } from './config.js';
import { placeGlass, rotateGlass, sellGlass, triggerFlare, pickRelic, glassAt } from './world.js';
import { sfx } from './sound.js';

// --- UI geometry (canvas 1280x720) ---
export const TOOLBAR = { x: 196, y: 644, w: 888, h: 68 };
export function toolbarCard(i) {
  return { x: TOOLBAR.x + 6 + i * 176, y: TOOLBAR.y + 4, w: 168, h: 60 };
}
export const TITLE_PLAY = { x: 530, y: 462, w: 220, h: 56 };
export const TITLE_HOW = { x: 530, y: 530, w: 220, h: 44 };
export const END_BUTTON = { x: 520, y: 556, w: 240, h: 56 };
export function relicCard(i) {
  return { x: 250 + i * 280, y: 300, w: 260, h: 170 };
}
export const PAUSE_BTN = { x: 1232, y: 10, w: 38, h: 36 };
export const MUTE_BTN = { x: 1188, y: 10, w: 38, h: 36 };

export function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

const KIND_ORDER = ['mirror', 'splitter', 'lens', 'prism', 'pillar'];

export function attachInput(canvas, w, ui) {
  if (w.selectedKind === undefined) w.selectedKind = 'mirror';
  if (w.selectedPad === undefined) w.selectedPad = -1;
  if (w.showHow === undefined) w.showHow = false;
  let draggingPad = -1;

  function toGame(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 1280,
      y: ((e.clientY - r.top) / r.height) * 720,
    };
  }
  function padAt(x, y) {
    let best = null, bestD = Infinity;
    for (const p of w.pads) {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return bestD <= 30 ? best : null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    const { x, y } = toGame(e);
    if (w.screen === 'title') {
      if (inRect(x, y, TITLE_PLAY)) { sfx.click(); ui.onPlay(); return; }
      if (inRect(x, y, TITLE_HOW)) { sfx.click(); w.showHow = !w.showHow; return; }
      return;
    }
    if (w.screen === 'dawn') {
      for (let i = 0; i < 3; i++) {
        if (inRect(x, y, relicCard(i)) && w.draft[i]) {
          sfx.relic();
          pickRelic(w, w.draft[i]);
          return;
        }
      }
      return;
    }
    if (w.screen === 'over' || w.screen === 'win') {
      if (inRect(x, y, END_BUTTON)) { sfx.click(); ui.onPlay(); }
      return;
    }
    if (w.screen !== 'play') return;
    if (inRect(x, y, PAUSE_BTN)) { ui.onPause(); return; }
    if (inRect(x, y, MUTE_BTN)) { ui.onMute(); return; }
    for (let i = 0; i < 5; i++) {
      if (inRect(x, y, toolbarCard(i))) {
        w.selectedKind = KIND_ORDER[i];
        w.selectedPad = -1;
        sfx.click();
        return;
      }
    }
    const pad = padAt(x, y);
    if (!pad) { w.selectedPad = -1; return; }
    const g = glassAt(w, pad.index);
    if (g) {
      w.selectedPad = pad.index;
      if (g.kind === 'mirror') draggingPad = pad.index;
      sfx.click();
    } else if (placeGlass(w, pad.index, w.selectedKind)) {
      w.selectedPad = pad.index;
      sfx.place();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (draggingPad === -1) return;
    const { x, y } = toGame(e);
    const g = glassAt(w, draggingPad);
    if (!g || g.kind !== 'mirror') { draggingPad = -1; return; }
    // Drag to aim: snap the mirror face to the nearest 45 degrees.
    const a = Math.atan2(y - g.y, x - g.x);
    g.angle = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
  });
  const endDrag = () => { draggingPad = -1; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'm') { ui.onMute(); return; }
    if (w.screen === 'title' && (k === 'enter' || k === ' ')) { ui.onPlay(); return; }
    if ((w.screen === 'over' || w.screen === 'win') && (k === 'enter' || k === ' ')) { ui.onPlay(); return; }
    if (k === 'p' && w.screen === 'play') { ui.onPause(); return; }
    if (w.screen !== 'play' || w.paused) return;
    if (k === ' ') { e.preventDefault(); if (triggerFlare(w)) sfx.flare(); return; }
    const kindIndex = ['1', '2', '3', '4', '5'].indexOf(k);
    if (kindIndex !== -1) { w.selectedKind = KIND_ORDER[kindIndex]; w.selectedPad = -1; sfx.click(); return; }
    if (k === 'q' && w.selectedPad !== -1) { rotateGlass(w, w.selectedPad, 1); sfx.click(); return; }
    if (k === 'x' && w.selectedPad !== -1) {
      if (sellGlass(w, w.selectedPad)) { sfx.sell(); w.selectedPad = -1; }
    }
    if (k === 'escape') w.selectedPad = -1;
  });
}

export function glassKindName(kind) { return GLASS[kind].name; }
export { FIELD, LIGHTHOUSE };
