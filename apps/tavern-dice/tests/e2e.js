// End-to-end test suite for the Tavern Dice table app (index.html).
// Drives the real page in headless Chromium and checks every user-facing flow,
// plus a parity check of the app's rules engine against the Python simulator.
//
// Usage:
//   python3 tests/parity_cases.py 400 1 > /tmp/parity.json
//   npm i -D playwright && node tests/e2e.js [index.html] [/tmp/parity.json]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const PARITY = process.argv[3];
const URL = 'file://' + FILE + '?test';
const results = [];
let page, errors = [];

async function test(name, fn) {
  const before = errors.length;
  try { const note = await fn(); if (errors.length > before) throw new Error('page error: ' + errors.slice(before).join(' | ')); results.push([true, name, note || '']); }
  catch (e) { results.push([false, name, String(e.message || e).split('\n')[0].slice(0, 220)]); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const S = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__td.S)));
const setS = fn => page.evaluate(fn);
const barText = () => page.$eval('#bar', e => e.innerText.replace(/\s+/g, ' '));
const primary = async () => { await page.click('#bar [data-primary]'); await page.waitForTimeout(80); };
async function fresh(opts = {}) {
  await page.goto(URL); await page.waitForTimeout(250);
  if (opts.autopass !== undefined) await page.evaluate(v => localStorage.setItem('td-autopass', String(v)), opts.autopass);
  if (opts.autopass !== undefined) { await page.reload(); await page.waitForTimeout(250); }
}
// Put the game into the Influence phase with chosen dice / faces / Gold, without random rolls
async function setup({ d0, d1, r0, r1, G = [5, 5], R = [10, 10], step = 'fortune', prio = 0, active = 0, turn = 1 }) {
  await page.evaluate(({ d0, d1, r0, r1, G, R, step, prio, active, turn }) => {
    const S = window.__td.S;
    [[d0, r0], [d1, r1]].forEach(([d, r], k) => {
      const p = S.players[k];
      p.dice = d.slice(); p.res = (r || d.map(n => window.__td.DICE[n].f[0])).slice(); p.base = p.res.slice();
      p.jam = d.map(() => false); p.extra = []; p.used = {}; p.surge = []; p.sneak = []; p.venom = []; p.divine = 0; p.mimic = null; p.rel = [];
      p.G = G[k]; p.R = R[k];
    });
    Object.assign(S, { phase: 'influence', step, prio, active, turn, passes: 0, pending: null, result: null, roundWinner: null, matchWinner: null, log: [] });
    window.__td.render();
  }, { d0, d1, r0, r1, G, R, step, prio, active, turn });
}

(async () => {
  const browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { errors.push('unexpected dialog: ' + d.message()); d.dismiss(); });

  // ---------------------------------------------------------------- load & gallery
  await test('Page loads without errors; version label', async () => {
    await fresh();
    const ver = await page.$eval('.ver', e => e.textContent);
    ok(/Rules v\d/.test(ver) && /52 dice/.test(ver), 'version label: ' + ver);
    ok(await page.$('#bar [data-primary]'), 'action bar missing');
    return ver;
  });
  await test('Dice gallery: 52 cards, rarity and symbol filters', async () => {
    await page.click('#tab-dice'); await page.waitForTimeout(100);
    const all = await page.$$eval('#grid .card', a => a.length); ok(all === 52, 'cards ' + all);
    const counts = {};
    for (const r of ['Basic', 'Common', 'Uncommon', 'Rare']) { await page.click(`.rchip.r-${r}`); counts[r] = await page.$$eval('#grid .card', a => a.length); await page.click(`.rchip.r-${r}`); }
    ok(counts.Basic === 5 && counts.Common === 23 && counts.Uncommon === 14 && counts.Rare === 10, JSON.stringify(counts));
    await page.click('#filters [data-f="L"]'); const lightning = await page.$$eval('#grid .card', a => a.length);
    ok(lightning > 0 && lightning < 52, 'lightning filter ' + lightning);
    await page.click('#filters [data-f=""]');
    const faces = await page.$$eval('#grid .card', cs => cs.every(c => c.querySelectorAll('.faces .die').length === 6)); ok(faces, 'a card without 6 faces');
    await page.click('#tab-table');
    return JSON.stringify(counts) + `, ⚡ filter ${lightning}`;
  });

  // ---------------------------------------------------------------- loadout, tooltips, names
  await test('Loadout picker: choose 5 dice, tooltips show faces', async () => {
    await fresh();
    await page.click('[data-act="loadout:0"]'); await page.waitForTimeout(100);
    await page.hover('[data-dtip="Watchman"]'); await page.waitForTimeout(100);
    const faces = await page.$$eval('#tip .tfaces .die', a => a.length); ok(faces === 6, 'tooltip faces ' + faces);
    while (await page.$('.pick button[aria-pressed="true"]')) await page.click('.pick button[aria-pressed="true"]');   // list redraws after each click
    for (const n of ['Watchman', 'Cook', 'Smith', 'Druid', 'Viper']) await page.click(`.pick [data-n="${n}"]`);
    await page.click('#sheet [data-m="ok"]'); await page.waitForTimeout(100);
    const names = await page.$$eval('#p0 .tray .nm', a => a.map(x => x.textContent));
    ok(names.join() === 'Watchman,Cook,Smith,Druid,Viper', names.join());
    ok(await page.$eval('#tip', e => e.hidden), 'tooltip left open after closing picker');
    return names.join(', ');
  });
  await test('Player name and loadout persist after reload', async () => {
    await page.fill('#name0', 'Tester'); await page.press('#name0', 'Tab'); await page.waitForTimeout(100);
    await page.reload(); await page.waitForTimeout(250);
    const n = await page.$eval('#name0', e => e.value), d = await page.$$eval('#p0 .tray .nm', a => a.map(x => x.textContent).join());
    ok(n === 'Tester', 'name ' + n); ok(d === 'Watchman,Cook,Smith,Druid,Viper', 'dice ' + d);
  });
  await test('Ability rows and Gold-action tooltips', async () => {
    // abilities are written out in each player's ability rows (no hover needed)
    const rows = await page.$$eval('#p0 .drow', a => a.map(r => r.innerText)); ok(rows.length === 5 && rows.every(t => t.length > 10), 'ability rows');
    const a = rows[0].split('\n')[0];
    await page.mouse.move(1, 1); await page.$eval('[data-gtip="0:focus"]', e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(150); await page.hover('[data-gtip="0:focus"]'); await page.waitForTimeout(100);
    const g = await page.$eval('#tip', e => e.hidden ? '' : e.querySelector('.tn').textContent); ok(g === 'Focus', 'gold tooltip ' + g);
    return `ability "${a}", gold "${g}"`;
  });

  // ---------------------------------------------------------------- Gold actions & declare/Ward
  await test('Reroll costs 1 Gold and passes priority', async () => {
    await fresh({ autopass: false });
    await setup({ d0: ['Basic', 'Soldier', 'Guardian', 'Knight', 'Archer'], d1: ['Basic', 'Thief', 'Monster', 'Dwarven', 'Cleric'] });
    await page.click('[data-act="gold:0:reroll"]'); await page.click('#sheet [data-j="0"]'); await page.waitForTimeout(450);
    const s = await S(); ok(s.players[0].G === 4, 'G ' + s.players[0].G); ok(s.prio === 1, 'prio ' + s.prio); ok(/Reroll/.test(s.log[0]), s.log[0]);
  });
  await test('Focus: pick one of two results', async () => {
    await page.click('[data-act="gold:1:focus"]'); await page.click('#sheet [data-j="1"]'); await page.waitForTimeout(80);
    await page.click('#sheet [data-act^="pick:"]'); await page.waitForTimeout(80);
    const s = await S(); ok(s.players[1].G === 3, 'G ' + s.players[1].G); ok(/Focus/.test(s.log[0]), s.log[0]);
  });
  await test('Mulligan: reroll up to 3 dice', async () => {
    await page.click('[data-act="gold:0:mulligan"]'); for (const j of [0, 1, 2]) await page.click(`#sheet [data-j="${j}"]`);
    await page.click('#sheet [data-m="ok"]'); await page.waitForTimeout(450);
    const s = await S(); ok(s.players[0].G === 2, 'G ' + s.players[0].G); ok(/Mulligan/.test(s.log[0]), s.log[0]);
  });
  await test('Distract is declared; Ward cancels it (both pay)', async () => {
    const before = (await S()).players[0].res.slice();
    await page.click('[data-act="gold:1:distract"]'); await page.click('#sheet [data-j="0"]'); await page.waitForTimeout(80);
    let s = await S(); ok(s.pending && s.pending.type === 'distract', 'no pending');
    ok(/Ward or allow/.test(await barText()), 'bar does not ask to respond');
    ok(await page.$eval('#p0', e => e.classList.contains('must-respond')), 'target panel not highlighted');
    await page.click('#bar [data-act="ward"]'); await page.waitForTimeout(80);
    s = await S(); ok(!s.pending, 'still pending'); ok(s.players[1].G === 2 && s.players[0].G === 1, `G ${s.players[0].G}/${s.players[1].G}`);
    ok(JSON.stringify(s.players[0].res) === JSON.stringify(before), 'warded die changed');
  });
  await test('Stubborn dice cannot be Distracted', async () => {
    await setup({ d0: ['Dwarven', 'Basic', 'Soldier', 'Knight', 'Archer'], d1: ['Basic', 'Thief', 'Monster', 'Guardian', 'Cleric'], prio: 1 });
    await page.click('[data-act="gold:1:distract"]');
    const dis = await page.$eval('#sheet [data-j="0"]', e => e.disabled); await page.click('#sheet [data-m="close"]');
    ok(dis, 'Dwarven selectable');
  });
  await test('Jam (Tactics) turns off an ability; Allow via Space', async () => {
    await setup({ d0: ['Druid', 'Basic', 'Soldier', 'Knight', 'Archer'], d1: ['Basic', 'Thief', 'Monster', 'Guardian', 'Cleric'], step: 'tactics', prio: 1 });
    await page.click('[data-act="gold:1:jam"]'); await page.click('#sheet [data-j="0"]'); await page.waitForTimeout(80);
    await page.mouse.click(5, 5); await page.keyboard.press('Space'); await page.waitForTimeout(100);
    const s = await S(); ok(s.players[0].jam[0] === true, 'not jammed'); ok(s.players[1].G === 3, 'G ' + s.players[1].G);
  });
  await test('Step gating: Fortune actions locked in Tactics and vice versa', async () => {
    const t = await page.$$eval('#p0 .gbtn', a => a.map(b => b.disabled));
    ok(t.slice(0, 4).every(Boolean), 'Fortune buttons enabled in Tactics');
    await setup({ d0: ['Basic', 'Soldier', 'Guardian', 'Knight', 'Archer'], d1: ['Basic', 'Thief', 'Monster', 'Dwarven', 'Cleric'] });
    const jam = await page.$eval('[data-act="gold:0:jam"]', b => b.disabled); ok(jam, 'Jam enabled in Fortune');
    const other = await page.$eval('[data-act="gold:1:reroll"]', b => b.disabled); ok(other, 'non-priority player can act');
  });

  // ---------------------------------------------------------------- every activated ability
  await test('Every activated die ability can be used', async () => {
    const list = await page.evaluate(() => { const D = window.__td.DICE; return Object.keys(D).filter(n => D[n].ab); });
    const used = [], skipped = [], failed = [];
    for (const n of list) {
      // find a face where the ability is usable
      const found = await page.evaluate(n => {
        const D = window.__td.DICE, S = window.__td.S;
        for (const f of D[n].f) {
          const p = S.players[0]; p.dice = [n, 'Basic', 'Soldier', 'Monster', 'Cleric']; p.res = [f, 'A', 'D', 'S', 'H']; p.base = p.res.slice();
          p.jam = [false, false, false, false, false]; p.used = {}; p.G = 5; p.R = 8; p.surge = []; p.sneak = []; p.venom = []; p.extra = []; p.divine = 0; p.mimic = n === 'Mimic' ? 'Wild Shape' : null;
          const o = S.players[1]; o.dice = ['Cleric', 'Basic', 'Viper', 'Guardian', 'Pilgrim']; o.res = ['H', 'A', 'P', 'D', 'H']; o.G = 2; o.jam = [false,false,false,false,false]; o.venom = []; o.used = {};
          const a = window.__td.abilityAction(0, 0);
          if (a && a.ok) return f;
        }
        return null;
      }, n);
      if (found === null) { skipped.push(n); continue; }
      const step = await page.evaluate(n => ['Omen'].includes(window.__td.DICE[n].ab) ? 'fortune' : 'tactics', n);
      await page.evaluate(([step]) => { const S = window.__td.S; Object.assign(S, { phase: 'influence', step, prio: 0, active: 0, passes: 0, pending: null, result: null, roundWinner: null, matchWinner: null, log: [] }); window.__td.render(); }, [step]);
      const btn = await page.$('#p0 .drow:first-child .btn.use:not([disabled])');
      if (!btn) { failed.push(n + ' (no Use button)'); continue; }
      const before = JSON.stringify(await S());
      await btn.click(); await page.waitForTimeout(60);
      for (let k = 0; k < 4 && !(await page.$eval('#ov', e => e.hidden)); k++) {
        const choice = await page.$('#sheet [data-act^="pick:"], #sheet .pick button:not([disabled]):not([aria-pressed="true"])');
        if (choice) await choice.click();
        const okb = await page.$('#sheet [data-m="ok"]:not([disabled])'); if (okb) await okb.click();
        if (!choice && !okb) { const sec = await page.$$('#sheet .pick button:not([disabled])'); if (sec[1]) await sec[1].click(); else break; }
        await page.waitForTimeout(60);
      }
      if (!(await page.$eval('#ov', e => e.hidden))) { await page.click('#sheet [data-m="close"]'); failed.push(n + ' (dialog stuck)'); continue; }
      const s = await S();
      if (s.pending) await page.click('#bar [data-act="allow"]');
      (JSON.stringify(await S()) !== before ? used : failed).push(n);
    }
    ok(!failed.length, 'failed: ' + failed.join(', '));
    return `${used.length} used, ${skipped.length} passive/none` ;
  });

  // ---------------------------------------------------------------- engine parity with the simulator
  await test('Rules engine matches the simulator (random Resolution cases)', async () => {
    ok(PARITY && fs.existsSync(PARITY), 'run tests/parity_cases.py first and pass its JSON path');
    const cases = JSON.parse(fs.readFileSync(PARITY, 'utf8'));
    const bad = await page.evaluate(cases => {
      const S = window.__td.S, out = [];
      cases.forEach((c, n) => {
        c.p.forEach((q, k) => { const p = S.players[k]; Object.assign(p, { dice: q.dice, res: q.res.map(f => f === '-' ? '' : f), R: q.R, G: q.G, jam: [false,false,false,false,false], extra: [], used: {}, surge: [], sneak: [], venom: [], divine: 0, mimic: null }); });
        S.turn = c.turn;
        const r = window.__td.resolveRound(true);
        const got = r.rows.map(x => [x.R, x.G]);
        if (JSON.stringify(got) !== JSON.stringify(c.expect)) out.push({ n, turn: c.turn, a: c.p[0].dice.map((d, i) => d + ':' + c.p[0].res[i]).join(' '), b: c.p[1].dice.map((d, i) => d + ':' + c.p[1].res[i]).join(' '), R: [c.p[0].R, c.p[1].R], G: [c.p[0].G, c.p[1].G], app: got, sim: c.expect });
      });
      return out;
    }, cases);
    if (bad.length) { fs.writeFileSync(path.join(path.dirname(PARITY), 'parity-mismatches.json'), JSON.stringify(bad, null, 1)); }
    ok(!bad.length, `${bad.length}/${cases.length} cases differ (see parity-mismatches.json); first: ${JSON.stringify(bad[0])}`);
    return `${cases.length} cases identical`;
  });

  // ---------------------------------------------------------------- Mend and Closing Time in the UI
  await test('Closing Time banner and Mend preview', async () => {
    await fresh({ autopass: false });
    await setup({ d0: ['Cleric', 'Basic', 'Soldier', 'Knight', 'Archer'], d1: ['Oracle', 'Thief', 'Monster', 'Guardian', 'Basic'], r0: ['HH', 'D', 'D', 'D', 'D'], r1: ['G', 'G', 'G', 'D', 'G'], R: [7, 10], turn: 10 });
    const banner = await page.$eval('.lastcall', e => e.textContent); ok(/Closing Time: both lose 1/.test(banner), banner);
    const pend = await page.$eval('#p0 .meter[data-m="R"] .pend', e => e.textContent); ok(/−1 at Resolution/.test(pend), 'preview ' + pend);
    await page.evaluate(() => { window.__td.S.turn = 9; window.__td.render(); });
    const b9 = await page.$eval('.lastcall', e => e.textContent); ok(/starts next turn/.test(b9), b9);
    return banner.trim();
  });

  // ---------------------------------------------------------------- flow: auto-pass, undo, rounds, swap, match
  await test('Auto-pass skips players who cannot act; toggle persists', async () => {
    await fresh({ autopass: true });
    // dice with no activated abilities and no Gold: nobody can act, so the turn resolves by itself
    await setup({ d0: ['Basic', 'Brawler', 'Monster', 'Shieldbearer', 'Peddler'], d1: ['Basic', 'Pilgrim', 'Soldier', 'Guardian', 'Knight'], G: [0, 0] });
    const s = await S(); ok(s.result, 'should auto-resolve when nobody can act');
    ok(s.log.some(l => /nothing to do/.test(l)), 'no auto-pass log');
    await page.click('[data-act="autopass"]'); await page.reload(); await page.waitForTimeout(250);
    const on = await page.$eval('[data-act="autopass"]', e => e.checked); ok(on === false, 'toggle not persisted');
  });
  await test('Undo restores the previous state', async () => {
    await fresh({ autopass: false });
    await primary(); await page.waitForTimeout(400);
    const a = await S(); ok(a.phase === 'influence', 'phase ' + a.phase);
    await primary(); const b = await S(); ok(b.passes === 1, 'passes ' + b.passes);
    await page.click('#bar [data-act="undo"]'); const c = await S();
    ok(c.passes === 0 && c.prio === a.prio, 'undo did not restore');
  });
  await test('Full match through the action bar, Tavern Swap, new match', async () => {
    await fresh({ autopass: true });
    let presses = 0, swapped = false, turns = 0;
    while (presses++ < 600) {
      const s = await S();
      if (s.matchWinner) break;
      if (s.round > 1 && s.turn === 1 && s.phase === 'roll' && !swapped) {
        const k = s.lastLoser;
        await page.click(`[data-act="swap:${k}"]`); const cur = await page.$$eval('.pick button[aria-pressed="true"]', a => a.map(b => b.dataset.n));
        await page.click(`.pick [data-n="${cur[0]}"]`); await page.click('.pick button[aria-pressed="false"]:not([disabled])');
        await page.click('#sheet [data-m="ok"]'); swapped = true;
        const t = await S(); ok((t.swapUsed[k] || 0) === 1, 'swap not counted');
      }
      const label = await page.$eval('#bar [data-primary]', e => e.textContent);
      await primary(); if (/Roll/.test(label)) { turns++; await page.waitForTimeout(350); }
    }
    const s = await S(); ok(s.matchWinner, 'no winner after ' + presses + ' presses'); ok(swapped, 'never reached round 2');
    const w = await page.$eval('.winner', e => e.textContent);
    await primary(); const n = await S(); ok(!n.matchWinner && n.round === 1 && n.score.join() === '0,0', 'new match did not reset');
    return `${w} (${turns} turns, ${presses} presses)`;
  });
  await test('Meter previews always match what Resolution applies', async () => {
    await fresh({ autopass: true });
    let checked = 0, bad = 0;
    for (let i = 0; i < 300 && checked < 25; i++) {
      const s = await S(); if (s.matchWinner) { await primary(); continue; }
      if (s.phase === 'influence' && !s.pending) {
        const exp = await page.$$eval('.meter', a => a.map(m => { const v = +m.querySelector('.val').textContent; const t = m.querySelector('.pend')?.textContent || ''; const x = t.match(/([+−])(\d+) at/); return v + (x ? (x[1] === '+' ? 1 : -1) * +x[2] : 0); }));
        await primary(); const t = await S();
        if (t.result) { checked++; const got = await page.$$eval('.meter .val', a => a.map(e => +e.textContent)); if (!exp.every((e, j) => e === got[j] || (j % 2 === 0 && got[j] <= 0 && e <= 0))) bad++; }
      } else { await primary(); await page.waitForTimeout(350); }
    }
    ok(checked >= 10, 'only ' + checked + ' turns checked'); ok(!bad, `${bad} of ${checked} previews wrong`);
    return `${checked} turns checked`;
  });

  // ---------------------------------------------------------------- layout
  await test('Layout: no horizontal overflow at 1280 / 860 / 400 px', async () => {
    const out = [];
    for (const w of [1280, 860, 400]) {
      await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(150);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); ok(over <= 0, `${w}px overflows by ${over}`);
      const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.board')).gridTemplateColumns.split(' ').length); out.push(`${w}:${cols}col`);
    }
    await page.screenshot({ path: path.join(path.dirname(PARITY || FILE), 'e2e-mobile.png') });
    await page.setViewportSize({ width: 1280, height: 1000 });
    return out.join(' ');
  });

  await browser.close();
  const w = Math.max(...results.map(r => r[1].length));
  for (const [pass, name, note] of results) console.log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(w)}  ${note}`);
  const failed = results.filter(r => !r[0]).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
