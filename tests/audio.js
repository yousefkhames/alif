/* Audio click-through: every clip exists, buttons play bundled files, works offline. Usage: BASE=... node tests/audio.js */
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8123/';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
function ok(c, n) { if (c) console.log('  ok   ' + n); else { failed++; console.log('  FAIL ' + n); } }
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await b.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    window.__played = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__played.push(this.src.split('/audio/')[1]); return orig.call(this); };
  });
  await page.goto(BASE); await sleep(500);
  await page.type('#kidName', 'ليلى'); await page.click('#saveKid'); await sleep(300);
  await page.goto(BASE + '#/learn/1'); await sleep(800);
  const keys = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 28; i++) for (const k of ['n', 'w', 's']) out.push(k + String(i).padStart(2, '0'));
    for (let i = 0; i <= 20; i++) out.push('d' + String(i).padStart(2, '0'));
    for (let i = 0; i < 5; i++) out.push('p0' + i);
    const bad = [];
    for (const k of out) { const r = await fetch('audio/' + k + '.mp3'); const buf = await r.arrayBuffer(); if (!r.ok || buf.byteLength < 1500) bad.push(k); }
    return { n: out.length, bad };
  });
  ok(keys.n === 110 && keys.bad.length === 0, '110 clips load and are non-trivial ' + JSON.stringify(keys.bad));
  await page.click('#sayLetter'); await sleep(300);
  await page.click('#sayLetterSound'); await sleep(300);
  await page.evaluate(() => document.querySelector('.example .iconbtn').click()); await sleep(300);
  const played = await page.evaluate(() => window.__played);
  ok(played[0] === 'n01.mp3' && played[1] === 's01.mp3' && played[2] === 'w01.mp3', 'letter name, sound and word clips play: ' + played.join(','));
  await page.goto(BASE + '#/numbers'); await sleep(300);
  await page.click('.ntile[data-n="11"]'); await sleep(300);
  ok((await page.evaluate(() => window.__played)).includes('d11.mp3'), 'number 11 clip plays');
  // offline
  await sleep(1500);
  const cached = await page.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).length);
  ok(cached >= 110, 'service worker cached ' + cached + ' entries');
  await page.setOfflineMode(true);
  await page.reload(); await sleep(800);
  await page.goto(BASE + '#/learn/5'); await sleep(300);
  await page.click('#sayLetterSound'); await sleep(500);
  const r2 = await page.evaluate(() => window.__played);
  ok(r2.includes('s05.mp3'), 'plays offline: ' + r2.join(','));
  const off = await page.evaluate(async () => (await fetch('audio/n20.mp3')).ok);
  ok(off, 'clip served offline');
  await b.close();
  process.exit(failed ? 1 : 0);
})();
