// ============================================================
//  Armazenamento local (IndexedDB) + envio da fila ao servidor
//  Usado pela página E pelo service worker (envio em segundo plano)
// ============================================================
var DB_NOME = 'insp-redutores', DB_VERSAO = 1, _dbPromise = null, _enviando = false;

function db() {
  if (!_dbPromise) _dbPromise = new Promise(function (res, rej) {
    var r = indexedDB.open(DB_NOME, DB_VERSAO);
    r.onupgradeneeded = function () {
      var d = r.result;
      if (!d.objectStoreNames.contains('regs')) d.createObjectStore('regs', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('eventos')) d.createObjectStore('eventos', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos');
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
    };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
  return _dbPromise;
}
function _p(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
async function idbGet(st, k) { var d = await db(); return _p(d.transaction(st).objectStore(st).get(k)); }
async function idbAll(st) { var d = await db(); return _p(d.transaction(st).objectStore(st).getAll()); }
async function idbPut(st, v, k) { var d = await db(); var s = d.transaction(st, 'readwrite').objectStore(st); return _p(k === undefined ? s.put(v) : s.put(v, k)); }
async function idbDel(st, k) { var d = await db(); return _p(d.transaction(st, 'readwrite').objectStore(st).delete(k)); }
async function idbEntries(st) {
  var d = await db();
  return new Promise(function (res, rej) {
    var out = [], c = d.transaction(st).objectStore(st).openCursor();
    c.onsuccess = function () { var cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } else res(out); };
    c.onerror = function () { rej(c.error); };
  });
}

async function blobB64(b) {
  var u8 = new Uint8Array(await b.arrayBuffer()), s = '', step = 0x8000;
  for (var i = 0; i < u8.length; i += step) s += String.fromCharCode.apply(null, u8.subarray(i, i + step));
  return btoa(s);
}

async function apiPost(corpo) {
  var r = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS
    body: JSON.stringify(Object.assign({ key: CONFIG.API_KEY }, corpo))
  });
  if (!r.ok) throw new Error('Servidor respondeu ' + r.status);
  var j = await r.json();
  if (!j.ok) throw new Error(j.erro || 'Erro no servidor');
  return j;
}
async function apiGet(params) {
  var u = new URL(CONFIG.API_URL), p = Object.assign({ key: CONFIG.API_KEY }, params);
  Object.keys(p).forEach(function (k) { u.searchParams.set(k, p[k]); });
  var r = await fetch(u.toString(), { cache: 'no-store' });
  if (!r.ok) throw new Error('Servidor respondeu ' + r.status);
  var j = await r.json();
  if (!j.ok) throw new Error(j.erro || 'Erro no servidor');
  return j;
}

// Envia tudo que está pendente, na ordem em que foi feito.
// O servidor ignora repetidos (mesmo id), então reenviar nunca duplica.
async function syncFila() {
  if (!CONFIG.API_URL || _enviando) return null;
  _enviando = true;
  var enviados = 0, erro = null;
  try {
    var regs = (await idbAll('regs')).filter(function (r) { return r.sync === 'pend'; }).sort(function (a, b) { return a.ts - b.ts; });
    for (var i = 0; i < regs.length; i++) {
      var r = regs[i], blobs = (await idbGet('fotos', r.id)) || [], fotos = [];
      for (var j = 0; j < blobs.length; j++) fotos.push(await blobB64(blobs[j]));
      var dados = Object.assign({}, r); delete dados.sync; delete dados.fotoIds; dados.fotos = fotos;
      var resp = await apiPost({ action: 'registro', reg: dados });
      r.sync = 'ok'; r.fotoIds = resp.fotoIds || [];
      await idbPut('regs', r);
      await idbDel('fotos', r.id);
      enviados++;
    }
    var evs = (await idbAll('eventos')).filter(function (e) { return e.sync === 'pend'; }).sort(function (a, b) { return a.ts - b.ts; });
    for (var k = 0; k < evs.length; k++) {
      var e = evs[k], d2 = Object.assign({}, e); delete d2.sync;
      await apiPost({ action: 'evento', ev: d2 });
      e.sync = 'ok'; await idbPut('eventos', e);
      enviados++;
    }
  } catch (err) {
    erro = (err && err.message) || String(err);
  } finally {
    _enviando = false;
  }
  return { enviados: enviados, erro: erro };
}
