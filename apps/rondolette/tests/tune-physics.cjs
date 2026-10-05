// Physics tuning harness for Rondolette. Runs many random spins headlessly for each
// set of PHYS overrides and prints how the game feels in numbers.
//
//   node apps/rondolette/tests/tune-physics.cjs                       # current settings
//   node apps/rondolette/tests/tune-physics.cjs --spins 100 \
//        --sets '[{}, {"WELL":30}, {"CAPTURE":120,"ROLL":4}]'
//
// Columns: balls scored per spin (of 6), points per spin, ball-on-ball crashes per spin
// (impacts faster than 40 px/s), seconds before a ball drops in, balls off the board per
// spin, spin length in seconds, and spins where all six scored. Random spins are noisy:
// differences under ~0.2 balls with 80 spins are within run-to-run variation.
const path = require('path'), os = require('os'), fs = require('fs');
const { chromium } = require('playwright');
const { buildTestPage, serve } = require('./_build.cjs');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const spins = Number(arg('--spins', 80));
const sets = JSON.parse(arg('--sets', '[{}]'));
const PORT = 8791;

// Instrumentation added to the test copy only. Each anchor must exist in index.html.
const PATCHES = [
  ['if (rv<0){ const j=-(1+e)*rv/2;', 'if (rv<-40) window.__crashes=(window.__crashes||0)+1; if (rv<0){ const j=-(1+e)*rv/2;'],
  ["b.state='sinking'; b.hole=dip;", "(window.__drops=window.__drops||[]).push(window.__simT||0); b.state='sinking'; b.hole=dip;"],
  ['while (t<60){ for (let i=0;i<SUB;i++) step(dt/SUB); t+=dt;', 'while (t<60){ for (let i=0;i<SUB;i++) step(dt/SUB); t+=dt; window.__simT=t;'],
];

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rondolette-tune-'));
  buildTestPage(dir);
  let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  for (const [a, b] of PATCHES){
    if (!html.includes(a)) { console.error(`Anchor not found, update PATCHES in tune-physics.cjs:\n  ${a}`); process.exit(2); }
    html = html.replace(a, b);
  }
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  const srv = await serve(dir, PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/index.html`); await page.waitForTimeout(400);
  console.log(['settings', 'balls', 'points', 'crashes', 'drop s', 'off', 'spin s', 'all six'].join('\t'));
  for (const over of sets){
    const r = await page.evaluate(([n, o]) => {
      window.__crashes = 0; window.__drops = [];
      const res = window.__tyrolTest(n, o);
      const d = window.__drops;
      return { ...res, crashes: window.__crashes / n, dropT: d.reduce((a, b) => a + b, 0) / Math.max(1, d.length) };
    }, [spins, over]);
    // overrides persist inside the page, so reload between sets
    await page.reload(); await page.waitForTimeout(300);
    console.log([JSON.stringify(over), r.avgScored.toFixed(2), r.avgTotal.toFixed(0), r.crashes.toFixed(1), r.dropT.toFixed(1), r.avgOff.toFixed(2), r.avgDur.toFixed(1), r.allSix].join('\t'));
  }
  await browser.close(); srv.close();
})();
