// BEAMKEEPER screenshot capture (playwright-core, headless shell).
// Renders each ?shot= scene with the real game code and saves it as a
// 1280x720 JPEG in screenshots/. Verifies each file is <= 256 KiB and that
// the win shot comes from a genuine auto-played 7-night win.
// Run: node tests/shots.cjs
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/home/hatch/n8n/node_modules/playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8135;
const SHOTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'shots.json'), 'utf8'));
const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const MAX_BYTES = 262144;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  let browser;
  let fail = 0;
  try {
    await sleep(1200);
    browser = await chromium.launch({ executablePath: SHELL, args: ['--no-sandbox'] });
    for (const shot of SHOTS) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(`http://127.0.0.1:${PORT}/${shot.query}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__BEAMKEEPER__, null, { timeout: 15000 });
      if (shot.query.includes('shot=win')) {
        await page.waitForFunction(() => window.__BEAMKEEPER__.state().screen === 'win', null, { timeout: 30000 });
        const res = await page.evaluate(() => window.__BEAMKEEPER__.state().shotResult);
        console.log(`  win shot: genuine auto-played win = ${res && res.won === true} (steps ${res ? res.steps : '?'})`);
        if (!res || res.won !== true) { console.log('FAIL: win shot is not a genuine win'); fail++; }
      } else if (shot.query.includes('shot=boss')) {
        await page.waitForFunction(() => window.__BEAMKEEPER__.world.wraiths.some((r) => r.boss === 'tide'), null, { timeout: 30000 });
      } else {
        await sleep(900); // let the beam sweep into a good angle
      }
      const out = path.join(ROOT, 'screenshots', shot.name);
      await page.screenshot({ path: out, type: 'jpeg', quality: 80 });
      const size = fs.statSync(out).size;
      const st = await page.evaluate(() => window.__BEAMKEEPER__.state());
      console.log(`  ${shot.name}: ${size} bytes (${(size / 1024).toFixed(0)} KiB) screen=${st.screen} night=${st.night} score=${st.score} errors=${errors.length}`);
      if (size > MAX_BYTES) { console.log(`FAIL: ${shot.name} over 256 KiB`); fail++; }
      if (errors.length > 0) { console.log('FAIL: page errors:', errors.slice(0, 3)); fail++; }
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
  console.log(fail === 0 ? 'shots: PASS' : `shots: ${fail} FAILED`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
