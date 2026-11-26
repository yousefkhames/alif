const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/data.js');
const L = require('../js/logic.js');
const S = require('../js/store.js');

const uniq = (a) => new Set(a).size === a.length;
function mem() { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; }

test('data: 28 letters, each example word starts with its letter', () => {
  assert.strictEqual(D.LETTERS.length, 28);
  assert.ok(uniq(D.LETTERS.map((l) => l.c)));
  D.LETTERS.forEach((l) => assert.strictEqual(L.firstLetter(l.w), l.c, l.w));
  assert.ok(uniq(D.LETTERS.map((l) => l.e)), 'emoji must be unique so picture choices are unambiguous');
  assert.strictEqual(D.NUM_WORDS.ar.length, 21);
  assert.strictEqual(D.NUM_WORDS.en.length, 21);
});

test('data: Arabic and English strings have the same keys', () => {
  assert.deepStrictEqual(Object.keys(D.STR.ar).sort(), Object.keys(D.STR.en).sort());
});

test('fmt: Arabic-Indic and Western digits', () => {
  assert.strictEqual(L.fmt(2026, 'ar'), '٢٠٢٦');
  assert.strictEqual(L.fmt(2026, 'en'), '2026');
  assert.strictEqual(L.fmt(0, 'ar'), '٠');
});

test('rng is deterministic', () => {
  const a = L.mulberry32(7), b = L.mulberry32(7);
  for (let i = 0; i < 20; i++) assert.strictEqual(a(), b());
});

test('letter questions: valid for all levels and modes', () => {
  const r = L.mulberry32(1);
  for (let n = 0; n < 1500; n++) {
    const level = 1 + (n % 3);
    const q = L.letterQuestion(r, { level, mode: n % 2 ? 'word' : 'picture' });
    assert.strictEqual(q.choices.length, 4);
    assert.ok(uniq(q.choices));
    assert.ok(q.choices.includes(q.answer));
    assert.strictEqual(q.id, D.LETTERS[q.answer].c);
  }
});

test('letter questions: level 2 distractors include look-alikes when they exist', () => {
  const r = L.mulberry32(5);
  let hits = 0;
  for (let n = 0; n < 300; n++) {
    const q = L.letterQuestion(r, { level: 2, mode: 'word' });
    const t = D.LETTERS[q.target].c;
    const group = L.LOOKALIKE.find((g) => g.includes(t));
    if (group) {
      const near = q.choices.filter((i) => i !== q.target && group.includes(D.LETTERS[i].c));
      assert.ok(near.length >= 1, t);
      hits++;
    }
  }
  assert.ok(hits > 100);
});

test('pickTarget favours low mastery and avoids the previous letter', () => {
  const r = L.mulberry32(9);
  const mastery = {};
  D.LETTERS.forEach((l) => { mastery[l.c] = { s: 5 }; });
  mastery['ق'] = { s: 0 };
  let q = 0;
  for (let i = 0; i < 400; i++) if (D.LETTERS[L.pickTarget(r, mastery, -1)].c === 'ق') q++;
  assert.ok(q > 50, "weak letter should show up often, got " + q);
  for (let i = 0; i < 200; i++) assert.notStrictEqual(L.pickTarget(r, mastery, 3), 3);
});

test('count questions', () => {
  const r = L.mulberry32(2);
  [[1, 5], [2, 10], [3, 20]].forEach(([lv, max]) => {
    for (let n = 0; n < 400; n++) {
      const q = L.countQuestion(r, lv);
      assert.ok(q.n >= 1 && q.n <= max);
      assert.strictEqual(q.choices.length, 4);
      assert.ok(uniq(q.choices));
      assert.ok(q.choices.includes(q.n));
      assert.ok(q.choices.every((c) => c >= 1));
    }
  });
});

test('sequence questions: arithmetic sequence, unambiguous answer', () => {
  const r = L.mulberry32(3);
  for (let n = 0; n < 1500; n++) {
    const lv = 1 + (n % 3);
    const q = L.seqQuestion(r, lv);
    const d = q.seq[1] - q.seq[0];
    for (let i = 1; i < q.seq.length; i++) assert.strictEqual(q.seq[i] - q.seq[i - 1], d);
    assert.strictEqual(q.answer, q.seq[q.hole]);
    assert.ok(q.seq.every((v) => v >= 0), JSON.stringify(q));
    assert.strictEqual(q.choices.length, 4);
    assert.ok(uniq(q.choices));
    assert.ok(q.choices.includes(q.answer));
    q.choices.forEach((c) => { if (c !== q.answer) assert.ok(!q.seq.includes(c)); });
  }
});

test('math questions: right answers, no negatives, sane ranges', () => {
  const r = L.mulberry32(4);
  for (let n = 0; n < 3000; n++) {
    const lv = 1 + (n % 3);
    const op = ['add', 'sub', 'mul', 'mix'][n % 4];
    const q = L.mathQuestion(r, lv, op);
    const exp = q.op === 'add' ? q.a + q.b : q.op === 'sub' ? q.a - q.b : q.a * q.b;
    assert.strictEqual(q.answer, exp);
    assert.ok(q.answer >= 0);
    if (op !== 'mix') assert.strictEqual(q.op, op);
    if (lv === 1 && q.op !== 'mul') assert.ok(q.a <= 10 && q.answer <= 10);
    if (lv === 1) assert.ok(q.op !== 'mul' || q.a * q.b <= 15);
    if (lv >= 3) { assert.ok(q.typed); assert.ok(!q.choices); }
    else { assert.strictEqual(q.choices.length, 4); assert.ok(uniq(q.choices)); assert.ok(q.choices.includes(q.answer)); }
  }
});

test('starsFor thresholds', () => {
  assert.strictEqual(L.starsFor(10, 10), 3);
  assert.strictEqual(L.starsFor(9, 10), 3);
  assert.strictEqual(L.starsFor(8, 10), 2);
  assert.strictEqual(L.starsFor(7, 10), 2);
  assert.strictEqual(L.starsFor(4, 10), 1);
  assert.strictEqual(L.starsFor(3, 10), 0);
  assert.strictEqual(L.starsFor(0, 0), 0);
});

test('mastery stays within 0..5 and labels', () => {
  let m = {};
  for (let i = 0; i < 10; i++) m = L.updateMastery(m, 'ب', true);
  assert.strictEqual(m['ب'].s, 5);
  assert.strictEqual(L.masteryLabel(m['ب']), 'mastered');
  for (let i = 0; i < 10; i++) m = L.updateMastery(m, 'ب', false);
  assert.strictEqual(m['ب'].s, 0);
  assert.strictEqual(m['ب'].a, 20);
  assert.strictEqual(m['ب'].c, 10);
  assert.strictEqual(L.masteryLabel(undefined), 'new');
  assert.strictEqual(L.masteryLabel({ s: 2 }), 'learning');
});

test('letter forms: joining and non-joining letters', () => {
  const ba = L.letterForms(D.LETTERS[1]);
  assert.ok(ba.joins); assert.strictEqual(ba.initial, 'ب\u200D'); assert.strictEqual(ba.final, '\u200Dب'); assert.strictEqual(ba.medial, '\u200Dب\u200D');
  const alif = L.letterForms(D.LETTERS[0]);
  assert.ok(!alif.joins);
  const nonJoin = D.LETTERS.filter((l) => !l.join).map((l) => l.c).sort();
  assert.deepStrictEqual(nonJoin, ['ا', 'د', 'ذ', 'ر', 'ز', 'و'].sort());
});

test('gate question is a 6..9 times table', () => {
  const r = L.mulberry32(11);
  for (let i = 0; i < 100; i++) { const g = L.gateQuestion(r); assert.ok(g.a >= 6 && g.b <= 9); assert.strictEqual(g.answer, g.a * g.b); }
});

test('store: add, limit, edit, select, remove', () => {
  const s = S.makeStore(mem());
  assert.strictEqual(s.kid(), null);
  assert.strictEqual(s.addKid('   '), null);
  const a = s.addKid('ليلى', '🦊');
  assert.strictEqual(s.kid().name, 'ليلى');
  for (let i = 0; i < 5; i++) assert.ok(s.addKid('k' + i));
  assert.strictEqual(s.addKid('seventh'), null);
  assert.strictEqual(s.data.kids.length, 6);
  assert.ok(s.editKid(a.id, 'سلمى', '🐬'));
  assert.strictEqual(s.data.kids[0].name, 'سلمى');
  s.select(a.id); s.removeKid(a.id);
  assert.notStrictEqual(s.data.current, a.id);
  assert.strictEqual(s.data.kids.length, 5);
});

test('store: names are trimmed and capped at 16 chars', () => {
  const s = S.makeStore(mem());
  const k = s.addKid('  ' + 'x'.repeat(40) + '  ');
  assert.strictEqual(k.name.length, 16);
});

test('store: persists across instances and records best scores', () => {
  const m = mem();
  const s = S.makeStore(m);
  s.addKid('Sam');
  s.recordRound('math-1-add', 2, 8, 10);
  s.recordRound('math-1-add', 3, 6, 10);   // lower score: keep best
  s.recordRound('math-1-add', 3, 10, 10);
  const s2 = S.makeStore(m);
  const k = s2.kid();
  assert.strictEqual(k.name, 'Sam');
  assert.strictEqual(k.rounds, 3);
  assert.strictEqual(k.stars, 8);
  assert.deepStrictEqual(k.best['math-1-add'], { score: 10, total: 10, stars: 3 });
});

test('store: export then import round-trips, bad input is rejected', () => {
  const s = S.makeStore(mem());
  s.addKid('Nour', '🐢'); s.recordRound('count-1', 3, 10, 10);
  const json = s.exportJSON();
  const t = S.makeStore(mem());
  assert.strictEqual(t.importJSON(json), 1);
  assert.strictEqual(t.kid().stars, 3);
  assert.throws(() => t.importJSON('not json'));
  assert.throws(() => t.importJSON('{"kids": 5}'));
  assert.throws(() => t.importJSON('null'));
  assert.strictEqual(t.data.kids.length, 1, 'failed import must not wipe data');
});

test('store: sanitize drops junk and clamps values', () => {
  const d = S.sanitize({ settings: { lang: 'fr', sound: 0 }, kids: [{ name: 'a', stars: -5, rounds: 'x' }, { name: '   ' }, null, { nope: 1 }], current: 'zzz' });
  assert.strictEqual(d.settings.lang, 'ar');
  assert.strictEqual(d.kids.length, 1);
  assert.strictEqual(d.kids[0].stars, 0);
  assert.strictEqual(d.kids[0].rounds, 0);
  assert.strictEqual(d.current, d.kids[0].id);
  assert.strictEqual(S.sanitize(null).kids.length, 0);
});

test('store: survives storage that throws (private mode)', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const s = S.makeStore(bad);
  s.addKid('Omar');
  assert.strictEqual(s.kid().name, 'Omar');
  assert.strictEqual(s.isPersistent(), false);
});

test('store: reset clears everything', () => {
  const m = mem(); const s = S.makeStore(m);
  s.addKid('A'); s.reset();
  assert.strictEqual(S.makeStore(m).data.kids.length, 0);
});
