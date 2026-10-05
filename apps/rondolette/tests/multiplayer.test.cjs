// End-to-end test of Rondolette's online play: three browser pages share a mocked
// Firebase and play through a game. Prints PASS/FAIL per check; exits 1 on any failure.
//
//   node apps/rondolette/tests/multiplayer.test.cjs [--headed] [--keep-shots]
//
// Needs Playwright with Chromium (see tests/README.md).
const path = require('path'), os = require('os'), fs = require('fs');
const { chromium } = require('playwright');
const { buildTestPage, serve } = require('./_build.cjs');

const PORT = 8790, sleep = ms => new Promise(r => setTimeout(r, ms));
const headed = process.argv.includes('--headed'), keepShots = process.argv.includes('--keep-shots');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const text = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
async function flick(page, dx = 80, dy = 10){
  const box = await (await page.$('#board')).boundingBox();
  const x = box.x + box.width * 0.3, y = box.y + box.height * 0.45;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 4 }); await page.mouse.up();
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rondolette-test-'));
  buildTestPage(dir);
  const srv = await serve(dir, PORT);
  const browser = await chromium.launch({ headless: !headed });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const open = async (user, query = '') => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${user}: ${e.message}`));
    await p.goto(`http://localhost:${PORT}/index.html?u=${user}${query}`);
    return p;
  };
  try {
    const A = await open('alice');
    await A.evaluate(() => localStorage.clear()); await A.reload(); await sleep(400);

    // 1. Create a table
    await A.click('#tabOnline'); await sleep(200);
    await A.click('[data-act=create]'); await sleep(300);
    const code = new URL(A.url()).searchParams.get('t');
    check('Create table puts a code in the URL', /^[A-Z]+-\d{4}$/.test(code || ''), code);
    await A.fill('#netNick', 'Dan'); await A.click('[data-act=join]'); await sleep(300);

    // 2. Invite link opens straight onto the table
    const B = await open('bob', `&t=${code}`); await sleep(600);
    check('Invite link opens the Online tab', (await B.getAttribute('#tabOnline', 'aria-pressed')) === 'true');
    check('Invited player sees the table and the first seat', (await text(B, '#netBody')).includes(code) && (await text(B, '#netBody')).includes('1. Dan'));
    await B.fill('#netNick', 'Sam'); await B.click('[data-act=join]'); await sleep(300);

    // 3. Settings and start
    await A.selectOption('#netTarget', '500'); await sleep(300);
    check('Settings sync to other players', (await text(B, '#netBody')).includes('First to 500'));
    await A.click('[data-act=start]'); await sleep(400);
    check('Turn flags agree', (await text(A, '#turnFlag')) === 'Your turn' && (await text(B, '#turnFlag')) === "Dan's turn");

    // 4. Live watching
    await flick(A); await sleep(1500);
    check('Watcher sees the spin live', /Dan is spinning/.test(await text(B, '#hint')), await text(B, '#hint'));

    // 5. Result and turn passing
    await B.waitForFunction(() => /Your turn/.test(document.getElementById('turnFlag').textContent), null, { timeout: 70000 });
    await sleep(400);
    check('Spin result reaches the other player', /Dan scores/.test(await text(B, '#result')), await text(B, '#result'));
    check('Turn passes to the next seat', (await text(A, '#turnFlag')) === "Sam's turn");
    const logB = await text(B, '#log');
    check('Recent turns log is shared', /Dan/.test(logB), logB);

    // 6. A forced winning spin shows the banner everywhere
    await B.evaluate(() => { window.__fake = () => ({ total: 600, scored: 1, redScored: true, off: 0, items: [{ kind: 'plain', pts: 600 }], hits: [], all: false, count: 6 }); });
    await flick(B, 60, 0);
    await A.waitForFunction(() => !document.getElementById('winSheet').hidden, null, { timeout: 70000 });
    check('Win banner on the other screen', (await text(A, '#winTitle')) === 'Congratulations, Sam!', await text(A, '#winTitle'));
    check('Win banner on the winner\'s screen', (await text(B, '#winTitle')) === 'Congratulations, Sam!');

    // 7. Play again resets the table
    await A.click('#rematchBtn'); await sleep(500);
    const scores = await A.$$eval('#netBody .seats .score', els => els.map(e => e.textContent.trim()));
    check('Play again resets scores and starts with seat 1', (await text(A, '#turnFlag')) === 'Your turn' && scores.join(',') === '0,0', scores.join(','));

    // 8. Joining by code
    const C = await open('carl'); await sleep(300);
    await C.click('#tabOnline'); await sleep(200);
    await C.fill('#joinCode', 'nope'); await C.click('[data-act=joinCode]'); await sleep(150);
    check('Bad table code is rejected', /doesn't look right/.test(await text(C, '#netBody')));
    await C.fill('#joinCode', code.toLowerCase()); await C.click('[data-act=joinCode]'); await sleep(500);
    check('Code entry is case-insensitive and joins as a watcher', /game is in progress/.test(await text(C, '#netBody')));

    if (keepShots){ await A.screenshot({ path: 'rondolette-a.png' }); await B.screenshot({ path: 'rondolette-b.png' }); }
    check('No page errors', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('Test run completed', false, e.message.split('\n')[0]);
  } finally {
    await browser.close(); srv.close();
  }
  const failed = results.filter(r => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
