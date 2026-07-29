/**
 * 攝影模擬 — API（與 DOM 無關，便於未來 APP 重用）
 */
(function (global) {
  'use strict';

  function authHeaders(json) {
    var h = json ? { 'Content-Type': 'application/json' } : {};
    return Promise.resolve().then(function () {
      if (typeof global.AuthService !== 'undefined' && typeof global.AuthService.getSession === 'function') {
        return global.AuthService.getSession();
      }
      return null;
    }).then(function (session) {
      var tok = (session && session.access_token) || global.__MATCHDO_ACCESS_TOKEN || '';
      if (tok) h.Authorization = 'Bearer ' + tok;
      return h;
    });
  }

  function loadOptions(lang) {
    var q = lang ? '?lang=' + encodeURIComponent(String(lang).trim()) : '';
    return authHeaders(false).then(function (headers) {
      return fetch('/api/promo-camera/options' + q, { headers: headers, cache: 'no-store' }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      });
    });
  }

  function pointsPreview(width, height) {
    return authHeaders(false).then(function (headers) {
      var q = '?width=' + encodeURIComponent(width || 1024) + '&height=' + encodeURIComponent(height || 1024);
      return fetch('/api/promo-camera/points-preview' + q, { headers: headers }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, data: data }; });
      });
    });
  }

  function generate(payload) {
    return authHeaders(true).then(function (headers) {
      return fetch('/api/promo-camera/generate', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload || {})
      }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      });
    });
  }

  function loadDigitalAssets(limit, offset) {
    return authHeaders(false).then(function (headers) {
      var q = '?gallery=1&limit=' + (limit || 40) + '&offset=' + (offset || 0);
      return fetch('/api/custom-products' + q, { headers: headers }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, data: data }; });
      });
    });
  }

  global.PromoCameraApi = {
    authHeaders: authHeaders,
    loadOptions: loadOptions,
    pointsPreview: pointsPreview,
    generate: generate,
    loadDigitalAssets: loadDigitalAssets
  };
})(typeof window !== 'undefined' ? window : this);
