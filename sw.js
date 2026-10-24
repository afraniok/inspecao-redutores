// Service worker: deixa o app abrir sem internet e envia a fila
// quando a conexão voltar, mesmo com o app fechado.
// Ao publicar uma versão nova do app, aumente VERSAO.
var VERSAO = 'v1';
var CACHE = 'insp-' + VERSAO;
var ARQUIVOS = ['./', 'index.html', 'config.js', 'sync.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

importScripts('config.js', 'sync.js');

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Arquivos do próprio app: responde do cache na hora e atualiza em segundo plano.
// Servidor (script.google.com) e fotos do Drive passam direto.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var nav = req.mode === 'navigate';
  var chave = nav ? 'index.html' : req;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(chave, { ignoreSearch: true }).then(function (hit) {
      var rede = fetch(req).then(function (r) {
        if (r && r.ok) c.put(chave, r.clone());
        return r;
      }).catch(function () { return null; });
      if (hit) { e.waitUntil(rede); return hit; }
      return rede.then(function (r) { return r || new Response('Sem conexão', { status: 503 }); });
    });
  }));
});

self.addEventListener('sync', function (e) {
  if (e.tag === 'enviar-fila') {
    e.waitUntil(syncFila().then(function (r) { if (r && r.erro) throw new Error(r.erro); }));
  }
});
