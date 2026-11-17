# BEAMKEEPER

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/cgxaltarm/best-game-01-beamkeeper/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/cgxaltarm/best-game-01-beamkeeper/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**BEAMKEEPER: sweep the last lighthouse beam through seven nights of the Drowned Dark — 5 glass, 9 wraiths, 3 bosses, 8 relics.**

Entry for make.fun competition `best-game-01` ($1,000, top 10 paid). A complete
original game that plays offline in a desktop browser from its own files —
no network, no libraries, plain canvas + WebAudio synth.

## The game

You are the keeper of the last lighthouse on a drowned coast. The beam sweeps
the sea on its own slow turn — your only weapon. Bend it with glass you place
on the rocks: mirrors, splitters, lenses, prisms. Wraiths caught in the light
burn. Hold the flame for seven nights until dawn.

- **The beam is a cone, not a line** — it rotates continuously (1 rev / 12 s),
  so damage is periodic and timing matters. It is the brightest thing on
  screen: deep amber core, additive glow, white spine.
- **5 glass:** Mirror (reflect, drag to aim, 8 snap angles), Splitter (beam
  continues + one 90° branch), Lens (focuses ×2.5, short range), Prism
  (splits into ruby / verdant / azure — matching tint ×2, wrong tint ×0.5),
  Pillar (blocks wraiths). Click to place, Q rotate, X sell (70% refund).
- **9 wraiths:** Mite, Wisp, Duskmoth, Splitter, Burrower, Prowler (armoured),
  Gloom, and the Shade — immune to the white beam, only coloured prism light
  hurts it. **3 named bosses:** THE WINTER STAG (night 3), THE TIDE MOTHER
  (night 5, spawns Mites), THE DROWNED KING (night 7, darkens the beam −30%).
- **FLARE (Space):** 3 s full-circle burst, 60 damage within 260 px, 45 s
  cooldown. **8 relics**, pick 1 of 3 each dawn. Combo ember multiplier,
  floating damage numbers, night-clear score, best score in localStorage.
- **Win:** survive night 7 → dawn. **Lose:** the flame goes out (HP 0).
  Both are printed on the play screen, with the WIN/LOSE lines always visible.

## Play

```
node serve.ts            # http://localhost:8080
```

Click a rock to place glass · Drag a mirror to aim · 1–5 select glass ·
Q rotate · X sell · SPACE flare · P pause · M sound.

## Validation (all run locally, see tests/)

- `node tests/beam-test.mjs` — **42/42 PASS**: mirror reflection, prism
  3-colour split, splitter branches, lens focus, pillar block, cone geometry,
  colour multipliers (Shade immune to white, match ×2 / mismatch ×0.5).
- `node tests/play.cjs` — **19/19 PASS** (headless Chrome): title → PLAY →
  place/rotate mirror → FLARE → wraiths die in the beam → score rises →
  night 1 clears → relic pick → night 2 → pause/resume → game over →
  Space restarts. Zero console/page errors.
- `node tests/balance.cjs` — **PASS**: auto-player wins all 7 nights on
  7 seeds (scores 7,510–10,560); casual probe (5 mirrors, no relics, no
  FLARE) loses on night 4 on every seed — winnable with good play, not trivial.
- `node tests/shots.cjs` — **PASS**: 4 real renders, 1280×720, each ≤256 KiB;
  the win shot is a genuine auto-played 7-night win (score 9,530).
- `main.ts` — dossier byte-identical across runs, ≤1.5 MiB; game files grep
  clean for network references; all `.js` parse as ES modules.

## Layout

```
main.ts            hand-in: copies game/ + screenshots/ to /output, writes dossier.json
game/index.html    canvas + module bootstrap (no network refs)
game/src/config.js all numbers: beam, glass, wraiths, bosses, nights, relics
game/src/random.js seeded RNG + geometry helpers
game/src/beam.js   the tracer: traceBeam() -> cone segments (pure, tested)
game/src/levels.js night compositions + dawn relic draft
game/src/world.js  rules: spawn, move, burn, economy, FLARE, bosses, auto-player
game/src/input.js  pointer + keyboard + UI geometry (one source of truth)
game/src/sound.js  WebAudio synth only (hum, sizzle, chime, boom, horn)
game/src/render.js the frame: sea, beam, glass, wraiths, dense HUD, screens
game/src/shots.js  staged ?shot= scenes (real rules, fast-forwarded)
tests/           beam-test.mjs, play.cjs, balance.cjs, shots.cjs
screenshots/      1-start.jpg 2-play.jpg 3-boss.jpg 4-win.jpg
```
