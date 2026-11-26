/* Browser click-through. Usage: BASE=http://localhost:8123/ node tests/e2e.js */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8123/';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
function ok(cond, name) { if (cond) { passed++; console.log('  ok   ' + name); } else { failed++; console.log('  FAIL ' + name); } }

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--lang=ar', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = [], external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(new URL(BASE).origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  const $ = (s) => page.$(s);
  const text = (s) => page.$eval(s, (e) => e.textContent).catch(() => null);
  const click = async (s) => { await page.waitForSelector(s, { timeout: 4000 }); await page.click(s); };
  const hash = () => page.evaluate(() => location.hash);

  async function answerCurrent(wrongFirst) {
    // compute the right answer from the DOM, then click it
    const info = await page.evaluate(() => {
      const D = window.AlifData, L = window.AlifLogic;
      const qb = document.querySelector('.qbox');
      const choices = [...document.querySelectorAll('.choices .choice')];
      if (document.querySelector('.stim-word')) {
        const w = document.querySelector('.stim-word').textContent; const c = L.firstLetter(w);
        return { type: 'btn', ans: String(c), pick: choices.find((b) => b.getAttribute('aria-label') === D.LETTERS.find((l) => l.c === c).ar).dataset.ans, all: choices.map((b) => b.dataset.ans) };
      }
      if (document.querySelector('.stim-letter')) {
        const c = document.querySelector('.stim-letter').textContent; const l = D.LETTERS.find((x) => x.c === c);
        return { type: 'btn', pick: choices.find((b) => b.getAttribute('aria-label') === l.wen).dataset.ans, all: choices.map((b) => b.dataset.ans) };
      }
      if (document.querySelector('.field')) {
        const n = document.querySelectorAll('.thing').length; return { type: 'btn', pick: String(n), all: choices.map((b) => b.dataset.ans) };
      }
      if (document.querySelector('.seqrow')) {
        const cells = [...document.querySelectorAll('.seqcell')]; const hole = cells.findIndex((c) => c.classList.contains('hole'));
        const toN = (s) => parseInt(s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10);
        const vals = cells.map((c, i) => (i === hole ? null : toN(c.textContent)));
        let step = null;
        for (let i = 0; i + 1 < vals.length; i++) if (vals[i] !== null && vals[i + 1] !== null) { step = vals[i + 1] - vals[i]; break; }
        const ans = vals[hole - 1] !== null && hole > 0 ? vals[hole - 1] + step : vals[hole + 1] - step;
        return { type: 'btn', pick: String(ans), all: choices.map((b) => b.dataset.ans) };
      }
      const eq = document.querySelector('.eq'); const parts = [...eq.children].map((x) => x.textContent);
      const toN = (s) => parseInt(s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10);
      const a = toN(parts[0]), b = toN(parts[2]), s = parts[1];
      const ans = s === '+' ? a + b : s === '−' ? a - b : a * b;
      if (document.querySelector('.keypad')) return { type: 'keys', pick: String(ans), all: [] };
      return { type: 'btn', pick: String(ans), all: choices.map((x) => x.dataset.ans) };
    });
    if (wrongFirst) {
      if (info.type === 'btn') { const wrong = info.all.find((a) => a !== info.pick); await click(`.choice[data-ans="${wrong}"]`); }
      else { await click('.key[data-key="9"]'); if (info.pick === '9') return; await click('#keyOk'); }
      await sleep(150);
      return info;
    }
    if (info.type === 'btn') await click(`.choice[data-ans="${info.pick}"]`);
    else { for (const d of info.pick) await click(`.key[data-key="${d}"]`); await click('#keyOk'); }
    return info;
  }
  async function playRound(opts = {}) {
    for (let i = 0; i < 10; i++) {
      await page.waitForSelector('.qbox', { timeout: 4000 });
      const q = await text('.qn');
      await answerCurrent(false);
      await sleep(1250);
    }
  }

  console.log('First run & profiles');
  await page.goto(BASE); await sleep(400);
  ok((await hash()) === '#/who', 'first run lands on child picker');
  await click('#saveKid'); await sleep(100);
  ok((await hash()) === '#/who', 'empty name is rejected');
  await page.type('#kidName', 'ليلى'); await click('#saveKid'); await sleep(300);
  ok((await hash()) === '#/' || (await hash()) === '', 'saving a child opens home');
  ok((await text('.chip-name')) === 'ليلى', 'child name shown on home');
  ok((await page.evaluate(() => document.documentElement.dir)) === 'rtl', 'default direction is RTL');
  ok((await page.$$('.card')).length === 6, 'home has 6 cards');

  console.log('Language');
  await click('#langBtn'); await sleep(200);
  ok((await page.evaluate(() => document.documentElement.dir)) === 'ltr' && (await page.evaluate(() => document.documentElement.lang)) === 'en', 'switch to English sets LTR');
  ok((await text('.brand')) === 'Alif', 'English brand');
  await click('#langBtn'); await sleep(200);
  ok((await text('.brand')) === 'ألف', 'back to Arabic');

  console.log('Learn letters');
  await click('[data-game="learn"]'); await sleep(200);
  ok((await page.$$('.ltile')).length === 28, '28 letter tiles');
  await click('.ltile[data-letter="ج"]'); await sleep(200);
  ok((await text('.big-glyph')) === 'ج', 'letter detail opens');
  ok((await page.$$('.form')).length === 4, 'joining letter shows 4 forms');
  await click('#sayLetter'); await sleep(100);
  const noteTxt = await text('#voiceNote');
  ok(typeof noteTxt === 'string', 'listen does not crash (voice note: ' + JSON.stringify(noteTxt) + ')');
  await click('#learnedBtn'); await sleep(300);
  ok((await text('#learnedBtn')).startsWith('✓'), 'mark learned');
  await click('#nextL'); await sleep(200);
  ok((await text('.big-glyph')) === 'ح', 'next letter');
  await click('#prevL'); await sleep(100); await click('#prevL'); await sleep(200);
  await page.goto(BASE + '#/learn/0'); await sleep(200);
  ok((await page.$$('.form')).length === 1, 'alif (non-joining) shows 1 form');
  await page.goto(BASE + '#/learn'); await sleep(200);
  ok((await page.$$('.ltile.seen')).length === 1, 'learned letter is marked in grid');

  console.log('Letter hunt: perfect round');
  await page.goto(BASE + '#/g/letters'); await sleep(200);
  await click('.segbtn[data-level="2"]'); await click('#startBtn'); await sleep(300);
  ok((await hash()) === '#/play', 'round started');
  await playRound();
  ok((await $('.bigstars')) !== null, 'result screen');
  ok((await page.$$('.bstar.on')).length === 3, 'perfect round earns 3 stars');
  await page.screenshot({ path: '/tmp/e2e-result.png' });

  console.log('Wrong answers');
  await click('#againBtn'); await sleep(300);
  await answerCurrent(true); await sleep(100);
  ok(((await text('#feedback')) || '').length > 0 && (await page.$$('.choice.wrong')).length === 1, 'first wrong answer shows try again');
  ok((await page.$$('.choice.right')).length === 0, 'answer not revealed after first miss');
  const wrongBtns = await page.$$eval('.choice:not(:disabled)', (b) => b.map((x) => x.dataset.ans));
  // second wrong
  const info = await page.evaluate(() => 0);
  const target = await page.evaluate(() => { const c = [...document.querySelectorAll('.choice')]; return c.filter((x) => !x.disabled).map((x) => x.dataset.ans); });
  // pick a wrong one again: any enabled choice that's not the right one
  const rightAns = await page.evaluate(() => {
    const D = window.AlifData, L = window.AlifLogic; const choices = [...document.querySelectorAll('.choices .choice')];
    if (document.querySelector('.stim-word')) { const c = L.firstLetter(document.querySelector('.stim-word').textContent); return choices.find((b) => b.getAttribute('aria-label') === D.LETTERS.find((l) => l.c === c).ar).dataset.ans; }
    const c = document.querySelector('.stim-letter').textContent; return choices.find((b) => b.getAttribute('aria-label') === D.LETTERS.find((l) => l.c === c).wen).dataset.ans;
  });
  const second = target.find((a) => a !== rightAns);
  await click(`.choice[data-ans="${second}"]`); await sleep(150);
  ok((await page.$$('.choice.right')).length === 1, 'second miss reveals the right answer');
  await sleep(2200);
  ok((await text('.qn')).includes('٢'), 'advances to question 2 after reveal');
  for (let i = 1; i < 10; i++) { await page.waitForSelector('.qbox'); await answerCurrent(false); await sleep(1250); }
  ok((await page.$$('.bstar.on')).length === 3, 'one missed question of 10 (9/10) still earns 3 stars');
  await click('#homeBtn'); await sleep(200);

  console.log('Counting, sequence, math rounds');
  for (const [g, lv] of [['count', 1], ['seq', 2], ['math', 1]]) {
    await page.goto(BASE + '#/g/' + g); await sleep(200);
    await click(`.segbtn[data-level="${lv}"]`);
    if (g === 'math') await click('.segbtn[data-op="mix"]');
    await click('#startBtn'); await sleep(250);
    await playRound();
    ok((await page.$$('.bstar.on')).length === 3, `${g} level ${lv}: perfect round`);
  }

  console.log('Math level 3 typed answers (keypad)');
  await page.goto(BASE + '#/g/math'); await sleep(200);
  await click('.segbtn[data-level="3"]'); await click('.segbtn[data-op="mul"]'); await click('#startBtn'); await sleep(250);
  ok((await $('.keypad')) !== null, 'keypad shown for level 3');
  await playRound();
  ok((await page.$$('.bstar.on')).length === 3, 'typed answers accepted');
  // keyboard entry
  await click('#againBtn'); await sleep(300);
  const ans = await page.evaluate(() => { const p = [...document.querySelector('.eq').children].map((x) => x.textContent); const t = (s) => parseInt(s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10); return String(t(p[0]) * t(p[2])); });
  for (const d of ans) await page.keyboard.press(d);
  await page.keyboard.press('Enter'); await sleep(200);
  ok((await text('#feedback')) && (await page.$$('.feedback.good')).length === 1, 'physical keyboard works');
  await page.screenshot({ path: '/tmp/e2e-typed.png' });

  console.log('Progress');
  await page.goto(BASE + '#/stars'); await sleep(300);
  const total = await text('#totalStars'), rounds = await text('#totalRounds');
  ok(total && total !== '٠', 'stars accumulated: ' + total);
  ok(rounds && parseInt(rounds.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10) >= 6, "rounds counted: " + rounds);
  ok((await page.$$('.mcell')).length === 28, 'mastery grid');
  ok((await page.$$('.bestrow')).length >= 4, 'best scores listed');

  console.log('Persistence');
  await page.reload(); await sleep(400);
  await page.goto(BASE + '#/stars'); await sleep(300);
  ok((await text('#totalStars')) === total, 'stars survive reload');

  console.log('Parents corner');
  await page.goto(BASE + '#/parents'); await sleep(300);
  ok((await $('#gateOut')) !== null, 'gate shown');
  await click('.key[data-key="1"]'); await click('#gateOk'); await sleep(150);
  ok((await $('#gateOut')) !== null, 'wrong gate answer does not open');
  const gate = await page.evaluate(() => { const p = [...document.querySelector('.eq').children].map((x) => x.textContent); const t = (s) => parseInt(s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10); return String(t(p[0]) * t(p[2])); });
  for (const d of gate) await click(`.key[data-key="${d}"]`);
  await click('#gateOk'); await sleep(250);
  ok((await $('#exportBtn')) !== null, 'correct answer opens settings');
  await click('.setrow:nth-of-type(2) .segbtn[data-val="en"]'); await sleep(150);
  await page.goto(BASE + '#/g/count'); await sleep(200); await click('#startBtn'); await sleep(200);
  ok(/[0-9]/.test(await text('.qn')), 'Western digits setting applies');
  await page.goto(BASE + '#/parents'); await sleep(200);
  const gate2 = await page.evaluate(() => { const p = [...document.querySelector('.eq').children].map((x) => x.textContent); return String(parseInt(p[0], 10) * parseInt(p[2], 10)); });
  for (const d of gate2) await click(`.key[data-key="${d}"]`);
  await click('#gateOk'); await sleep(250);
  // export
  const stored = await page.evaluate(() => localStorage.getItem('alif.v1'));
  ok(stored && JSON.parse(stored).kids.length === 1, 'data is in localStorage');
  // import a backup with two kids
  const backup = JSON.parse(stored);
  backup.kids.push({ id: 'kx', name: 'Omar', avatar: '🐢', stars: 12, rounds: 4, mastery: {}, best: {}, seen: {} });
  fs.writeFileSync('/tmp/alif-backup.json', JSON.stringify(backup));
  const fileInput = await $('#importFile'); await fileInput.uploadFile('/tmp/alif-backup.json'); await sleep(400);
  ok((await text('#backupMsg')).includes('2'), 'import shows 2 children');
  ok((await page.$$('.kidrow')).length === 2, 'imported child listed');
  fs.writeFileSync('/tmp/alif-bad.json', 'garbage');
  await (await $('#importFile')).uploadFile('/tmp/alif-bad.json'); await sleep(400);
  ok((await text('#backupMsg')).length > 0 && (await page.$$('.kidrow')).length === 2, 'bad import rejected, data intact');
  // delete needs two taps
  await click('[data-del="Omar"]'); await sleep(100);
  ok((await page.$$('.kidrow')).length === 2, 'delete needs a second tap');
  await click('[data-del="Omar"]'); await sleep(200);
  ok((await page.$$('.kidrow')).length === 1, 'second tap deletes');
  // hold to reset: a quick tap does nothing
  await click('#resetBtn'); await sleep(300);
  ok(JSON.parse(await page.evaluate(() => localStorage.getItem('alif.v1'))).kids.length === 1, 'quick tap does not erase');
  const box = await (await $('#resetBtn')).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await sleep(1900); await page.mouse.up(); await sleep(300);
  ok((await hash()) === '#/who' && JSON.parse(await page.evaluate(() => localStorage.getItem('alif.v1'))).kids.length === 0, 'press and hold erases everything');

  console.log('Offline');
  await page.goto(BASE); await sleep(600);
  await page.type('#kidName', 'Sam'); await click('#saveKid'); await sleep(300);
  const swReady = await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready.then(() => true));
  ok(swReady === true, 'service worker active');
  await sleep(1000);
  await page.setOfflineMode(true);
  await page.reload(); await sleep(600);
  ok((await text('.brand')) === 'ألف', 'app loads with no network');
  await page.goto(BASE + '#/learn'); await sleep(300);
  ok((await page.$$('.ltile')).length === 28, 'works offline');
  await page.setOfflineMode(false);

  console.log('Hygiene');
  ok(external.length === 0, 'no requests leave the origin ' + JSON.stringify(external));
  ok(errors.length === 0, 'no console or page errors ' + JSON.stringify(errors));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!overflow, 'no horizontal overflow at 390px');

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
