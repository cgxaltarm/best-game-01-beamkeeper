// BEAMKEEPER beam-tracer unit tests (Node, no DOM).
// Run: node tests/beam-test.mjs
import { traceBeam, inBeam, segmentMult } from '../game/src/beam.js';
import { rayDisc, reflectDir } from '../game/src/random.js';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL:', name); }
}
function near(a, b, eps = 1e-6) { return Math.abs(a - b) <= eps; }

const O = { x: 640, y: 346 };
const EAST = 0;

// 1. No glass: a single segment, full range, widening cone.
{
  const s = traceBeam(O, EAST, []);
  check('no-glass: 1 segment', s.length === 1);
  check('no-glass: starts at origin', near(s[0].x1, 640) && near(s[0].y1, 346));
  check('no-glass: ends at range east', near(s[0].x2, 640 + 980, 1) && near(s[0].y2, 346, 1));
  check('cone: narrow at origin', near(s[0].w0, 6));
  check('cone: wide at far end', s[0].w1 > 200);
  check('cone: white', s[0].color === 'white');
  check('cone: not focused', s[0].focused === false);
}
// 2. Mirror at 45 degrees: east beam reflects downward (+y).
{
  const s = traceBeam(O, EAST, [{ x: 800, y: 346, kind: 'mirror', angle: Math.PI / 4 }]);
  check('mirror: 2 segments', s.length === 2);
  check('mirror: first ends at pad', near(s[0].x2, 800 - 26, 2) && near(s[0].y2, 346, 2));
  check('mirror: reflected leg goes down', near(s[1].x2, s[1].x1, 1) && s[1].y2 > s[1].y1 + 100);
}
// 3. Mirror at -45 degrees: east beam reflects upward (-y).
{
  const s = traceBeam(O, EAST, [{ x: 800, y: 346, kind: 'mirror', angle: -Math.PI / 4 }]);
  check('mirror -45: reflected leg goes up', s.length === 2 && s[1].y2 < s[1].y1 - 100);
}
// 4. Prism splits into ruby / verdant / azure.
{
  const s = traceBeam(O, EAST, [{ x: 800, y: 346, kind: 'prism', angle: 0 }]);
  const colors = s.map((x) => x.color);
  check('prism: 4 segments', s.length === 4);
  check('prism: ruby present', colors.includes('ruby'));
  check('prism: verdant present', colors.includes('verdant'));
  check('prism: azure present', colors.includes('azure'));
  check('prism: coloured legs fan out', s[1].y2 !== s[2].y2 && s[2].y2 !== s[3].y2);
}
// 5. Splitter: beam continues + one 90-degree branch.
{
  const s = traceBeam(O, EAST, [{ x: 800, y: 346, kind: 'splitter', angle: 0 }]);
  check('splitter: 3 segments', s.length === 3);
  const dirs = s.map((x) => Math.atan2(x.y2 - x.y1, x.x2 - x.x1));
  check('splitter: straight leg east', dirs.some((d) => near(d, 0, 0.01)));
  check('splitter: branch leg south', dirs.some((d) => near(d, Math.PI / 2, 0.01)));
}
// 6. Lens: focused flag, short range after the lens.
{
  const s = traceBeam(O, EAST, [{ x: 800, y: 346, kind: 'lens', angle: 0 }]);
  check('lens: 2 segments', s.length === 2);
  check('lens: second leg focused', s[1].focused === true);
  const len2 = Math.hypot(s[1].x2 - s[1].x1, s[1].y2 - s[1].y1);
  check('lens: focused leg short range', len2 < 400);
}
// 7. Pillar stops the ray dead.
{
  const s = traceBeam(O, EAST, [{ x: 800, y: 346, kind: 'pillar', angle: 0 }]);
  check('pillar: 1 segment', s.length === 1);
  check('pillar: ends at pad', near(s[0].x2, 800 - 26, 2));
}
// 8. Cone geometry (inBeam): wider at the far end, narrow near the lamp.
{
  const s = traceBeam(O, EAST, [])[0];
  check('inBeam: centre inside', inBeam(900, 346, s, 0));
  check('inBeam: 30px off centre near lamp is outside', !inBeam(700, 346 + 30, s, 0));
  check('inBeam: 100px off centre far out is inside', inBeam(1400, 346 + 100, s, 0));
  check('inBeam: 300px off centre is outside', !inBeam(1400, 346 + 300, s, 0));
  check('inBeam: beyond the end is outside', !inBeam(1700, 346, s, 0));
  check('inBeam: wraith radius pads the edge', inBeam(700, 346 + 30, s, 12));
}
// 9. Colour multipliers.
{
  const white = { color: 'white', focused: false };
  const ruby = { color: 'ruby', focused: false };
  const azure = { color: 'azure', focused: false };
  const mite = { tint: null };
  const shade = { tint: null, shade: true };
  const duskmoth = { tint: 'verdant' };
  const prowler = { tint: 'azure', armoured: true };
  check('mult: white on mite x1', near(segmentMult(white, mite, 2.5), 1));
  check('mult: shade immune to white', near(segmentMult(white, shade, 2.5), 0));
  check('mult: shade hurt by colour', segmentMult(ruby, shade, 2.5) > 0);
  check('mult: colour match x2', near(segmentMult({ color: 'verdant', focused: false }, duskmoth, 2.5), 2));
  check('mult: colour mismatch x0.5', near(segmentMult(azure, duskmoth, 2.5), 0.5));
  check('mult: armoured x0.5', near(segmentMult(white, prowler, 2.5), 0.5));
  check('mult: lens focus x2.5', near(segmentMult({ color: 'white', focused: true }, mite, 2.5), 2.5));
}
// 10. Segment cap: 40 mirrors cannot blow the budget.
{
  const glass = [];
  for (let i = 0; i < 40; i++) glass.push({ x: 300 + i * 18, y: 346, kind: 'mirror', angle: Math.PI / 4 });
  const s = traceBeam(O, EAST, glass, { maxSegments: 24 });
  check('cap: at most 24 segments', s.length <= 24);
}
// 11. Primitives.
{
  check('rayDisc: hit ahead', near(rayDisc(0, 0, 1, 0, 100, 0, 10), 90));
  check('rayDisc: miss to the side', rayDisc(0, 0, 1, 0, 100, 50, 10) === null);
  check('rayDisc: behind is null', rayDisc(0, 0, 1, 0, -100, 0, 10) === null);
  const r = reflectDir(1, 0, Math.PI / 4);
  check('reflectDir: east off 45deg goes south', near(r.dx, 0, 1e-9) && near(r.dy, 1, 1e-9));
}

console.log(`beam-test: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
