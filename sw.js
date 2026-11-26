/* Alif service worker: cache-first so the app works offline after the first visit. */
var CACHE = 'alif-v2';
var AUDIO = (function(){var a=[],i,p;for(i=0;i<28;i++){p=(i<10?'0':'')+i;a.push('audio/n'+p+'.mp3','audio/w'+p+'.mp3','audio/s'+p+'.mp3');}for(i=0;i<21;i++)a.push('audio/d'+(i<10?'0':'')+i+'.mp3');for(i=0;i<5;i++)a.push('audio/p0'+i+'.mp3');return a;})();
var ASSETS = ['./', 'index.html', 'css/style.css', 'js/data.js', 'js/logic.js', 'js/store.js', 'js/app.js',
  'fonts/BalooBhaijaan2-subset.ttf', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS.concat(AUDIO)); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (hit) {
    return hit || fetch(e.request).then(function (res) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return res;
    }).catch(function () { return caches.match('index.html'); });
  }));
});
