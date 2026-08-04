/**
 * 雙色卡 FLUX 結果 → 材料待傳清單（IndexedDB + sessionStorage）
 */
(function (global) {
  'use strict';

  var DB_NAME = 'matchdo-materials-pending-v1';
  var SESSION_KEY = 'matchdo-dual-color-import-v1';
  var SWATCH_IDB_KEY = 'material:dual-color-import:swatch';
  var FLUX_IDB_KEY = 'material:dual-color-import:flux';
  var dbPromise = null;

  function openDb() {
    if (!global.indexedDB) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function (e) {
        e.target.result.createObjectStore('blobs', { keyPath: 'key' });
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function () { resolve(null); };
    });
    return dbPromise;
  }

  function idbPut(key, file) {
    return openDb().then(function (db) {
      if (!db || !file) return;
      return new Promise(function (resolve) {
        var tx = db.transaction('blobs', 'readwrite');
        tx.objectStore('blobs').put({
          key: key,
          blob: file,
          name: file.name || 'image.jpg',
          type: file.type || 'image/jpeg'
        });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      });
    });
  }

  function idbGet(key) {
    return openDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        var tx = db.transaction('blobs', 'readonly');
        var req = tx.objectStore('blobs').get(key);
        req.onsuccess = function () {
          var row = req.result;
          if (!row || !row.blob) { resolve(null); return; }
          resolve(new File([row.blob], row.name || 'image.jpg', { type: row.type || 'image/jpeg' }));
        };
        req.onerror = function () { resolve(null); };
      });
    });
  }

  function idbDeletePrefix(prefix) {
    return openDb().then(function (db) {
      if (!db) return;
      return new Promise(function (resolve) {
        var tx = db.transaction('blobs', 'readwrite');
        var store = tx.objectStore('blobs');
        var req = store.openCursor();
        req.onsuccess = function (e) {
          var cursor = e.target.result;
          if (!cursor) return;
          if (String(cursor.key).indexOf(prefix) === 0) cursor.delete();
          cursor.continue();
        };
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      });
    });
  }

  function peekImportMeta() {
    if (!global.sessionStorage) return null;
    try {
      var raw = global.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  async function saveImport(meta, swatchFile, fluxFile) {
    if (!fluxFile) throw new Error('缺少 FLUX 結果');
    await idbPut(FLUX_IDB_KEY, fluxFile);
    if (swatchFile) await idbPut(SWATCH_IDB_KEY, swatchFile);
    else await idbDeletePrefix('material:dual-color-import:swatch');
    if (!global.sessionStorage) throw new Error('無法儲存待傳資料');
    global.sessionStorage.setItem(SESSION_KEY, JSON.stringify(Object.assign({ v: 1, savedAt: Date.now() }, meta || {})));
  }

  async function loadImportBlobs() {
    var swatch = await idbGet(SWATCH_IDB_KEY);
    var flux = await idbGet(FLUX_IDB_KEY);
    return { swatch: swatch, flux: flux };
  }

  async function clearImport() {
    if (global.sessionStorage) {
      try { global.sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
    }
    await idbDeletePrefix('material:dual-color-import:');
  }

  async function fluxFileFromApiResponse(data, filename) {
    if (data && data.preview_base64) {
      var bin = atob(data.preview_base64);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new File([arr], filename || 'dual-color-flux.jpg', { type: 'image/jpeg' });
    }
    if (data && data.preview_url) {
      var res = await fetch(data.preview_url, { mode: 'cors' });
      if (!res.ok) throw new Error('無法讀取 FLUX 結果');
      var blob = await res.blob();
      return new File([blob], filename || 'dual-color-flux.jpg', { type: blob.type || 'image/jpeg' });
    }
    throw new Error('無法讀取 FLUX 結果');
  }

  global.MatchdoDualColorImport = {
    SESSION_KEY: SESSION_KEY,
    peekImportMeta: peekImportMeta,
    saveImport: saveImport,
    loadImportBlobs: loadImportBlobs,
    clearImport: clearImport,
    fluxFileFromApiResponse: fluxFileFromApiResponse
  };
})(typeof window !== 'undefined' ? window : this);
