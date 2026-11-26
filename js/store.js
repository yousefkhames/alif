/* Alif storage: localStorage with an in-memory fallback (private mode, blocked storage). */
(function (root) {
  'use strict';
  var KEY = 'alif.v1';
  var MAX_KIDS = 6;

  function defaults() {
    return { v: 1, settings: { lang: 'ar', digits: 'ar', digitsTouched: false, sound: true, speech: true }, kids: [], current: null };
  }

  function makeStore(storage) {
    var mem = null;
    var persistent = true;
    function read() {
      try {
        var raw = storage.getItem(KEY);
        if (!raw) return defaults();
        var d = JSON.parse(raw);
        return sanitize(d);
      } catch (e) { persistent = false; return mem || defaults(); }
    }
    function write(d) {
      mem = d;
      try { storage.setItem(KEY, JSON.stringify(d)); persistent = true; } catch (e) { persistent = false; }
    }

    var data = read();
    function save() { write(data); }

    function newId() { return 'k' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

    var api = {
      get data() { return data; },
      isPersistent: function () { return persistent; },
      kid: function () {
        for (var i = 0; i < data.kids.length; i++) if (data.kids[i].id === data.current) return data.kids[i];
        return null;
      },
      addKid: function (name, avatar) {
        if (data.kids.length >= MAX_KIDS) return null;
        name = String(name || '').trim().slice(0, 16);
        if (!name) return null;
        var k = { id: newId(), name: name, avatar: avatar || '🦁', stars: 0, rounds: 0, mastery: {}, best: {}, seen: {} };
        data.kids.push(k); data.current = k.id; save(); return k;
      },
      editKid: function (id, name, avatar) {
        name = String(name || '').trim().slice(0, 16);
        if (!name) return false;
        for (var i = 0; i < data.kids.length; i++) if (data.kids[i].id === id) {
          data.kids[i].name = name; if (avatar) data.kids[i].avatar = avatar; save(); return true;
        }
        return false;
      },
      removeKid: function (id) {
        data.kids = data.kids.filter(function (k) { return k.id !== id; });
        if (data.current === id) data.current = data.kids.length ? data.kids[0].id : null;
        save();
      },
      select: function (id) { data.current = id; save(); },
      setSetting: function (k, v) { data.settings[k] = v; if (k === 'digits') data.settings.digitsTouched = true; save(); },
      recordRound: function (key, stars, score, total) {
        var k = api.kid(); if (!k) return;
        k.rounds += 1; k.stars += stars;
        var b = k.best[key];
        if (!b || score > b.score || (score === b.score && stars > b.stars)) k.best[key] = { score: score, total: total, stars: stars };
        save();
      },
      saveKid: save,
      exportJSON: function () { return JSON.stringify(data, null, 2); },
      importJSON: function (text) {
        var d = JSON.parse(text);
        if (!d || typeof d !== 'object' || !Array.isArray(d.kids)) throw new Error('bad');
        data = sanitize(d); save(); return data.kids.length;
      },
      reset: function () { data = defaults(); save(); }
    };
    return api;
  }

  function sanitize(d) {
    var base = defaults();
    if (!d || typeof d !== 'object') return base;
    var s = d.settings || {};
    base.settings.lang = s.lang === 'en' ? 'en' : 'ar';
    base.settings.digits = s.digits === 'en' ? 'en' : 'ar';
    base.settings.digitsTouched = !!s.digitsTouched;
    base.settings.sound = s.sound !== false;
    base.settings.speech = s.speech !== false;
    var kids = Array.isArray(d.kids) ? d.kids.slice(0, MAX_KIDS) : [];
    base.kids = kids.filter(function (k) { return k && typeof k.name === 'string' && k.name.trim(); }).map(function (k, i) {
      return {
        id: typeof k.id === 'string' ? k.id.slice(0, 32) : 'k' + i,
        name: k.name.trim().slice(0, 16),
        avatar: typeof k.avatar === 'string' ? k.avatar.slice(0, 8) : '🦁',
        stars: Math.max(0, parseInt(k.stars, 10) || 0),
        rounds: Math.max(0, parseInt(k.rounds, 10) || 0),
        mastery: k.mastery && typeof k.mastery === 'object' ? k.mastery : {},
        best: k.best && typeof k.best === 'object' ? k.best : {},
        seen: k.seen && typeof k.seen === 'object' ? k.seen : {}
      };
    });
    base.current = base.kids.some(function (k) { return k.id === d.current; }) ? d.current : (base.kids[0] ? base.kids[0].id : null);
    return base;
  }

  var api = { makeStore: makeStore, KEY: KEY, MAX_KIDS: MAX_KIDS, sanitize: sanitize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AlifStore = api;
})(typeof self !== 'undefined' ? self : this);
