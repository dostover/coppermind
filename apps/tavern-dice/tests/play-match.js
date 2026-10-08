// Plays a full best-of-3 match in headless Chromium using only the action bar's
// main button (the same thing the Space key presses), and checks:
//  - no page errors, and the match finishes
//  - each meter's "at Resolution" preview matches what Resolution applies
//  - no horizontal overflow at phone width
// Usage: npm i -D playwright && node tests/play-match.js [path/to/index.html]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + file);
  const vals = () => p.$$eval('.meter', a => a.map(m => [m.querySelector('.val').textContent, m.querySelector('.pend')?.textContent || '']));
  let mismatches = 0, turns = 0, presses = 0, exp = null;
  for (; presses < 800; presses++) {
    const btn = await p.$('#bar [data-primary]:not([disabled])'); if (!btn) break;
    const label = await btn.innerText();
    if (/New match/.test(label)) break;
    const v = await vals();
    if (v.some(([, pend]) => / at Resolution|no change yet/.test(pend))) exp = v.map(([val, pend]) => { const m = pend.match(/([+−])(\d+) at/); return +val + (m ? (m[1] === '+' ? 1 : -1) * +m[2] : 0); });
    await btn.click(); await p.waitForTimeout(/Roll/.test(label) ? 420 : 30);
    if (await p.$('.turnres') && exp) {
      turns++; const got = (await vals()).map(([x]) => +x);
      if (!exp.every((e, i) => e === got[i] || (i % 2 === 0 && got[i] <= 0 && e <= 0))) mismatches++;
      exp = null;
    }
  }
  const winner = await p.$eval('.winner', e => e.innerText).catch(() => 'no winner');
  await p.setViewportSize({ width: 400, height: 900 });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(`${winner} · ${turns} turns · ${presses} button presses · preview mismatches: ${mismatches} · overflow at 400px: ${overflow}`);
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
  process.exit(errs.length || mismatches || overflow || winner === 'no winner' ? 1 : 0);
})();
