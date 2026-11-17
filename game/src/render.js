// BEAMKEEPER — the renderer. One canvas, 1280x720, everything drawn here:
// the dark sea, the glowing amber cone beam, glass, wraiths, the dense HUD
// (header + left incoming + right relics + bottom toolbar), and all screens.
// The beam is the brightest, most saturated object on screen — deep amber
// core #ffb020, additive blending, radial glow around the lighthouse.
import {
  CANVAS_W, CANVAS_H, FIELD, LIGHTHOUSE, COLORS, GLASS, WRAITHS, BOSSES,
  NIGHTS, RELICS, FLARE,
} from './config.js';
import { TAU, DEG } from './random.js';
import { incomingSummary, relicById } from './levels.js';
import { incomingLeft, nightBossName, hasRelic, glassAt } from './world.js';
import { toolbarCard, TOOLBAR, TITLE_PLAY, TITLE_HOW, END_BUTTON, relicCard, PAUSE_BTN, MUTE_BTN, inRect } from './input.js';

const FONT = 'system-ui, sans-serif';
function font(size, weight = 700) { return `${weight} ${size}px ${FONT}`; }

export function render(ctx, w, t) {
  drawSea(ctx, w, t);
  drawPads(ctx, w);
  drawBeam(ctx, w);
  drawLighthouse(ctx, w, t);
  drawGlass(ctx, w);
  drawWraiths(ctx, w, t);
  drawFloats(ctx, w);
  drawHUD(ctx, w);
  drawMessage(ctx, w);
  if (w.screen === 'title') drawTitle(ctx, w);
  if (w.screen === 'dawn') drawDawn(ctx, w);
  if (w.screen === 'over') drawEnd(ctx, w, false);
  if (w.screen === 'win') drawEnd(ctx, w, true);
  if (w.paused && w.screen === 'play') drawPaused(ctx, w);
}

// --- sea ---
function drawSea(ctx, w, t) {
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  g.addColorStop(0, COLORS.seaDeep);
  g.addColorStop(1, COLORS.seaLight);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // Slow wave shimmer: faint arcs drifting across the field.
  ctx.save();
  ctx.strokeStyle = 'rgba(120,150,255,0.05)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const y = FIELD.y + 40 + i * 78 + Math.sin(t * 0.4 + i * 1.7) * 6;
    ctx.beginPath();
    for (let x = FIELD.x; x <= FIELD.x + FIELD.w; x += 24) {
      const yy = y + Math.sin(x * 0.02 + t * 0.7 + i) * 5;
      if (x === FIELD.x) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
  // Field edge.
  ctx.strokeStyle = 'rgba(139,150,201,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(FIELD.x + 0.5, FIELD.y + 0.5, FIELD.w, FIELD.h);
}

// --- rocks ---
function drawPads(ctx, w) {
  for (const p of w.pads) {
    const occupied = glassAt(w, p.index);
    ctx.fillStyle = COLORS.rock;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 26, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = occupied ? COLORS.gold : COLORS.rockEdge;
    ctx.lineWidth = occupied ? 2 : 1;
    ctx.stroke();
    if (!occupied) {
      ctx.fillStyle = 'rgba(232,236,255,0.10)';
      ctx.beginPath();
      ctx.arc(p.x - 6, p.y - 7, 5, 0, TAU);
      ctx.fill();
    }
  }
}

// --- the beam: additive trapezoids, amber core, white spine ---
function drawBeam(ctx, w) {
  if (w.segments.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const seg of w.segments) {
    const col = seg.color === 'white' ? COLORS.beamCore : COLORS[seg.color];
    const edge = seg.color === 'white' ? COLORS.beamEdge : COLORS[seg.color];
    const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    // Wide soft edge pass.
    ctx.fillStyle = hexA(edge, 0.30);
    ctx.beginPath();
    ctx.moveTo(seg.x1 + nx * seg.w0, seg.y1 + ny * seg.w0);
    ctx.lineTo(seg.x2 + nx * seg.w1, seg.y2 + ny * seg.w1);
    ctx.lineTo(seg.x2 - nx * seg.w1, seg.y2 - ny * seg.w1);
    ctx.lineTo(seg.x1 - nx * seg.w0, seg.y1 - ny * seg.w0);
    ctx.closePath();
    ctx.fill();
    // Hot core pass (narrower, brighter).
    ctx.fillStyle = hexA(col, 0.75);
    ctx.beginPath();
    ctx.moveTo(seg.x1 + nx * seg.w0 * 0.45, seg.y1 + ny * seg.w0 * 0.45);
    ctx.lineTo(seg.x2 + nx * seg.w1 * 0.45, seg.y2 + ny * seg.w1 * 0.45);
    ctx.lineTo(seg.x2 - nx * seg.w1 * 0.45, seg.y2 - ny * seg.w1 * 0.45);
    ctx.lineTo(seg.x1 - nx * seg.w0 * 0.45, seg.y1 - ny * seg.w0 * 0.45);
    ctx.closePath();
    ctx.fill();
    // White spine.
    ctx.strokeStyle = 'rgba(255,247,224,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
  }
  // FLARE ring.
  if (w.flare.active > 0) {
    const p = 1 - w.flare.active / FLARE.duration;
    ctx.strokeStyle = `rgba(255,217,122,${0.9 * (1 - p)})`;
    ctx.lineWidth = 10 * (1 - p) + 2;
    ctx.beginPath();
    ctx.arc(LIGHTHOUSE.x, LIGHTHOUSE.y, FLARE.radius * (0.3 + 0.7 * p), 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function drawLighthouse(ctx, w, t) {
  const { x, y } = LIGHTHOUSE;
  // Radial glow pool on the water.
  const g = ctx.createRadialGradient(x, y, 10, x, y, 150);
  g.addColorStop(0, 'rgba(255,176,32,0.35)');
  g.addColorStop(1, 'rgba(255,176,32,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 150, 0, TAU);
  ctx.fill();
  // Tower.
  ctx.fillStyle = '#f4f1e6';
  ctx.beginPath();
  ctx.moveTo(x - 16, y + 26);
  ctx.lineTo(x - 10, y - 22);
  ctx.lineTo(x + 10, y - 22);
  ctx.lineTo(x + 16, y + 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c9403c';
  ctx.fillRect(x - 13, y + 6, 26, 9);
  ctx.fillStyle = '#2a3352';
  ctx.fillRect(x - 12, y - 30, 24, 10);
  // Lamp: bright, pulsing with the sweep.
  const pulse = 0.75 + 0.25 * Math.sin(t * 2);
  ctx.fillStyle = `rgba(255,217,122,${pulse})`;
  ctx.beginPath();
  ctx.arc(x, y - 25, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff7e0';
  ctx.beginPath();
  ctx.arc(x, y - 25, 3.5, 0, TAU);
  ctx.fill();
  // Flame pips (HP).
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i < w.hp ? '#ffb020' : 'rgba(139,150,201,0.3)';
    ctx.beginPath();
    ctx.arc(x - 45 + i * 10, y + 38, 3.5, 0, TAU);
    ctx.fill();
  }
}

// --- glass ---
function drawGlass(ctx, w) {
  for (const g of w.glass) {
    const sel = w.selectedPad === g.padIndex;
    ctx.save();
    ctx.translate(g.x, g.y);
    if (sel) {
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 31, 0, TAU);
      ctx.stroke();
    }
    if (g.kind === 'mirror') {
      ctx.rotate(g.angle);
      ctx.fillStyle = '#dfe8ff';
      ctx.fillRect(-20, -3, 40, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-20, -3, 40, 2);
      ctx.strokeStyle = '#8b96c9';
      ctx.lineWidth = 1;
      ctx.strokeRect(-20, -3, 40, 6);
    } else if (g.kind === 'splitter') {
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#cfe8ff';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, TAU);
      ctx.fill();
    } else if (g.kind === 'lens') {
      ctx.fillStyle = 'rgba(165,220,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 18, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#e8f6ff';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (g.kind === 'prism') {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(16, 12);
      ctx.lineTo(-16, 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = COLORS.ruby;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (g.kind === 'pillar') {
      ctx.fillStyle = '#4a5878';
      ctx.fillRect(-13, -13, 26, 26);
      ctx.strokeStyle = '#7c8bb5';
      ctx.lineWidth = 2;
      ctx.strokeRect(-13, -13, 26, 26);
      ctx.fillStyle = 'rgba(232,236,255,0.25)';
      ctx.fillRect(-13, -13, 26, 5);
    }
    ctx.restore();
  }
  // Selected-glass hint.
  if (w.selectedPad !== -1) {
    const g = glassAt(w, w.selectedPad);
    if (g) {
      ctx.fillStyle = COLORS.dim;
      ctx.font = font(12, 600);
      ctx.textAlign = 'center';
      ctx.fillText(`${GLASS[g.kind].name} — Q rotate · X sell`, g.x, g.y - 38);
    }
  }
}

// --- wraiths ---
function drawWraiths(ctx, w, t) {
  for (const wr of w.wraiths) {
    const def = wr.boss ? BOSSES[wr.boss] : WRAITHS[wr.type];
    const x = wr.x, y = wr.y;
    ctx.save();
    // Burn glow while inside the beam.
    if (wr.burn > 0) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 2, x, y, wr.r + 16);
      g.addColorStop(0, 'rgba(255,176,32,0.55)');
      g.addColorStop(1, 'rgba(255,176,32,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, wr.r + 16, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    // Body: pale violet wisp with a tint ring.
    const body = wr.type === 'shade' ? '#8f7bd8' : COLORS.wraith;
    ctx.fillStyle = wr.hitFlash > 0 ? '#ffffff' : body;
    ctx.globalAlpha = wr.type === 'burrower' && wr.burrow > 0 ? 0.45 : 0.92;
    ctx.beginPath();
    if (wr.boss) {
      // Bosses: big horned silhouette.
      ctx.arc(x, y, wr.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2a1e4f';
      ctx.beginPath();
      ctx.moveTo(x - wr.r + 4, y - wr.r + 10);
      ctx.lineTo(x - wr.r - 10, y - wr.r - 8);
      ctx.lineTo(x - wr.r + 12, y - wr.r + 2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + wr.r - 4, y - wr.r + 10);
      ctx.lineTo(x + wr.r + 10, y - wr.r - 8);
      ctx.lineTo(x + wr.r - 12, y - wr.r + 2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.arc(x, y, wr.r, 0, TAU);
      ctx.fill();
      // Wavy tail.
      ctx.beginPath();
      ctx.moveTo(x - wr.r * 0.6, y + wr.r * 0.5);
      ctx.quadraticCurveTo(x + Math.sin(t * 5 + wr.phase) * 6, y + wr.r + 8, x + wr.r * 0.5, y + wr.r * 0.6);
      ctx.quadraticCurveTo(x, y + wr.r * 0.2, x - wr.r * 0.6, y + wr.r * 0.5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Tint ring (prism colour that hurts it most).
    if (wr.tint) {
      ctx.strokeStyle = COLORS[wr.tint];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, wr.r + 3, 0, TAU);
      ctx.stroke();
    }
    if (wr.type === 'shade') {
      ctx.strokeStyle = '#e8ecff';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, wr.r + 3, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Glowing eyes, always facing the lighthouse.
    const ea = Math.atan2(LIGHTHOUSE.y - y, LIGHTHOUSE.x - x);
    const ex = Math.cos(ea) * wr.r * 0.35, ey = Math.sin(ea) * wr.r * 0.35;
    ctx.fillStyle = wr.burn > 0 ? '#ff5a3c' : '#ffd97a';
    ctx.beginPath();
    ctx.arc(x + ex - 4, y + ey - 2, 2.2, 0, TAU);
    ctx.arc(x + ex + 4, y + ey - 2, 2.2, 0, TAU);
    ctx.fill();
    ctx.restore();
    // Boss HP bar — clamped inside the play field so it never runs
    // under the side panels.
    if (wr.boss) {
      const bw = 120;
      const bx = Math.max(FIELD.x + bw / 2 + 4, Math.min(FIELD.x + FIELD.w - bw / 2 - 4, x));
      ctx.fillStyle = 'rgba(10,14,36,0.8)';
      ctx.fillRect(bx - bw / 2, y - wr.r - 22, bw, 10);
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(bx - bw / 2 + 1, y - wr.r - 21, (bw - 2) * (wr.hp / wr.maxHp), 8);
      ctx.fillStyle = COLORS.ink;
      ctx.font = font(11, 700);
      ctx.textAlign = 'center';
      ctx.fillText(def.name, bx, y - wr.r - 26);
    } else if (wr.hp < wr.maxHp) {
      const bw = 26;
      ctx.fillStyle = 'rgba(10,14,36,0.8)';
      ctx.fillRect(x - bw / 2, y - wr.r - 9, bw, 4);
      ctx.fillStyle = COLORS.green;
      ctx.fillRect(x - bw / 2, y - wr.r - 9, bw * (wr.hp / wr.maxHp), 4);
    }
  }
}

function drawFloats(ctx, w) {
  ctx.save();
  ctx.textAlign = 'center';
  for (const f of w.floats) {
    ctx.globalAlpha = Math.max(0, f.life / f.max);
    ctx.font = font(Math.round(15 * f.size), 800);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}

// --- HUD ---
function panel(ctx, x, y, pw, ph, title) {
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(x, y, pw, ph);
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, pw, ph);
  ctx.fillStyle = COLORS.gold;
  ctx.font = font(13, 800);
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 10, y + 20);
}

function drawHUD(ctx, w) {
  // Header bar.
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(0, 0, CANVAS_W, 56);
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.beginPath();
  ctx.moveTo(0, 56.5);
  ctx.lineTo(CANVAS_W, 56.5);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(20, 800);
  ctx.fillText('BEAMKEEPER', 12, 26);
  ctx.fillStyle = COLORS.gold;
  ctx.font = font(14, 700);
  const boss = nightBossName(w);
  ctx.fillText(`NIGHT ${w.night}/7${boss && w.screen === 'play' ? `  ·  ${boss}` : ''}`, 12, 46);
  // WIN / LOSE lines, printed on the play screen.
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.green;
  ctx.font = font(12, 700);
  ctx.fillText('WIN hold the flame 7 nights until dawn', 640, 22);
  ctx.fillStyle = COLORS.red;
  ctx.fillText('LOSE the flame goes out', 640, 40);
  // Score block, right.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(16, 800);
  ctx.fillText(`SCORE ${w.score.toLocaleString('en-US')}`, 1176, 24);
  ctx.fillStyle = COLORS.dim;
  ctx.font = font(12, 600);
  ctx.fillText(`BEST ${Math.max(w.best, w.score).toLocaleString('en-US')}   CHAIN x${w.combo}   EMBERS ${w.embers}`, 1176, 44);
  // Pause / mute buttons.
  ctx.fillStyle = COLORS.panelEdge;
  ctx.fillRect(PAUSE_BTN.x, PAUSE_BTN.y, PAUSE_BTN.w, PAUSE_BTN.h);
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(13, 800);
  ctx.textAlign = 'center';
  ctx.fillText(w.paused ? '▶' : 'II', PAUSE_BTN.x + 19, PAUSE_BTN.y + 24);
  ctx.fillStyle = COLORS.panelEdge;
  ctx.fillRect(MUTE_BTN.x, MUTE_BTN.y, MUTE_BTN.w, MUTE_BTN.h);
  ctx.fillStyle = COLORS.ink;
  ctx.fillText(w.muted ? '✕' : '♪', MUTE_BTN.x + 19, MUTE_BTN.y + 24);

  // Left panel: incoming.
  panel(ctx, 0, 56, 196, 584, 'INCOMING');
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(15, 800);
  ctx.textAlign = 'left';
  ctx.fillText(`${incomingLeft(w)} LEFT`, 10, 102);
  let ly = 126;
  ctx.font = font(12, 600);
  for (const item of incomingSummary(w.night)) {
    const def = item.boss ? BOSSES[item.type] : WRAITHS[item.type];
    ctx.fillStyle = item.boss ? COLORS.red : COLORS.ink;
    ctx.fillText(`${def.name} x${item.count}`, 10, ly);
    ctx.fillStyle = COLORS.dim;
    ctx.font = font(11, 500);
    ctx.fillText(def.trait, 10, ly + 14);
    ctx.font = font(12, 600);
    ly += 34;
    if (ly > 420) break;
  }
  // Next night preview.
  ctx.fillStyle = COLORS.gold;
  ctx.font = font(12, 800);
  ctx.fillText('NEXT', 10, 560);
  ctx.fillStyle = COLORS.dim;
  ctx.font = font(11, 500);
  if (w.night < 7) {
    const next = NIGHTS[w.night];
    ctx.fillText(`Night ${w.night + 1}: ${next.total} wraiths`, 10, 578);
    if (next.boss) ctx.fillText(BOSSES[next.boss].name, 10, 594);
  } else {
    ctx.fillText('Final night — hold!', 10, 578);
  }

  // Right panel: relics + flare.
  panel(ctx, 1084, 56, 196, 584, 'RELICS');
  let ry = 102;
  ctx.font = font(12, 600);
  if (w.relics.length === 0) {
    ctx.fillStyle = COLORS.dim;
    ctx.fillText('None yet —', 1094, ry);
    ctx.fillText('survive a night', 1094, ry + 16);
    ctx.fillText('to claim one.', 1094, ry + 32);
  }
  for (const id of w.relics) {
    const r = relicById(id);
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(`◆ ${r.name}`, 1094, ry);
    ctx.fillStyle = COLORS.dim;
    ctx.font = font(11, 500);
    ctx.fillText(r.desc, 1094, ry + 15);
    ctx.font = font(12, 600);
    ry += 36;
  }
  ctx.fillStyle = COLORS.gold;
  ctx.font = font(12, 800);
  ctx.fillText('FLARE', 1094, 470);
  ctx.fillStyle = w.flare.cooldown <= 0 ? COLORS.green : COLORS.dim;
  ctx.font = font(13, 700);
  ctx.fillText(w.flare.cooldown <= 0 ? 'READY — SPACE' : `${Math.ceil(w.flare.cooldown)} s`, 1094, 490);
  ctx.fillStyle = COLORS.dim;
  ctx.font = font(11, 500);
  ctx.fillText('3 s burst, 60 dmg', 1094, 508);
  ctx.fillText('within 260 px', 1094, 523);
  ctx.fillStyle = COLORS.gold;
  ctx.font = font(12, 800);
  ctx.fillText('GLASS', 1094, 556);
  ctx.fillStyle = COLORS.dim;
  ctx.font = font(11, 500);
  ctx.fillText('Mirror 3 · Split 5', 1094, 574);
  ctx.fillText('Lens 7 · Prism 8', 1094, 589);
  ctx.fillText('Pillar 1', 1094, 604);

  // Bottom toolbar: 5 glass cards.
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(TOOLBAR.x, TOOLBAR.y, TOOLBAR.w, TOOLBAR.h);
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.strokeRect(TOOLBAR.x + 0.5, TOOLBAR.y + 0.5, TOOLBAR.w, TOOLBAR.h);
  const kinds = ['mirror', 'splitter', 'lens', 'prism', 'pillar'];
  kinds.forEach((kind, i) => {
    const r = toolbarCard(i);
    const def = GLASS[kind];
    const afford = w.embers >= def.cost;
    const sel = w.selectedKind === kind;
    ctx.fillStyle = sel ? '#1d2a5e' : '#161d40';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = sel ? COLORS.gold : COLORS.panelEdge;
    ctx.lineWidth = sel ? 2 : 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
    ctx.textAlign = 'left';
    ctx.fillStyle = afford ? COLORS.ink : COLORS.dim;
    ctx.font = font(13, 800);
    ctx.fillText(`[${def.key}] ${def.name} — ${def.cost}◆`, r.x + 8, r.y + 20);
    ctx.fillStyle = COLORS.dim;
    ctx.font = font(11, 500);
    ctx.fillText(def.blurb, r.x + 8, r.y + 40);
  });
  ctx.fillStyle = COLORS.dim;
  ctx.font = font(11, 500);
  ctx.textAlign = 'center';
  ctx.fillText('Click a rock to place · Drag a mirror to aim · Q rotate · X sell · SPACE flare · P pause · M sound', 640, 716);
}

// Night-start message: fades after 3 s, set low (y≈110) so it never
// crowds the WIN/LOSE lines in the header.
function drawMessage(ctx, w) {
  if (!w.message || w.messageT <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, w.messageT);
  ctx.fillStyle = COLORS.gold;
  ctx.font = font(18, 800);
  ctx.textAlign = 'center';
  ctx.fillText(w.message, 640, 112);
  ctx.restore();
}

// --- screens ---
function dim(ctx) {
  ctx.fillStyle = 'rgba(6,9,26,0.55)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawTitle(ctx, w) {
  // Lighter veil than the end screens: the live board + beam must show through.
  ctx.fillStyle = 'rgba(6,9,26,0.5)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = font(54, 900);
  ctx.fillText('BEAMKEEPER', 640, 210);
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(17, 600);
  ctx.fillText('Sweep the last lighthouse beam through seven nights of the Drowned Dark', 640, 248);
  ctx.fillStyle = COLORS.dim;
  ctx.font = font(15, 600);
  ctx.fillText('5 glass · 9 wraiths · 3 bosses · 8 relics', 640, 276);
  ctx.fillStyle = COLORS.beamEdge;
  ctx.font = font(15, 700);
  ctx.fillText('One beam. Seven nights. Bend the light — or the dark takes the flame.', 640, 306);
  // PLAY button.
  ctx.fillStyle = '#ffb020';
  ctx.fillRect(TITLE_PLAY.x, TITLE_PLAY.y, TITLE_PLAY.w, TITLE_PLAY.h);
  ctx.fillStyle = '#131a3a';
  ctx.font = font(22, 900);
  ctx.fillText('▶  PLAY', 640, TITLE_PLAY.y + 37);
  ctx.fillStyle = COLORS.panelEdge;
  ctx.fillRect(TITLE_HOW.x, TITLE_HOW.y, TITLE_HOW.w, TITLE_HOW.h);
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(15, 700);
  ctx.fillText('HOW TO PLAY', 640, TITLE_HOW.y + 29);
  if (w.best > 0) {
    ctx.fillStyle = COLORS.dim;
    ctx.font = font(14, 600);
    ctx.fillText(`BEST SCORE ${w.best.toLocaleString('en-US')}`, 640, 620);
  }
  if (w.showHow) {
    ctx.fillStyle = 'rgba(10,14,36,0.95)';
    ctx.fillRect(340, 330, 600, 210);
    ctx.strokeStyle = COLORS.gold;
    ctx.strokeRect(340.5, 330.5, 600, 210);
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(14, 600);
    ctx.textAlign = 'left';
    const lines = [
      'The beam sweeps on its own — bend it with glass on the rocks.',
      'Mirror reflects · Splitter branches · Lens focuses x2.5',
      'Prism splits ruby / verdant / azure — Shades die ONLY in colour.',
      'Wraiths that reach the lighthouse cost 1 HP (bosses 3).',
      'SPACE fires FLARE. Survive all 7 nights to see the dawn.',
    ];
    lines.forEach((ln, i) => ctx.fillText(ln, 360, 362 + i * 28));
    ctx.fillStyle = COLORS.dim;
    ctx.fillText('Click HOW TO PLAY again to close.', 360, 522);
  }
}

function drawDawn(ctx, w) {
  dim(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = font(34, 900);
  ctx.fillText(`DAWN — NIGHT ${w.night} HELD`, 640, 150);
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(16, 600);
  ctx.fillText(`Score ${w.score.toLocaleString('en-US')}  ·  ${w.kills} wraiths burned  ·  Flame ${w.hp}/10`, 640, 184);
  ctx.fillText('Choose one relic — the dark returns at dusk.', 640, 214);
  ctx.fillStyle = COLORS.gold;
  ctx.font = font(15, 800);
  ctx.fillText('PICK 1 OF 3 RELICS', 640, 268);
  w.draft.forEach((id, i) => {
    const r = relicCard(i);
    const rel = relicById(id);
    ctx.fillStyle = '#1d2a5e';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
    ctx.fillStyle = COLORS.gold;
    ctx.font = font(17, 800);
    ctx.fillText(`◆ ${rel.name}`, r.x + r.w / 2, r.y + 44);
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(14, 600);
    ctx.fillText(rel.desc, r.x + r.w / 2, r.y + 76);
    ctx.fillStyle = COLORS.dim;
    ctx.font = font(12, 500);
    ctx.fillText('Click to take it', r.x + r.w / 2, r.y + 140);
  });
}

function drawEnd(ctx, w, won) {
  dim(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? COLORS.gold : COLORS.red;
  ctx.font = font(46, 900);
  ctx.fillText(won ? 'DAWN BREAKS — YOU WIN' : 'THE FLAME GOES OUT', 640, 220);
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(17, 600);
  ctx.fillText(won ? 'Seven nights held. The Drowned Dark recedes.' : w.overReason, 640, 258);
  ctx.fillStyle = COLORS.gold;
  ctx.font = font(24, 800);
  ctx.fillText(`FINAL SCORE ${w.score.toLocaleString('en-US')}`, 640, 330);
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(16, 600);
  ctx.fillText(`${w.nightClears}/7 nights held  ·  ${w.kills} wraiths burned  ·  Flame ${w.hp}/10  ·  Best ${Math.max(w.best, w.score).toLocaleString('en-US')}`, 640, 366);
  ctx.fillStyle = '#ffb020';
  ctx.fillRect(END_BUTTON.x, END_BUTTON.y, END_BUTTON.w, END_BUTTON.h);
  ctx.fillStyle = '#131a3a';
  ctx.font = font(20, 900);
  ctx.fillText(won ? 'PLAY AGAIN' : 'RESTART', 640, END_BUTTON.y + 36);
}

function drawPaused(ctx, w) {
  dim(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(40, 900);
  ctx.fillText('PAUSED', 640, 340);
  ctx.font = font(16, 600);
  ctx.fillText('Press P to resume', 640, 378);
}
