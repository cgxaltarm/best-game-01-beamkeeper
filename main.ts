// BEAMKEEPER — hand-in for make.fun best-game-01 (Node 22, stdlib only).
//
// The game itself lives in game/ next to this file: plain static files a
// desktop browser loads offline (game/index.html plus its ES modules, no
// library, no network request). This program only hands it in: it copies
// game/ and screenshots/ into the output directory and writes
// dossier.json there — the summary the judge reads — using the vendored
// make.fun library (vendor/makefun-game.ts, unchanged).
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail fast, before copying anything, when the hand-in is incomplete:
// the scorer would refuse an entry with no playable game or no cover
// screenshot, and a silent empty dossier is worse than a loud error.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('refusing to hand in: game/index.html is missing');
}
const shotFiles = existsSync(join(here, 'screenshots'))
  ? readdirSync(join(here, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f))
  : [];
if (shotFiles.length === 0) {
  throw new Error('refusing to hand in: screenshots/ holds no PNG/JPEG render');
}
console.log(`handing in BEAMKEEPER: game/ + ${shotFiles.length} screenshot(s) -> ${out}`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the dossier bytes; the rest refuse an entry the scorer would refuse:
// more than 4 screenshots or one over 256 KiB; more than 993 files in
// game/ or 48 MiB of game files in all; or a path under game/ over 1000
// bytes (game/ counts beside /output's own 1000-entry cap).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
