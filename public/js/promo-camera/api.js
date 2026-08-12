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

  function loadOptions(lang, opts) {
    opts = opts || {};
    var qParts = [];
    if (lang) qParts.push('lang=' + encodeURIComponent(String(lang).trim()));
    if (opts.shoot_mode) qParts.push('shoot_mode=' + encodeURIComponent(String(opts.shoot_mode).trim()));
    var q = qParts.length ? '?' + qParts.join('&') : '';
    return authHeaders(false).then(function (headers) {
      return fetch('/api/promo-camera/options' + q, { headers: headers, cache: 'no-store' }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      });
    });
  }

  function pointsPreview(width, height, opts) {
    opts = opts || {};
    var q = '?width=' + encodeURIComponent(width || 1024) + '&height=' + encodeURIComponent(height || 1024);
    if (opts.shoot_mode) q += '&shoot_mode=' + encodeURIComponent(opts.shoot_mode);
    if (opts.space_output_type) q += '&space_output_type=' + encodeURIComponent(opts.space_output_type);
    if (opts.space_resolution_tier) q += '&space_resolution_tier=' + encodeURIComponent(opts.space_resolution_tier);
    if (opts.aspect_ratio) q += '&aspect_ratio=' + encodeURIComponent(opts.aspect_ratio);
    if (opts.shot_count) q += '&shot_count=' + encodeURIComponent(opts.shot_count);
    if (opts.output_count) q += '&output_count=' + encodeURIComponent(opts.output_count);
    return authHeaders(false).then(function (headers) {
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

  function fetchMeCredits() {
    return authHeaders(false).then(function (headers) {
      return fetch('/api/me/credits', { headers: headers, cache: 'no-store' }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      });
    });
  }

  function listPresets() {
    return authHeaders(false).then(function (headers) {
      return fetch('/api/promo-camera/presets', { headers: headers, cache: 'no-store' }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      });
    });
  }

  function savePreset(name, snapshot) {
    return authHeaders(true).then(function (headers) {
      return fetch('/api/promo-camera/presets', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ name: name, snapshot: snapshot || {} })
      }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      });
    });
  }

  function deletePreset(id) {
    return authHeaders(false).then(function (headers) {
      return fetch('/api/promo-camera/presets/' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: headers
      }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      });
    });
  }

  function spaceAppealStatus(generationId) {
    return authHeaders(false).then(function (headers) {
      return fetch('/api/promo-camera/space-appeal/status?generation_id=' + encodeURIComponent(generationId), {
        headers: headers,
        cache: 'no-store'
      }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      });
    });
  }

  function spaceAppeal(generationId) {
    return authHeaders(true).then(function (headers) {
      return fetch('/api/promo-camera/space-appeal', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ generation_id: generationId })
      }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      });
    });
  }

  global.PromoCameraApi = {
    authHeaders: authHeaders,
    loadOptions: loadOptions,
    pointsPreview: pointsPreview,
    generate: generate,
    loadDigitalAssets: loadDigitalAssets,
    fetchMeCredits: fetchMeCredits,
    listPresets: listPresets,
    savePreset: savePreset,
    deletePreset: deletePreset,
    spaceAppealStatus: spaceAppealStatus,
    spaceAppeal: spaceAppeal
  };
})(typeof window !== 'undefined' ? window : this);
