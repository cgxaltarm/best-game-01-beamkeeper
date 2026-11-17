// BEAMKEEPER balance simulation (Node, no browser).
// Runs the REAL world.js rules headlessly:
//   auto-player — buys glass by priority, re-aims mirrors, fires FLARE,
//     takes the best relic each dawn. Must win all 7 nights on >=3 seeds.
//   casual probe — 5 mirrors, never rotates, no FLARE, no relics.
//     Must lose by night 4-5 on all seeds (winnable, not trivial).
// Run: node tests/balance.cjs [seed ...]
const DT = 1 / 30;
const MAX_STEPS = 120000; // ~66 min of game time

async function main() {
  const { createWorld, startGame, update, autoPlayStep, placeGlass, startNight } = await import('../game/src/world.js');
  const { LIGHTHOUSE } = await import('../game/src/config.js');

  function runAuto(seed) {
    const w = createWorld(seed);
    startGame(w);
    let steps = 0;
    while (w.screen !== 'win' && w.screen !== 'over' && steps < MAX_STEPS) {
      autoPlayStep(w, DT);
      update(w, DT);
      steps++;
    }
    return { seed, won: w.screen === 'win', screen: w.screen, night: w.night, hp: w.hp, score: w.score, kills: w.kills, embers: w.embers, relics: w.relics.length, glass: w.glass.length, flares: w.stats.flareUses, steps };
  }

  function runCasual(seed) {
    const w = createWorld(seed);
    startGame(w);
    let placed = 0;
    let steps = 0;
    const mirrorPads = w.pads
      .slice()
      .sort((a, b) => Math.hypot(a.x - LIGHTHOUSE.x, a.y - LIGHTHOUSE.y) - Math.hypot(b.x - LIGHTHOUSE.x, b.y - LIGHTHOUSE.y))
      .slice(2, 12)
      .map((p) => p.index);
    while (w.screen !== 'win' && w.screen !== 'over' && steps < MAX_STEPS) {
      // Place up to 5 mirrors as embers allow; never rotate, never FLARE.
      if (placed < 5 && w.screen === 'play') {
        const pad = mirrorPads[placed];
        if (pad !== undefined && placeGlass(w, pad, 'mirror')) placed++;
      }
      if (w.screen === 'dawn') {
        // Declines the draft: no relics.
        startNight(w, w.night + 1);
      }
      update(w, DT);
      steps++;
    }
    return { seed, won: w.screen === 'win', screen: w.screen, night: w.night, hp: w.hp, score: w.score, kills: w.kills, steps };
  }

  const seeds = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n));
  const autoSeeds = seeds.length > 0 ? seeds : [7, 11, 23];
  let ok = true;

  console.log('--- auto-player (must WIN 7/7) ---');
  for (const s of autoSeeds) {
    const r = runAuto(s);
    console.log(`seed ${s}: ${r.won ? 'WIN' : 'LOSE'} screen=${r.screen} night=${r.night} hp=${r.hp} score=${r.score} kills=${r.kills} relics=${r.relics} glass=${r.glass} flares=${r.flares} steps=${r.steps}`);
    if (!r.won) ok = false;
  }
  console.log('--- casual probe (must LOSE by night 4-5) ---');
  for (const s of autoSeeds) {
    const r = runCasual(s);
    const lostInTime = !r.won && r.night <= 5;
    console.log(`seed ${s}: ${r.won ? 'WIN' : 'LOSE'} screen=${r.screen} night=${r.night} hp=${r.hp} score=${r.score} kills=${r.kills} steps=${r.steps} ${lostInTime ? '(in window)' : '(OUT OF WINDOW)'}`);
    if (!lostInTime) ok = false;
  }
  console.log(ok ? 'balance: PASS' : 'balance: FAIL');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
