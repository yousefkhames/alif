/* Generates README screenshots from clean sample data. Usage: node scripts/shots.js [lang] */
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8123/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const letters = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.split('');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--lang=ar'] });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mastery = {}; letters.forEach((c, i) => { if (i < 9) mastery[c] = { a: 8, c: 7, s: 5 }; else if (i < 15) mastery[c] = { a: 4, c: 3, s: 3 }; });
  const seen = {}; letters.slice(0, 12).forEach((c) => { seen[c] = true; });
  const data = { v: 1, settings: { lang: 'ar', digits: 'ar', digitsTouched: false, sound: true, speech: true }, current: 'k1',
    kids: [{ id: 'k1', name: 'ليلى', avatar: '🦊', stars: 27, rounds: 11, mastery, seen,
      best: { 'letters-1': { score: 10, total: 10, stars: 3 }, 'letters-2': { score: 8, total: 10, stars: 2 }, 'count-1': { score: 10, total: 10, stars: 3 }, 'seq-1': { score: 9, total: 10, stars: 3 }, 'math-1-add': { score: 7, total: 10, stars: 2 } } }] };
  await p.evaluateOnNewDocument((d) => { if (!localStorage.getItem('alif.v1') && !sessionStorage.getItem('seeded')) { localStorage.setItem('alif.v1', JSON.stringify(d)); sessionStorage.setItem('seeded', '1'); } }, data);
  const shot = async (name, hash, setup) => { await p.goto(BASE + hash); await sleep(500); if (setup) await setup(); await p.screenshot({ path: `docs/${name}.png` }); };
  await shot('home', '#/');
  await shot('letter', '#/learn/17');
  await shot('learn', '#/learn');
  await shot('hunt', '#/g/letters', async () => { await p.click('.segbtn[data-level="2"]'); await p.click('#startBtn'); await sleep(500); });
  await shot('count', '#/g/count', async () => { await p.click('.segbtn[data-level="2"]'); await p.click('#startBtn'); await sleep(900); });
  await shot('seq', '#/g/seq', async () => { await p.click('.segbtn[data-level="2"]'); await p.click('#startBtn'); await sleep(500); });
  await shot('math', '#/g/math', async () => { await p.click('.segbtn[data-level="3"]'); await p.click('.segbtn[data-op="mul"]'); await p.click('#startBtn'); await sleep(500); });
  await shot('numbers', '#/numbers', async () => { await p.click('.ntile[data-n="12"]'); await sleep(300); });
  await shot('stars', '#/stars');
  await p.goto(BASE + '#/'); await sleep(200); await p.click('#langBtn'); await sleep(400); await p.screenshot({ path: 'docs/home-en.png' });
  await b.close();
})();
