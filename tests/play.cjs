// BEAMKEEPER headless play test (playwright-core, headless shell).
// Run: node tests/play.cjs
// Checks the full player path in a real browser: title → PLAY → place a
// mirror → rotate → FLARE → wraiths die in the beam → score rises →
// night 1 clears → relic pick → night 2 → pause/resume → game over →
// Space restarts. Zero console/page errors throughout.
const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('/home/hatch/n8n/node_modules/playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8131;
const URL = `http://127.0.0.1:${PORT}/`;
const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ok', name); }
  else { fail++; console.log('FAIL:', name); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  let browser;
  const errors = [];
  try {
    await sleep(1200);
    browser = await chromium.launch({ executablePath: SHELL, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.goto(URL + '?seed=7', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__BEAMKEEPER__, null, { timeout: 10000 });
    const state = () => page.evaluate(() => window.__BEAMKEEPER__.state());

    // 1. Boots to the title screen.
    let s = await state();
    check('boots to title', s.screen === 'title');

    // 2. PLAY starts night 1.
    await page.mouse.click(640, 490); // PLAY button
    await sleep(400);
    s = await state();
    check('PLAY starts night 1', s.screen === 'play' && s.night === 1);
    check('starts with 15 embers', s.embers === 15);

    // 3. Click a rock pad to place a mirror (pad at 460,266).
    await page.mouse.click(460, 266);
    await sleep(200);
    s = await state();
    check('click places a mirror', s.glass === 1);
    check('mirror costs 3 embers', s.embers === 12);

    // 4. Second mirror at 820,422, then rotate the first with Q.
    await page.mouse.click(820, 422);
    await sleep(200);
    await page.mouse.click(460, 266); // select the first mirror
    const a0 = await page.evaluate(() => window.__BEAMKEEPER__.world.glass[0].angle);
    await page.keyboard.press('q');
    await sleep(150);
    const a1 = await page.evaluate(() => window.__BEAMKEEPER__.world.glass[0].angle);
    check('Q rotates the selected mirror', a1 !== a0);
    s = await state();
    check('two mirrors placed', s.glass === 2);

    // 5. SPACE fires FLARE.
    await page.keyboard.press(' ');
    await sleep(200);
    const cd = await page.evaluate(() => window.__BEAMKEEPER__.world.flare.cooldown);
    check('FLARE triggers (cooldown running)', cd > 0);

    // 6. Speed the clock up; wraiths must die in the beam, score rises.
    await page.evaluate(() => window.__BEAMKEEPER__.setTimeScale(6));
    await page.waitForFunction(() => window.__BEAMKEEPER__.state().kills > 0, null, { timeout: 60000 });
    s = await state();
    check('wraiths die in the beam', s.kills > 0);
    check('score rises with kills', s.score >= s.kills * 10);

    // 7. P pauses and resumes.
    await page.keyboard.press('p');
    await sleep(200);
    s = await state();
    check('P pauses', s.paused === true);
    await page.keyboard.press('p');
    await sleep(200);
    s = await state();
    check('P resumes', s.paused === false);

    // 8. Night 1 reaches dawn (relic draft).
    await page.waitForFunction(() => ['dawn', 'over'].includes(window.__BEAMKEEPER__.state().screen), null, { timeout: 90000 });
    s = await state();
    check('night 1 ends in dawn (not game over)', s.screen === 'dawn');
    const draft = await page.evaluate(() => window.__BEAMKEEPER__.world.draft);
    check('dawn offers 3 relics', draft.length === 3);

    // 9. Pick the first relic → night 2 starts.
    await page.mouse.click(380, 385); // first relic card
    await sleep(400);
    s = await state();
    check('relic pick starts night 2', s.screen === 'play' && s.night === 2);
    check('relic recorded', s.relics.length === 1);

    // 10. Force a game over (test hook: 1 HP, wraith on the lighthouse),
    // then Space restarts.
    await page.evaluate(() => {
      const w = window.__BEAMKEEPER__.world;
      w.hp = 1;
      w.wraiths.push({ id: 9999, type: 'mite', boss: null, x: 640, y: 346, hp: 12, maxHp: 12, speed: 0, tint: null, r: 9, burn: 0, floatAcc: 0, floatTimer: 0, phase: 0, burrow: 0, burrowCycle: 3, spawnTimer: 0, hitFlash: 0 });
    });
    await page.waitForFunction(() => window.__BEAMKEEPER__.state().screen === 'over', null, { timeout: 15000 });
    s = await state();
    check('game over screen shows', s.screen === 'over');
    await page.keyboard.press(' ');
    await sleep(400);
    s = await state();
    check('Space restarts from game over', s.screen === 'play' && s.night === 1);

    // 11. Zero console/page errors throughout.
    check('zero console/page errors', errors.length === 0);
    if (errors.length > 0) console.log(errors.slice(0, 5));
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
  console.log(`play: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
