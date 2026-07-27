/* =========================================================================
 * td_asset_cache.js — background prefetch + IndexedDB cache for TD sprites.
 *
 * Problem (field-tested 2026-07-27, no VPN): the Tower Defense preload pulls
 * ~5MB of sprite sheets same-origin from GitHub Pages, which the GFW throttles
 * → "first load takes forever". The browser HTTP cache fixes repeat loads on
 * desktop, but WeChat aggressively evicts it, so students re-download.
 *
 * Fix — same pattern that solved the 41MB Whisper download (speech_engine.js):
 *   1. Prefetch every TD sprite in the background right after page load,
 *      via the CN-reachable gh-proxy mirror first (CORS:*, fast), falling
 *      back to same-origin.
 *   2. Persist each file in IndexedDB, keyed by path + version token, so
 *      repeat visits skip the network entirely (survives WeChat eviction).
 *   3. Expose a SYNCHRONOUS URL map for Phaser's preload(): TDAssets.url(p)
 *      returns a local blob: URL when the file is cached, or the plain path
 *      when it isn't (Phaser then loads it over the network — same as today).
 *
 * Every failure path degrades to the original behavior; this module can only
 * make loads faster, never break them.
 * ========================================================================= */
(function (global) {
  'use strict';

  // Bump when any file under sprites/td/ changes (stale cache is served until then).
  var VERSION = 'td-sprites-v1';
  var DB_NAME = 'td-asset-cache';
  var DB_VERSION = 1;
  var FETCH_TIMEOUT_MS = 45000; // per file, per mirror — background work, be patient

  // Every image tower_defense.js preload() requests (keep in sync with it).
  var TD_ASSET_PATHS = [
    'sprites/td/enemies.png',
    'sprites/td/towers.png',
    'sprites/td/anim/dropout.png',
    'sprites/td/anim/backpack.png',
    'sprites/td/anim/nerd.png',
    'sprites/td/anim/pencil.png',
    'sprites/td/anim/parts/dropout/head.png',
    'sprites/td/anim/parts/dropout/torso.png',
    'sprites/td/anim/parts/dropout/arm.png',
    'sprites/td/anim/parts/dropout/leg.png',
    'sprites/td/anim/parts/dropout/head_attack.png',
    'sprites/td/anim/parts/dropout/head_hit.png',
    'sprites/td/anim/dropout_walk.png',
    'sprites/td/anim/dropout_action.png'
  ];

  // path -> blob: URL, filled as files land. Read synchronously by TDAssets.url().
  var urlMap = {};

  // --- IndexedDB (same minimal helpers as the model cache) ------------------
  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'name' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function cacheGet(path) {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction('files', 'readonly');
        var req = tx.objectStore('files').get(VERSION + '/' + path);
        req.onsuccess = function () { resolve(req.result ? req.result.data : null); };
        req.onerror = function () { resolve(null); };
      });
    }).catch(function () { return null; });
  }

  function cachePut(path, blob) {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put({ name: VERSION + '/' + path, data: blob });
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    }).catch(function () {});
  }

  // --- Mirrors (mirrors speech_engine's rawRepoBase logic) ------------------
  // On *.github.io: gh-proxy (CN-fast, CORS:*) first, same-origin fallback.
  // Anywhere else (localhost / file:// / future hosts): same-origin only.
  function sources() {
    var h = (location.hostname || '').toLowerCase();
    var out = [];
    if (h.endsWith('.github.io')) {
      var owner = h.slice(0, -'.github.io'.length);
      var repo = (location.pathname || '').split('/').filter(Boolean)[0];
      if (owner && repo) {
        out.push('https://gh-proxy.com/https://raw.githubusercontent.com/' + owner + '/' + repo + '/main/');
      }
    }
    out.push(new URL('./', location.href).href); // same-origin
    return out;
  }

  function fetchWithTimeout(url) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
    return fetch(url, { signal: ctrl.signal }).finally(function () { clearTimeout(timer); });
  }

  function log(msg) { if (global.__speechLog) global.__speechLog('TDAssets: ' + msg); }

  // Download one file through the mirror chain, cache it, register its blob URL.
  function fetchAndCache(path, srcs) {
    var attempt = function (i) {
      if (i >= srcs.length) return Promise.reject(new Error('all sources failed'));
      return fetchWithTimeout(srcs[i] + path).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.blob();
      }).then(function (blob) {
        urlMap[path] = URL.createObjectURL(blob);
        cachePut(path, blob); // fire-and-forget
        return true;
      }).catch(function () { return attempt(i + 1); });
    };
    return attempt(0);
  }

  // --- Background prefetch ---------------------------------------------------
  var prefetchDone = null;
  function prefetch() {
    if (prefetchDone) return prefetchDone;
    var srcs = sources();
    var t0 = Date.now();
    var hits = 0, downloads = 0, fails = 0;
    prefetchDone = Promise.all(TD_ASSET_PATHS.map(function (path) {
      return cacheGet(path).then(function (blob) {
        if (blob) { urlMap[path] = URL.createObjectURL(blob); hits++; return true; }
        return fetchAndCache(path, srcs).then(
          function () { downloads++; },
          function () { fails++; } // stays un-mapped → Phaser loads the plain path
        );
      });
    })).then(function () {
      log(TD_ASSET_PATHS.length + ' sprites ready in ' + ((Date.now() - t0) / 1000).toFixed(1) +
        's (cache ' + hits + ', downloaded ' + downloads + ', fallback ' + fails + ')');
    });
    return prefetchDone;
  }

  global.TDAssets = {
    // Synchronous: blob URL if prefetched/cached, else the plain path.
    url: function (path) { return urlMap[path] || path; },
    prefetch: prefetch
  };

  // Kick off shortly after load so we never compete with critical page assets
  // (the Whisper model streams from a different host, so no contention there).
  function start() { setTimeout(prefetch, 2000); }
  if (document.readyState === 'complete') start();
  else global.addEventListener('load', start, { once: true });
})(window);
