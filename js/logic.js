/* Alif game logic: pure functions, no DOM. Works in browser and Node (tests). */
(function (root) {
  'use strict';
  var D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.AlifData;

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInt(rnd, lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }

  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var INDIC = '٠١٢٣٤٥٦٧٨٩';
  // style: 'ar' = Arabic-Indic digits, 'en' = Western digits
  function fmt(n, style) {
    var s = String(n);
    if (style !== 'ar') return s;
    return s.replace(/[0-9]/g, function (d) { return INDIC[+d]; });
  }

  function firstLetter(word) {
    var c = word.charAt(0);
    return (c === 'أ' || c === 'إ' || c === 'آ') ? 'ا' : c;
  }

  // Letters that look alike (same base shape). Used for harder distractors.
  var LOOKALIKE = [['ب', 'ت', 'ث', 'ن', 'ي'], ['ج', 'ح', 'خ'], ['د', 'ذ'], ['ر', 'ز'], ['س', 'ش'], ['ص', 'ض'], ['ط', 'ظ'], ['ع', 'غ'], ['ف', 'ق']];

  function letterIndex(c) {
    for (var i = 0; i < D.LETTERS.length; i++) if (D.LETTERS[i].c === c) return i;
    return -1;
  }

  // Pick a target letter, favouring ones the child knows least. mastery: {char: {s: 0..5}}
  function pickTarget(rnd, mastery, avoid) {
    var w = D.LETTERS.map(function (L, i) {
      var s = (mastery && mastery[L.c] && mastery[L.c].s) || 0;
      var wt = 6 - Math.min(5, s);
      if (i === avoid) wt = 0;
      return wt;
    });
    var tot = w.reduce(function (a, b) { return a + b; }, 0);
    var r = rnd() * tot;
    for (var i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; }
    return 0;
  }

  function letterChoices(rnd, targetIdx, level) {
    var t = D.LETTERS[targetIdx].c;
    var pool = [];
    if (level >= 2) {
      LOOKALIKE.forEach(function (g) { if (g.indexOf(t) >= 0) g.forEach(function (c) { if (c !== t) pool.push(letterIndex(c)); }); });
    }
    pool = shuffle(pool, rnd);
    var others = shuffle(D.LETTERS.map(function (_, i) { return i; }).filter(function (i) { return i !== targetIdx && pool.indexOf(i) < 0; }), rnd);
    var picks = pool.slice(0, 2).concat(others).slice(0, 3);
    return shuffle([targetIdx].concat(picks), rnd);
  }

  // mode: 'word' (see word+picture, pick letter) or 'picture' (see letter, pick picture)
  function letterQuestion(rnd, opts) {
    opts = opts || {};
    var target = pickTarget(rnd, opts.mastery, opts.avoid);
    var mode = opts.mode || (rnd() < 0.5 ? 'word' : 'picture');
    return { kind: 'letter', mode: mode, target: target, choices: letterChoices(rnd, target, opts.level || 1), answer: target, id: D.LETTERS[target].c };
  }

  function numberChoices(rnd, answer, lo, hi) {
    var set = {}; set[answer] = 1;
    var out = [answer];
    var guard = 0;
    while (out.length < 4 && guard++ < 200) {
      var d = randInt(rnd, 1, 3) * (rnd() < 0.5 ? -1 : 1);
      var v = answer + d;
      if (v < lo || v > hi || set[v]) {
        v = randInt(rnd, lo, hi);
        if (set[v]) continue;
      }
      set[v] = 1; out.push(v);
    }
    // tiny ranges: fill sequentially
    for (var k = lo; out.length < 4 && k <= hi + 10; k++) if (!set[k]) { set[k] = 1; out.push(k); }
    return shuffle(out, rnd);
  }

  function countQuestion(rnd, level) {
    var max = level === 1 ? 5 : level === 2 ? 10 : 20;
    var n = randInt(rnd, 1, max);
    var emoji = D.COUNTABLES[randInt(rnd, 0, D.COUNTABLES.length - 1)];
    return { kind: 'count', n: n, emoji: emoji, answer: n, choices: numberChoices(rnd, n, 1, max + 2), id: 'count' + level };
  }

  function seqQuestion(rnd, level) {
    var step, start, dir = 1, len = 5;
    if (level === 1) { step = 1; start = randInt(rnd, 0, 5); }
    else if (level === 2) { step = [1, 2, 5, 10][randInt(rnd, 0, 3)]; start = randInt(rnd, 0, 4) * step; }
    else { step = [2, 3, 5, 10, 4][randInt(rnd, 0, 4)]; start = randInt(rnd, 1, 6) * step; dir = rnd() < 0.5 ? 1 : -1; if (dir < 0) start += step * (len - 1); }
    var seq = [];
    for (var i = 0; i < len; i++) seq.push(start + dir * step * i);
    var hole = randInt(rnd, 1, len - 2 + (level === 1 ? 1 : 0));
    var answer = seq[hole];
    var lo = Math.max(0, answer - 2 * step - 2), hi = answer + 2 * step + 2;
    var set = {}; set[answer] = 1; var ch = [answer], g = 0;
    while (ch.length < 4 && g++ < 200) {
      var v = answer + randInt(rnd, 1, 3) * (rnd() < 0.5 ? -1 : 1) * (rnd() < 0.5 ? 1 : step);
      if (v < lo || v < 0 || set[v] || seq.indexOf(v) >= 0) continue;
      set[v] = 1; ch.push(v);
    }
    for (var k = hi; ch.length < 4 && k < hi + 30; k++) if (!set[k] && seq.indexOf(k) < 0) { set[k] = 1; ch.push(k); }
    return { kind: 'seq', seq: seq, hole: hole, step: step, answer: answer, choices: shuffle(ch, rnd), id: 'seq' + level };
  }

  // op: 'add' | 'sub' | 'mul' | 'mix'
  function mathQuestion(rnd, level, op) {
    var o = op === 'mix' || !op ? ['add', 'sub', 'mul'][randInt(rnd, 0, level === 1 ? 1 : 2)] : op;
    var a, b, ans, sym;
    if (o === 'add') {
      sym = '+';
      var m = level === 1 ? 10 : level === 2 ? 20 : 99;
      a = randInt(rnd, 1, m - 1); b = randInt(rnd, 1, m - a); ans = a + b;
    } else if (o === 'sub') {
      sym = '−';
      var m2 = level === 1 ? 10 : level === 2 ? 20 : 99;
      a = randInt(rnd, 2, m2); b = randInt(rnd, 1, a - 1); ans = a - b;
    } else {
      sym = '×';
      var tables = level === 1 ? [1, 2, 3] : level === 2 ? [2, 3, 4, 5, 10] : [2, 3, 4, 5, 6, 7, 8, 9, 10];
      a = tables[randInt(rnd, 0, tables.length - 1)];
      b = randInt(rnd, 1, level === 1 ? 5 : 10); ans = a * b;
    }
    var q = { kind: 'math', op: o, sym: sym, a: a, b: b, answer: ans, id: 'math-' + o + level };
    if (level >= 3) q.typed = true;
    else q.choices = numberChoices(rnd, ans, 0, Math.max(ans + 4, 12));
    return q;
  }

  function starsFor(correct, total) {
    if (!total) return 0;
    var p = correct / total;
    return p >= 0.9 ? 3 : p >= 0.7 ? 2 : p >= 0.4 ? 1 : 0;
  }

  function updateMastery(m, id, ok) {
    m = m || {};
    var e = m[id] || { a: 0, c: 0, s: 0 };
    e.a += 1; if (ok) e.c += 1;
    e.s = Math.max(0, Math.min(5, e.s + (ok ? 1 : -1)));
    m[id] = e;
    return m;
  }

  function masteryLabel(e) {
    var s = (e && e.s) || 0;
    return s >= 4 ? 'mastered' : s >= 2 ? 'learning' : 'new';
  }

  function letterForms(L) {
    var ZWJ = '\u200D';
    if (!L.join) return { isolated: L.c, initial: L.c, medial: L.c, final: L.c, joins: false };
    return { isolated: L.c, initial: L.c + ZWJ, medial: ZWJ + L.c + ZWJ, final: ZWJ + L.c, joins: true };
  }

  // Parent gate: a multiplication a young child is unlikely to solve
  function gateQuestion(rnd) {
    var a = randInt(rnd, 6, 9), b = randInt(rnd, 6, 9);
    return { a: a, b: b, answer: a * b };
  }

  var api = {
    mulberry32: mulberry32, randInt: randInt, shuffle: shuffle, fmt: fmt, firstLetter: firstLetter,
    letterIndex: letterIndex, pickTarget: pickTarget, letterQuestion: letterQuestion, countQuestion: countQuestion,
    seqQuestion: seqQuestion, mathQuestion: mathQuestion, starsFor: starsFor, updateMastery: updateMastery,
    masteryLabel: masteryLabel, letterForms: letterForms, gateQuestion: gateQuestion, LOOKALIKE: LOOKALIKE
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AlifLogic = api;
})(typeof self !== 'undefined' ? self : this);
