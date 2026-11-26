/* Alif UI. Vanilla JS, no dependencies, no network. */
(function () {
  'use strict';
  var D = window.AlifData, L = window.AlifLogic, S = window.AlifStore;
  var store = S.makeStore((function () { try { return window.localStorage; } catch (e) { return { getItem: function () { throw e; }, setItem: function () { throw e; } }; } })());
  var app = document.getElementById('app');
  var timers = [];
  var R = null;            // current round
  var backupNote = '';
  var parentOpen = false;  // parent gate passed this session
  var voiceState = 'unknown'; // unknown | ok | none

  /* ---------- helpers ---------- */
  function st() { return store.data.settings; }
  function t(k) { return D.STR[st().lang][k]; }
  function num(n) { return L.fmt(n, st().digits); }
  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === undefined || c === null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(el, x); });
    else if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(String(c)));
    else el.appendChild(c);
  }
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  var rnd = Math.random;
  function icon(name) {
    var p = {
      back: 'M9 5l7 7-7 7', gear: 'M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm8 3.5l-1.9-.7a6.7 6.7 0 00-.6-1.4l.9-1.8-1.7-1.7-1.8.9a6.7 6.7 0 00-1.4-.6L12.8 4h-2.4l-.7 1.9a6.7 6.7 0 00-1.4.6l-1.8-.9-1.7 1.7.9 1.8c-.3.4-.5.9-.6 1.4L3 12v0l1.9.7c.1.5.3 1 .6 1.4l-.9 1.8 1.7 1.7 1.8-.9c.4.3.9.5 1.4.6l.7 1.9h2.4l.7-1.9c.5-.1 1-.3 1.4-.6l1.8.9 1.7-1.7-.9-1.8c.3-.4.5-.9.6-1.4z',
      speaker: 'M4 9v6h4l5 4V5L8 9H4zm12 0a4 4 0 010 6m2.5-9a8 8 0 010 12'
    }[name];
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '24'); s.setAttribute('height', '24');
    s.setAttribute('class', 'ic ic-' + name); s.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', p); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2.4'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
    s.appendChild(path); return s;
  }

  /* ---------- sound & speech ---------- */
  var ac = null;
  function audio() {
    if (!st().sound) return null;
    try {
      if (!ac) { var C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); }
      if (ac && ac.state === 'suspended') ac.resume();
    } catch (e) { ac = null; }
    return ac;
  }
  function tone(f, at, dur, type, gain) {
    var c = audio(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'triangle'; o.frequency.value = f;
    var t0 = c.currentTime + at;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  var sfx = {
    ok: function () { tone(523, 0, 0.14); tone(659, 0.09, 0.14); tone(784, 0.18, 0.22); },
    bad: function () { tone(196, 0, 0.22, 'sine', 0.16); tone(165, 0.12, 0.26, 'sine', 0.14); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.12, 0.28); }); },
    tap: function () { tone(660, 0, 0.06, 'sine', 0.08); }
  };
  function arabicVoice() {
    if (!('speechSynthesis' in window)) return null;
    var vs = window.speechSynthesis.getVoices() || [];
    for (var i = 0; i < vs.length; i++) if (/^ar/i.test(vs[i].lang)) return vs[i];
    return null;
  }
  function refreshVoices() {
    if (!('speechSynthesis' in window)) { voiceState = 'none'; return; }
    var vs = window.speechSynthesis.getVoices();
    if (vs && vs.length) voiceState = arabicVoice() ? 'ok' : 'none';
  }
  function speak(text) {
    if (!st().speech || !('speechSynthesis' in window)) return false;
    refreshVoices();
    var v = arabicVoice();
    if (!v) return false;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.voice = v; u.lang = v.lang; u.rate = 0.8;
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }
  if ('speechSynthesis' in window) {
    refreshVoices();
    try { window.speechSynthesis.onvoiceschanged = refreshVoices; } catch (e) { /* ignore */ }
  }

  /* ---------- language ---------- */
  function applyLang() {
    var l = st().lang;
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.title = l === 'ar' ? 'ألف | Alif' : 'Alif | ألف';
  }
  function setLang(l) {
    store.setSetting('lang', l);
    if (!st().digitsTouched) store.data.settings.digits = l === 'ar' ? 'ar' : 'en';
    store.setSetting('lang', l);
    applyLang(); route();
  }

  /* ---------- shared UI pieces ---------- */
  function logo(size) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 64 64'); s.setAttribute('width', size); s.setAttribute('height', size);
    s.setAttribute('role', 'img'); s.setAttribute('aria-label', 'Alif');
    s.innerHTML = '<rect x="3" y="3" width="58" height="58" rx="16" fill="#0E7C7B" stroke="#19323A" stroke-width="3"/>' +
      '<rect x="28" y="12" width="9" height="34" rx="4.5" fill="#F7EFE0"/><circle cx="32.5" cy="53" r="4.6" fill="#F4A300"/>';
    return s;
  }
  function topbar(titleText, backHash, right) {
    return h('header', { class: 'bar' },
      h('button', { class: 'iconbtn', 'aria-label': t('back'), onclick: function () { sfx.tap(); go(backHash || '#/'); } }, icon('back')),
      h('h1', { class: 'bar-title', text: titleText }),
      right || h('span', { class: 'bar-spacer' }));
  }
  function kidChip() {
    var k = store.kid();
    return h('button', { class: 'chip', onclick: function () { go('#/who'); }, 'aria-label': t('switchKid') },
      h('span', { class: 'chip-av', 'aria-hidden': 'true', text: k ? k.avatar : '🙂' }), h('span', { class: 'chip-name', text: k ? k.name : '' }));
  }
  function mount(node) { app.innerHTML = ''; app.appendChild(node); window.scrollTo(0, 0); }
  function stars(n, total) {
    var w = h('span', { class: 'stars', 'aria-label': n + '/' + total });
    for (var i = 0; i < total; i++) w.appendChild(h('span', { class: 'star' + (i < n ? ' on' : ''), text: '★' }));
    return w;
  }

  /* ---------- views ---------- */
  var GAMES = [
    { id: 'learn', hash: '#/learn', c: 'c-teal', glyph: 'أ', t: 'learnLetters', d: 'learnLettersD' },
    { id: 'numbers', hash: '#/numbers', c: 'c-leaf', glyph: '١٢٣', t: 'learnNumbers', d: 'learnNumbersD' },
    { id: 'letters', hash: '#/g/letters', c: 'c-saffron', glyph: '🔎', t: 'letterHunt', d: 'letterHuntD' },
    { id: 'count', hash: '#/g/count', c: 'c-coral', glyph: '🍎', t: 'counting', d: 'countingD' },
    { id: 'seq', hash: '#/g/seq', c: 'c-plum', glyph: '٢ ؟ ٤', t: 'sequence', d: 'sequenceD' },
    { id: 'math', hash: '#/g/math', c: 'c-sky', glyph: '+ − ×', t: 'math', d: 'mathD' }
  ];

  function viewHome() {
    var k = store.kid();
    var other = st().lang === 'ar' ? 'EN' : 'عربي';
    var cards = GAMES.map(function (g) {
      return h('a', { class: 'card ' + g.c, href: g.hash, 'data-game': g.id, onclick: function () { sfx.tap(); } },
        h('span', { class: 'card-glyph', 'aria-hidden': 'true', text: g.glyph }),
        h('span', { class: 'card-text' }, h('span', { class: 'card-title', text: t(g.t) }), h('span', { class: 'card-desc', text: t(g.d) })));
    });
    cards.push(h('a', { class: 'card c-ink wide', href: '#/stars', 'data-game': 'stars' },
      h('span', { class: 'card-glyph', 'aria-hidden': 'true', text: '★' }),
      h('span', { class: 'card-text' }, h('span', { class: 'card-title', text: t('progress') }),
        h('span', { class: 'card-desc', text: t('totalStars') + ': ' + num(k ? k.stars : 0) }))));
    mount(h('div', { class: 'screen home' },
      h('header', { class: 'bar home-bar' }, kidChip(),
        h('span', { class: 'bar-actions' },
          h('button', { class: 'pill', id: 'langBtn', onclick: function () { setLang(st().lang === 'ar' ? 'en' : 'ar'); }, text: other, 'aria-label': t('language') }),
          h('a', { class: 'iconbtn', href: '#/parents', 'aria-label': t('parents'), id: 'parentsBtn' }, icon('gear')))),
      h('section', { class: 'hero' }, logo(88),
        h('h1', { class: 'brand', text: t('appName') }), h('p', { class: 'tagline', text: t('tagline') })),
      h('nav', { class: 'cards', 'aria-label': t('play') }, cards),
      h('p', { class: 'foot', text: t('installHint') })));
  }

  function viewWho() {
    var editing = null;
    var wrap = h('div', { class: 'screen who' });
    function draw() {
      wrap.innerHTML = '';
      wrap.appendChild(topbar(t('whoPlays'), store.kid() ? '#/' : '#/who'));
      var list = h('div', { class: 'kids' });
      store.data.kids.forEach(function (k) {
        list.appendChild(h('button', { class: 'kid' + (k.id === store.data.current ? ' cur' : ''), 'data-kid': k.name, onclick: function () { store.select(k.id); go('#/'); } },
          h('span', { class: 'kid-av', 'aria-hidden': 'true', text: k.avatar }), h('span', { class: 'kid-name', text: k.name }),
          h('span', { class: 'kid-stars', text: '★ ' + num(k.stars) })));
      });
      wrap.appendChild(list);
      if (!store.data.kids.length) wrap.appendChild(h('p', { class: 'muted', text: t('empty') }));
      if (store.data.kids.length < S.MAX_KIDS) wrap.appendChild(kidForm(null, function () { draw(); }));
      else wrap.appendChild(h('p', { class: 'muted', text: t('maxKids') }));
    }
    draw(); mount(wrap);
  }

  function kidForm(kid, done) {
    var avatar = kid ? kid.avatar : D.AVATARS[store.data.kids.length % D.AVATARS.length];
    var input = h('input', { type: 'text', id: 'kidName', maxlength: '16', placeholder: t('kidName'), value: kid ? kid.name : '', autocomplete: 'off', 'aria-label': t('kidName') });
    var avs = h('div', { class: 'avatars', role: 'radiogroup' });
    function drawAv() {
      avs.innerHTML = '';
      D.AVATARS.forEach(function (a) {
        avs.appendChild(h('button', { type: 'button', class: 'av' + (a === avatar ? ' on' : ''), role: 'radio', 'aria-checked': a === avatar ? 'true' : 'false', text: a,
          onclick: function () { avatar = a; drawAv(); } }));
      });
    }
    drawAv();
    function submit() {
      var name = input.value.trim();
      if (!name) { input.classList.add('bad'); input.focus(); return; }
      if (kid) store.editKid(kid.id, name, avatar); else store.addKid(name, avatar);
      if (done) done(); if (!kid) go('#/');
    }
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    return h('form', { class: 'kidform', onsubmit: function (e) { e.preventDefault(); submit(); } },
      h('label', { class: 'lbl', for: 'kidName', text: kid ? t('rename') : t('addKid') }), input, avs,
      h('button', { type: 'submit', class: 'btn primary', id: 'saveKid', text: t('save') }));
  }

  /* ----- learn letters ----- */
  function viewLearn() {
    var k = store.kid();
    var grid = h('div', { class: 'lgrid' });
    D.LETTERS.forEach(function (Lt, i) {
      var seen = k && k.seen[Lt.c];
      grid.appendChild(h('a', { class: 'ltile' + (seen ? ' seen' : ''), href: '#/learn/' + i, 'data-letter': Lt.c, 'aria-label': Lt.ar },
        h('span', { class: 'lt-glyph', text: Lt.c }), h('span', { class: 'lt-name', text: st().lang === 'ar' ? Lt.ar : Lt.en }),
        seen ? h('span', { class: 'lt-check', text: '✓', 'aria-hidden': 'true' }) : null));
    });
    var done = k ? Object.keys(k.seen).length : 0;
    mount(h('div', { class: 'screen' }, topbar(t('learnLetters'), '#/', h('span', { class: 'count-pill', text: num(done) + '/' + num(28) })),
      h('p', { class: 'hint', text: t('learnLettersD') }), grid));
  }

  function viewLetter(i) {
    i = Math.max(0, Math.min(27, i | 0));
    var Lt = D.LETTERS[i], F = L.letterForms(Lt), k = store.kid();
    var rtl = st().lang === 'ar';
    function forms() {
      var w = h('div', { class: 'forms', dir: 'rtl' });
      [['isolated', F.isolated], ['initial', F.initial], ['medial', F.medial], ['final', F.final]].forEach(function (p) {
        if (!F.joins && p[0] !== 'isolated') return;
        w.appendChild(h('div', { class: 'form' }, h('span', { class: 'form-glyph', text: p[1] }), h('span', { class: 'form-name', text: t(p[0]) })));
      });
      return w;
    }
    var note = h('p', { class: 'note', id: 'voiceNote', role: 'status' });
    function say(txt) {
      sfx.tap();
      var ok = speak(txt);
      if (!ok && st().speech) { note.textContent = t('noVoice'); } else note.textContent = '';
    }
    var seenBtn = h('button', { class: 'btn ' + (k && k.seen[Lt.c] ? 'ghost' : 'primary'), id: 'learnedBtn', onclick: function () {
      if (!k) return; k.seen[Lt.c] = true; k.mastery = L.updateMastery(k.mastery, Lt.c, true); store.saveKid(); sfx.ok(); route();
    }, text: (k && k.seen[Lt.c] ? '✓ ' : '') + t('learned') });
    var prev = i > 0 ? '#/learn/' + (i - 1) : null, nextH = i < 27 ? '#/learn/' + (i + 1) : null;
    mount(h('div', { class: 'screen letter' }, topbar(st().lang === 'ar' ? Lt.ar : Lt.en, '#/learn', h('span', { class: 'count-pill', text: num(i + 1) + '/' + num(28) })),
      h('section', { class: 'bigcard' },
        h('div', { class: 'big-glyph', text: Lt.c, 'aria-label': Lt.ar }),
        h('div', { class: 'names' }, h('span', { class: 'n-ar', text: Lt.ar }), h('span', { class: 'n-en', text: Lt.en })),
        h('button', { class: 'btn speak', id: 'sayLetter', onclick: function () { say(Lt.ar); } }, icon('speaker'), h('span', { text: t('listen') }))),
      forms(),
      h('section', { class: 'example' }, h('span', { class: 'ex-emoji', text: Lt.e, 'aria-hidden': 'true' }),
        h('span', { class: 'ex-text' }, h('span', { class: 'lbl', text: t('exampleWord') }),
          h('span', { class: 'ex-word', text: Lt.w }), st().lang === 'en' ? h('span', { class: 'ex-en', text: Lt.wen }) : null),
        h('button', { class: 'iconbtn', 'aria-label': t('listen'), onclick: function () { say(Lt.w); } }, icon('speaker'))),
      note, seenBtn,
      h('nav', { class: 'pager' },
        h('a', { class: 'btn ghost' + (prev ? '' : ' off'), href: prev || '#/learn/' + i, id: 'prevL', 'aria-label': rtl ? t('next') : t('back'), text: rtl ? '›' : '‹' }),
        h('a', { class: 'btn ghost' + (nextH ? '' : ' off'), href: nextH || '#/learn/' + i, id: 'nextL', 'aria-label': rtl ? t('back') : t('next'), text: rtl ? '‹' : '›' }))));
  }

  /* ----- learn numbers ----- */
  function viewNumbers() {
    var sel = 0;
    var wrap = h('div', { class: 'screen numbers c-leaf' });
    function draw() {
      wrap.innerHTML = '';
      wrap.appendChild(topbar(t('learnNumbers'), '#/'));
      var dots = h('div', { class: 'dots', 'aria-hidden': 'true' });
      for (var g = 0; g < sel; g++) dots.appendChild(h('span', { class: 'dot5' + (g % 5 === 4 ? ' gap' : '') }));
      wrap.appendChild(h('section', { class: 'bigcard numcard' },
        h('div', { class: 'big-num', id: 'bigNum', text: num(sel) }),
        h('div', { class: 'names' }, h('span', { class: 'n-ar', text: D.NUM_WORDS.ar[sel] }), h('span', { class: 'n-en', text: D.NUM_WORDS.en[sel] })),
        dots,
        h('button', { class: 'btn speak', id: 'sayNum', onclick: function () { sfx.tap(); speak(D.NUM_WORDS.ar[sel]); } }, icon('speaker'), h('span', { text: t('listen') }))));
      var grid = h('div', { class: 'ngrid' });
      for (var i = 0; i <= 20; i++) (function (n) {
        grid.appendChild(h('button', { class: 'ntile' + (n === sel ? ' on' : ''), 'data-n': String(n), 'aria-label': D.NUM_WORDS[st().lang][n], onclick: function () { sel = n; sfx.tap(); speak(D.NUM_WORDS.ar[n]); draw(); } },
          h('span', { class: 'nt-num', text: num(n) }), h('span', { class: 'nt-word', text: D.NUM_WORDS[st().lang][n] })));
      })(i);
      wrap.appendChild(grid);
    }
    draw(); mount(wrap);
  }

  /* ----- game setup ----- */
  var GAME_META = {
    letters: { t: 'letterHunt', c: 'c-saffron' }, count: { t: 'counting', c: 'c-coral' },
    seq: { t: 'sequence', c: 'c-plum' }, math: { t: 'math', c: 'c-sky' }
  };
  var lastSetup = {};

  function viewSetup(game) {
    var meta = GAME_META[game]; if (!meta) return go('#/');
    var sel = lastSetup[game] || { level: 1, op: 'add' };
    var wrap = h('div', { class: 'screen setup ' + meta.c });
    function draw() {
      wrap.innerHTML = '';
      wrap.appendChild(topbar(t(meta.t), '#/'));
      var lv = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('level') });
      [1, 2, 3].forEach(function (n) {
        lv.appendChild(h('button', { class: 'segbtn' + (sel.level === n ? ' on' : ''), role: 'radio', 'aria-checked': sel.level === n ? 'true' : 'false', 'data-level': n,
          onclick: function () { sel.level = n; sfx.tap(); draw(); } }, h('span', { class: 'seg-n', text: num(n) }), h('span', { text: t('level' + n) })));
      });
      wrap.appendChild(h('p', { class: 'lbl', text: t('level') })); wrap.appendChild(lv);
      if (game === 'math') {
        var ops = h('div', { class: 'seg four', role: 'radiogroup' });
        [['add', '+'], ['sub', '−'], ['mul', '×'], ['mix', '±']].forEach(function (o) {
          ops.appendChild(h('button', { class: 'segbtn' + (sel.op === o[0] ? ' on' : ''), role: 'radio', 'aria-checked': sel.op === o[0] ? 'true' : 'false', 'data-op': o[0],
            onclick: function () { sel.op = o[0]; sfx.tap(); draw(); } }, h('span', { class: 'seg-n', text: o[1] }), h('span', { text: t(o[0]) })));
        });
        wrap.appendChild(ops);
      }
      var key = game + '-' + sel.level + (game === 'math' ? '-' + sel.op : '');
      var k = store.kid(), b = k && k.best[key];
      if (b) wrap.appendChild(h('p', { class: 'muted', text: t('gameBest') + ': ' + num(b.score) + '/' + num(b.total) + '  ' + '★'.repeat(b.stars) }));
      wrap.appendChild(h('button', { class: 'btn primary big', id: 'startBtn', onclick: function () { lastSetup[game] = sel; startRound(game, sel.level, sel.op); }, text: t('play') }));
    }
    draw(); mount(wrap);
  }

  /* ----- rounds ----- */
  var ROUND_LEN = 10;
  function startRound(game, level, op) {
    var k = store.kid();
    var qs = [], usedLetters = {}, prev = -1;
    for (var i = 0; i < ROUND_LEN; i++) {
      var q, g = 0;
      do {
        if (game === 'letters') q = L.letterQuestion(rnd, { level: level, mastery: k && k.mastery, avoid: prev, mode: level === 3 ? 'word' : null });
        else if (game === 'count') q = L.countQuestion(rnd, level);
        else if (game === 'seq') q = L.seqQuestion(rnd, level);
        else q = L.mathQuestion(rnd, level, op);
        g++;
      } while (g < 30 && ((game === 'letters' && usedLetters[q.id]) || (i > 0 && qs[i - 1].answer === q.answer && game !== 'letters' && qs[i - 1].id === q.id)));
      if (game === 'letters') { usedLetters[q.id] = 1; prev = q.target; }
      qs.push(q);
    }
    R = { game: game, level: level, op: op, qs: qs, i: 0, correct: 0, attempts: 0, streak: 0, best: 0, locked: false, typed: '' };
    go('#/play');
  }

  function viewPlay() {
    if (!R) return go('#/');
    if (R.i >= R.qs.length) return viewResult();
    var q = R.qs[R.i];
    R.attempts = 0; R.locked = false; R.typed = '';
    var meta = GAME_META[R.game];
    var meter = h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(ROUND_LEN), 'aria-valuenow': String(R.i) });
    for (var i = 0; i < ROUND_LEN; i++) meter.appendChild(h('span', { class: 'stroke' + (i < R.i ? ' done' : i === R.i ? ' now' : '') }));
    var fb = h('p', { class: 'feedback', id: 'feedback', role: 'status', 'aria-live': 'polite' });
    var qbox = h('section', { class: 'qbox' });
    var choices = h('div', { class: 'choices' + (q.kind === 'letter' && q.mode === 'picture' ? ' pics' : '') });

    function answer(val, btn) {
      if (R.locked) return;
      var ok = val === q.answer;
      R.attempts++;
      if (ok) {
        R.locked = true;
        var first = R.attempts === 1;
        if (first) { R.correct++; R.streak++; R.best = Math.max(R.best, R.streak); }
        if (q.kind === 'letter') { var kd = store.kid(); if (kd) { kd.mastery = L.updateMastery(kd.mastery, q.id, first); store.saveKid(); } }
        if (btn) btn.classList.add('right');
        fb.textContent = pick(t('correct')); fb.className = 'feedback good';
        sfx.ok();
        later(function () { R.i++; route(); }, 1100);
      } else {
        sfx.bad();
        if (btn) { btn.classList.add('wrong'); btn.disabled = true; }
        if (R.attempts >= 2) {
          R.locked = true; R.streak = 0;
          if (q.kind === 'letter') { var kd2 = store.kid(); if (kd2) { kd2.mastery = L.updateMastery(kd2.mastery, q.id, false); store.saveKid(); } }
          fb.textContent = t('itIs') + ': ' + (q.kind === 'letter' ? (q.mode === 'word' ? D.LETTERS[q.answer].c : D.LETTERS[q.answer].e) : num(q.answer)); fb.className = 'feedback info';
          Array.prototype.forEach.call(choices.querySelectorAll('button'), function (b) { if (b.getAttribute('data-ans') === String(q.answer)) b.classList.add('right'); });
          if (q.typed) { var d = document.getElementById('typedOut'); if (d) d.textContent = num(q.answer); }
          later(function () { R.i++; route(); }, 1900);
        } else {
          fb.textContent = t('wrong'); fb.className = 'feedback bad';
          if (q.typed) { R.typed = ''; var o = document.getElementById('typedOut'); if (o) { o.textContent = '?'; o.classList.add('shake'); later(function () { o.classList.remove('shake'); }, 400); } }
        }
      }
    }

    function choiceBtn(val, label, cls, aria) {
      return h('button', { class: 'choice ' + (cls || ''), 'data-ans': String(val), 'aria-label': aria || null, onclick: function (e) { answer(val, e.currentTarget); } }, label);
    }

    if (q.kind === 'letter') {
      var Lt = D.LETTERS[q.target];
      if (q.mode === 'word') {
        qbox.appendChild(h('p', { class: 'prompt', text: t('pickLetter') }));
        qbox.appendChild(h('div', { class: 'stim' }, R.level < 3 ? h('span', { class: 'stim-emoji', text: Lt.e, 'aria-hidden': 'true' }) : null,
          h('span', { class: 'stim-word', text: Lt.w }), st().lang === 'en' && R.level < 3 ? h('span', { class: 'ex-en', text: Lt.wen }) : null));
        q.choices.forEach(function (ci) { choices.appendChild(choiceBtn(ci, h('span', { class: 'ch-letter', text: D.LETTERS[ci].c }), 'letterc', D.LETTERS[ci].ar)); });
      } else {
        qbox.appendChild(h('p', { class: 'prompt', text: t('pickPicture') }));
        qbox.appendChild(h('div', { class: 'stim' }, h('span', { class: 'stim-letter', text: Lt.c, 'aria-label': Lt.ar }),
          h('button', { class: 'iconbtn', id: 'sayQ', 'aria-label': t('listen'), onclick: function () { speak(Lt.ar); } }, icon('speaker'))));
        q.choices.forEach(function (ci) { choices.appendChild(choiceBtn(ci, h('span', { class: 'ch-emoji', text: D.LETTERS[ci].e }), 'picc', D.LETTERS[ci].wen)); });
      }
    } else if (q.kind === 'count') {
      qbox.appendChild(h('p', { class: 'prompt', text: t('howMany') }));
      var field = h('div', { class: 'field', 'aria-label': String(q.n) });
      for (var n = 0; n < q.n; n++) field.appendChild(h('span', { class: 'thing', style: 'animation-delay:' + (n * 35) + 'ms', text: q.emoji, 'aria-hidden': 'true' }));
      qbox.appendChild(field);
      q.choices.forEach(function (c) { choices.appendChild(choiceBtn(c, h('span', { class: 'ch-num', text: num(c) }), 'numc')); });
    } else if (q.kind === 'seq') {
      qbox.appendChild(h('p', { class: 'prompt', text: t('missing') }));
      var row = h('div', { class: 'seqrow', dir: 'ltr' });
      q.seq.forEach(function (v, idx) { row.appendChild(h('span', { class: 'seqcell' + (idx === q.hole ? ' hole' : ''), text: idx === q.hole ? '?' : num(v) })); });
      qbox.appendChild(row);
      q.choices.forEach(function (c) { choices.appendChild(choiceBtn(c, h('span', { class: 'ch-num', text: num(c) }), 'numc')); });
    } else {
      qbox.appendChild(h('p', { class: 'prompt', text: t('solve') }));
      qbox.appendChild(h('div', { class: 'eq', dir: 'ltr' }, h('span', { text: num(q.a) }), h('span', { class: 'sym', text: q.sym }), h('span', { text: num(q.b) }), h('span', { class: 'sym', text: '=' }),
        q.typed ? h('span', { class: 'typed', id: 'typedOut', text: '?' }) : h('span', { class: 'typed', text: '?' })));
      if (q.typed) choices = keypad(q, answer);
      else q.choices.forEach(function (c) { choices.appendChild(choiceBtn(c, h('span', { class: 'ch-num', text: num(c) }), 'numc')); });
    }

    mount(h('div', { class: 'screen play ' + meta.c },
      h('header', { class: 'bar' }, h('button', { class: 'iconbtn', 'aria-label': t('home'), onclick: function () { R = null; go('#/g/' + (R ? '' : GAME_FROM_ROUTE())); } }, icon('back')),
        meter, h('span', { class: 'score-pill', 'aria-label': t('score'), text: '★ ' + num(R.correct) })),
      h('p', { class: 'qn', text: t('question') + ' ' + num(R.i + 1) + ' ' + t('of') + ' ' + num(ROUND_LEN) + (R.streak >= 3 ? '  🔥 ' + num(R.streak) : '') }),
      qbox, fb, choices));
    if (q.typed) bindKeys(q, answer);
  }
  var lastGame = 'letters';
  function GAME_FROM_ROUTE() { return lastGame; }

  var keyHandler = null;
  function bindKeys(q, answer) {
    unbindKeys();
    keyHandler = function (e) {
      if (!document.getElementById('typedOut')) return unbindKeys();
      if (/^[0-9]$/.test(e.key)) typeDigit(e.key);
      else if (e.key === 'Backspace') { R.typed = R.typed.slice(0, -1); showTyped(); }
      else if (e.key === 'Enter') submitTyped(q, answer);
    };
    document.addEventListener('keydown', keyHandler);
  }
  function unbindKeys() { if (keyHandler) document.removeEventListener('keydown', keyHandler); keyHandler = null; }
  function showTyped() { var o = document.getElementById('typedOut'); if (o) o.textContent = R.typed ? num(R.typed) : '?'; }
  function typeDigit(d) { if (R.locked) return; if (R.typed.length < 4) { R.typed += d; showTyped(); } }
  function submitTyped(q, answer) { if (R.locked || R.typed === '') return; var v = parseInt(R.typed, 10); answer(v, null); }
  function keypad(q, answer) {
    var pad = h('div', { class: 'keypad', dir: 'ltr' });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(function (d) {
      pad.appendChild(h('button', { class: 'key', 'data-key': d, onclick: function () { typeDigit(d); }, text: num(d) }));
    });
    pad.appendChild(h('button', { class: 'key util', 'data-key': 'clear', onclick: function () { if (!R.locked) { R.typed = ''; showTyped(); } }, text: '⌫', 'aria-label': t('clear') }));
    pad.appendChild(h('button', { class: 'key', 'data-key': '0', onclick: function () { typeDigit('0'); }, text: num(0) }));
    pad.appendChild(h('button', { class: 'key ok', id: 'keyOk', 'data-key': 'ok', onclick: function () { submitTyped(q, answer); }, text: '✓', 'aria-label': t('keypadOk') }));
    return pad;
  }

  function viewResult() {
    unbindKeys();
    var s = L.starsFor(R.correct, ROUND_LEN);
    var key = R.game + '-' + R.level + (R.game === 'math' ? '-' + R.op : '');
    if (!R.saved) { store.recordRound(key, s, R.correct, ROUND_LEN); R.saved = true; }
    if (s > 0) { sfx.win(); } 
    var again = { game: R.game, level: R.level, op: R.op };
    var big = h('div', { class: 'bigstars', 'aria-label': s + '/3' });
    for (var i = 0; i < 3; i++) big.appendChild(h('span', { class: 'bstar' + (i < s ? ' on' : ''), style: 'animation-delay:' + (i * 220) + 'ms', text: '★' }));
    mount(h('div', { class: 'screen result ' + GAME_META[R.game].c },
      h('h1', { class: 'bar-title center', text: t('roundDone') }), big,
      h('p', { class: 'resultscore', text: t('score') + ': ' + num(R.correct) + ' / ' + num(ROUND_LEN) }),
      R.best >= 3 ? h('p', { class: 'muted', text: t('streak') + ': 🔥 ' + num(R.best) }) : null,
      h('div', { class: 'stack' },
        h('button', { class: 'btn primary big', id: 'againBtn', onclick: function () { startRound(again.game, again.level, again.op); }, text: t('again') }),
        h('a', { class: 'btn ghost', href: '#/', id: 'homeBtn', text: t('home') }))));
  }

  /* ----- progress ----- */
  function viewStars() {
    var k = store.kid();
    if (!k) return go('#/who');
    var names = { letters: 'letterHunt', count: 'counting', seq: 'sequence', math: 'math' };
    var best = h('div', { class: 'bests' });
    var keys = Object.keys(k.best).sort();
    keys.forEach(function (key) {
      var p = key.split('-'), b = k.best[key];
      if (!names[p[0]]) return;
      var label = t(names[p[0]]) + ' · ' + t('level' + p[1]) + (p[2] ? ' · ' + t(p[2]) : '');
      best.appendChild(h('div', { class: 'bestrow' }, h('span', { class: 'b-name', text: label }), h('span', { class: 'b-score', text: num(b.score) + '/' + num(b.total) }), stars(b.stars, 3)));
    });
    if (!keys.length) best.appendChild(h('p', { class: 'muted', text: '—' }));
    var grid = h('div', { class: 'mgrid' });
    D.LETTERS.forEach(function (Lt) {
      var lab = L.masteryLabel(k.mastery[Lt.c]);
      grid.appendChild(h('span', { class: 'mcell m-' + lab, 'data-letter': Lt.c, 'data-m': lab, title: Lt.ar, text: Lt.c }));
    });
    var mastered = D.LETTERS.filter(function (Lt) { return L.masteryLabel(k.mastery[Lt.c]) === 'mastered'; }).length;
    mount(h('div', { class: 'screen stars-screen' }, topbar(t('progress'), '#/'),
      h('section', { class: 'summary' },
        h('div', { class: 'sum' }, h('span', { class: 'sum-n', id: 'totalStars', text: num(k.stars) }), h('span', { class: 'sum-l', text: t('totalStars') })),
        h('div', { class: 'sum' }, h('span', { class: 'sum-n', id: 'totalRounds', text: num(k.rounds) }), h('span', { class: 'sum-l', text: t('played') })),
        h('div', { class: 'sum' }, h('span', { class: 'sum-n', text: num(mastered) + '/' + num(28) }), h('span', { class: 'sum-l', text: t('mastered') }))),
      h('h2', { class: 'h2', text: t('letterMastery') }), grid,
      h('p', { class: 'legend' }, h('span', { class: 'dot m-new' }), t('newL'), h('span', { class: 'dot m-learning' }), t('learning'), h('span', { class: 'dot m-mastered' }), t('mastered')),
      h('h2', { class: 'h2', text: t('gameBest') }), best));
  }

  /* ----- parents ----- */
  function viewParents() {
    var wrap = h('div', { class: 'screen parents' });
    function gate() {
      var g = L.gateQuestion(rnd), val = '';
      var out = h('span', { class: 'typed', id: 'gateOut', text: '?' });
      var msg = h('p', { class: 'feedback', role: 'status', 'aria-live': 'polite' });
      var pad = h('div', { class: 'keypad', dir: 'ltr' });
      function show() { out.textContent = val ? num(val) : '?'; }
      ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(function (d) { pad.appendChild(h('button', { class: 'key', 'data-key': d, onclick: function () { if (val.length < 3) { val += d; show(); } }, text: num(d) })); });
      pad.appendChild(h('button', { class: 'key util', onclick: function () { val = ''; show(); }, text: '⌫', 'aria-label': t('clear') }));
      pad.appendChild(h('button', { class: 'key', 'data-key': '0', onclick: function () { if (val.length < 3) { val += '0'; show(); } }, text: num(0) }));
      pad.appendChild(h('button', { class: 'key ok', id: 'gateOk', onclick: function () {
        if (parseInt(val, 10) === g.answer) { parentOpen = true; draw(); } else { msg.textContent = t('gateWrong'); msg.className = 'feedback bad'; val = ''; show(); }
      }, text: '✓', 'aria-label': t('keypadOk') }));
      wrap.innerHTML = '';
      wrap.appendChild(topbar(t('parents'), '#/'));
      wrap.appendChild(h('section', { class: 'qbox' }, h('p', { class: 'prompt', text: t('gate') }),
        h('div', { class: 'eq', dir: 'ltr' }, h('span', { text: num(g.a) }), h('span', { class: 'sym', text: '×' }), h('span', { text: num(g.b) }), h('span', { class: 'sym', text: '=' }), out)));
      wrap.appendChild(msg); wrap.appendChild(pad);
    }
    function seg(label, opts, cur, on) {
      var s = h('div', { class: 'seg two', role: 'radiogroup', 'aria-label': label });
      opts.forEach(function (o) { s.appendChild(h('button', { class: 'segbtn' + (cur === o[0] ? ' on' : ''), role: 'radio', 'aria-checked': cur === o[0] ? 'true' : 'false', 'data-val': String(o[0]), onclick: function () { on(o[0]); }, text: o[1] })); });
      return h('div', { class: 'setrow' }, h('p', { class: 'lbl', text: label }), s);
    }
    function draw() {
      if (!parentOpen) return gate();
      wrap.innerHTML = '';
      wrap.appendChild(topbar(t('parents'), '#/'));
      wrap.appendChild(h('p', { class: 'honest', text: t('honest') }));
      wrap.appendChild(seg(t('language'), [['ar', 'العربية'], ['en', 'English']], st().lang, function (v) { store.setSetting('lang', v); if (!st().digitsTouched) store.data.settings.digits = v === 'ar' ? 'ar' : 'en'; store.setSetting('lang', v); applyLang(); draw(); }));
      wrap.appendChild(seg(t('digits'), [['ar', t('digitsAr')], ['en', t('digitsEn')]], st().digits, function (v) { store.setSetting('digits', v); draw(); }));
      wrap.appendChild(seg(t('sound'), [[true, t('on')], [false, t('off')]], st().sound, function (v) { store.setSetting('sound', v); draw(); }));
      wrap.appendChild(seg(t('speech'), [[true, t('on')], [false, t('off')]], st().speech, function (v) { store.setSetting('speech', v); draw(); }));
      // kids
      wrap.appendChild(h('h2', { class: 'h2', text: t('whoPlays') }));
      var kl = h('div', { class: 'kidrows' });
      store.data.kids.forEach(function (k) {
        var armed = false;
        var del = h('button', { class: 'btn danger small', 'data-del': k.name, text: t('delete'), onclick: function (e) {
          if (!armed) { armed = true; e.currentTarget.textContent = t('delete') + '?'; later(function () { armed = false; e.currentTarget.textContent = t('delete'); }, 3000); return; }
          store.removeKid(k.id); draw();
        } });
        kl.appendChild(h('div', { class: 'kidrow' }, h('span', { class: 'kid-av', text: k.avatar }), h('span', { class: 'kid-name', text: k.name }),
          h('span', { class: 'kid-stars', text: '★ ' + num(k.stars) }),
          h('button', { class: 'btn ghost small', text: t('rename'), onclick: function () { editKid(k); } }), del));
      });
      wrap.appendChild(kl);
      wrap.appendChild(h('div', { id: 'editSlot' }));
      if (store.data.kids.length < S.MAX_KIDS) wrap.appendChild(h('a', { class: 'btn ghost', href: '#/who', text: t('addKid') }));
      // backup
      wrap.appendChild(h('h2', { class: 'h2', text: t('backup') }));
      var msg = h('p', { class: 'note', id: 'backupMsg', role: 'status', text: backupNote });
      var file = h('input', { type: 'file', accept: 'application/json,.json', id: 'importFile', class: 'sr', 'aria-label': t('import'), onchange: function (e) {
        var f = e.target.files && e.target.files[0]; if (!f) return;
        var rd = new FileReader();
        rd.onload = function () { try { var n = store.importJSON(String(rd.result)); backupNote = t('importOk') + ': ' + num(n); applyLang(); draw(); } catch (er) { msg.textContent = t('importBad'); backupNote = t('importBad'); } };
        rd.readAsText(f);
      } });
      wrap.appendChild(h('div', { class: 'row' },
        h('button', { class: 'btn ghost', id: 'exportBtn', text: t('export'), onclick: function () {
          var blob = new Blob([store.exportJSON()], { type: 'application/json' });
          var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'alif-backup.json'; document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        } }),
        h('label', { class: 'btn ghost', for: 'importFile', text: t('import') }), file));
      wrap.appendChild(msg);
      // reset
      var hold = null;
      var rb = h('button', { class: 'btn danger holdbtn', id: 'resetBtn', text: t('resetAll') + ' (' + t('holdReset') + ')' });
      function start() { rb.classList.add('holding'); hold = setTimeout(function () { store.reset(); parentOpen = false; applyLang(); go('#/who'); }, 1500); }
      function stop() { rb.classList.remove('holding'); clearTimeout(hold); }
      rb.addEventListener('pointerdown', start); rb.addEventListener('pointerup', stop); rb.addEventListener('pointerleave', stop); rb.addEventListener('pointercancel', stop);
      rb.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(); });
      rb.addEventListener('keyup', stop);
      wrap.appendChild(rb);
      if (!store.isPersistent()) wrap.appendChild(h('p', { class: 'note', text: st().lang === 'ar' ? 'تنبيه: المتصفح يمنع الحفظ، وستضيع البيانات عند الإغلاق.' : 'Warning: this browser blocks saving, so data is lost when you close the tab.' }));
    }
    function editKid(k) {
      var slot = document.getElementById('editSlot'); slot.innerHTML = '';
      slot.appendChild(kidForm(k, function () { draw(); }));
    }
    draw(); mount(wrap);
  }

  /* ---------- router ---------- */
  function route() {
    clearTimers(); unbindKeys();
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    var hsh = (location.hash || '#/').replace(/^#\/?/, '');
    var p = hsh.split('/');
    if (!store.kid() && p[0] !== 'who') return go('#/who');
    if (p[0] !== 'parents' && p[0] !== 'who') { parentOpen = false; backupNote = ''; }
    switch (p[0]) {
      case '': return viewHome();
      case 'who': return viewWho();
      case 'learn': return p[1] !== undefined && /^\d+$/.test(p[1]) ? viewLetter(parseInt(p[1], 10)) : viewLearn();
      case 'g': lastGame = p[1]; return viewSetup(p[1]);
      case 'numbers': return viewNumbers();
      case 'play': return viewPlay();
      case 'stars': return viewStars();
      case 'parents': return viewParents();
      default: return viewHome();
    }
  }

  window.addEventListener('hashchange', route);
  applyLang();
  route();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache is optional */ }); });
  }
  window.__alif = { store: store, route: route };
})();
