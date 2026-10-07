// Plays a full best-of-3 match in headless Chromium and checks for page errors,
// that each meter's "at Resolution" preview matches what Resolution applies,
// and that the page has no horizontal overflow at phone width.
// Usage: npm i -D playwright && node tests/play-match.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  const has = s => p.$(s).then(e => !!e);
  const vals = () => p.$$eval('.meter', a => a.map(m => [m.querySelector('.val').textContent, m.querySelector('.pend')?.textContent || '']));
  let mismatches = 0, turns = 0;
  for (let g = 0; g < 600; g++) {
    if (await has('[data-act="roll"]')) { await p.click('[data-act="roll"]'); await p.waitForTimeout(450); continue; }
    if (await has('.btn.pass')) {
      const exp = (await vals()).map(([v, pend]) => { const m = pend.match(/([+−])(\d+) at/); return +v + (m ? (m[1] === '+' ? 1 : -1) * +m[2] : 0); });
      while (await has('.btn.pass')) await p.click('.btn.pass');
      await p.click('[data-act="resolve"]'); turns++;
      const got = (await vals()).map(([v]) => +v);
      if (!exp.every((e, i) => e === got[i] || (i % 2 === 0 && got[i] <= 0 && e <= 0))) mismatches++;
      continue;
    }
    if (await has('[data-act="nextturn"]')) { await p.click('[data-act="nextturn"]'); continue; }
    if (await has('[data-act="nextround"]')) { await p.click('[data-act="nextround"]'); continue; }
    break;
  }
  const winner = await p.$eval('.winner', e => e.innerText).catch(() => 'no winner');
  await p.setViewportSize({ width: 400, height: 900 });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(`${winner} · ${turns} turns · preview mismatches: ${mismatches} · overflow at 400px: ${overflow}`);
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
  process.exit(errs.length || mismatches || overflow ? 1 : 0);
})();
