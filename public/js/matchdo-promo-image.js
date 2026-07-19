/**
 * Matchdo 產品推廣圖 — 共用前端輔助（比例／點數預覽／API）
 * 僅供推廣圖 TAB 使用；不改動既有寫實化／圖樣提取邏輯。
 */
(function (global) {
  'use strict';

  var RATIO_PRESETS = {
    '1:1': { w: 1024, h: 1024 },
    '4:3': { w: 1152, h: 864 },
    '3:4': { w: 864, h: 1152 },
    '16:9': { w: 1344, h: 756 },
    '9:16': { w: 756, h: 1344 }
  };

  function clampDim(n, fallback) {
    var v = parseInt(n, 10);
    if (!isFinite(v)) v = fallback || 1024;
    return Math.min(2048, Math.max(512, v));
  }

  function dimsForRatio(ratio) {
    var p = RATIO_PRESETS[ratio] || RATIO_PRESETS['1:1'];
    return { w: p.w, h: p.h, ratio: RATIO_PRESETS[ratio] ? ratio : '1:1' };
  }

  function estimatePointsLocal(width, height, base, perExtra) {
    var w = clampDim(width, 1024);
    var h = clampDim(height, 1024);
    var mp = Math.min(4, Math.ceil((w * h) / (1024 * 1024)) || 1);
    var b = Math.max(0, parseInt(base, 10) || 20);
    var e = Math.max(0, parseInt(perExtra, 10) || 10);
    return b + (mp - 1) * e;
  }

  function ratioSelectHtml(selected, className) {
    var sel = selected || '1:1';
    var opts = Object.keys(RATIO_PRESETS).map(function (k) {
      return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + k + '</option>';
    }).join('');
    return '<select class="form-select form-select-sm ' + (className || 'promo-ratio-select') + '">' + opts + '</select>';
  }

  function fillSelect(el, items, valueKey, labelKey, emptyLabel) {
    if (!el) return;
    var vk = valueKey || 'key';
    var lk = labelKey || 'name';
    var html = emptyLabel ? ('<option value="">' + emptyLabel + '</option>') : '';
    (items || []).forEach(function (it) {
      html += '<option value="' + String(it[vk] || '').replace(/"/g, '&quot;') + '">' +
        String(it[lk] || it[vk] || '').replace(/</g, '&lt;') + '</option>';
    });
    el.innerHTML = html;
  }

  function authHeaders(json) {
    var h = json ? { 'Content-Type': 'application/json' } : {};
    return Promise.resolve().then(function () {
      if (typeof global.AuthService !== 'undefined' && typeof global.AuthService.getSession === 'function') {
        return global.AuthService.getSession();
      }
      return null;
    }).then(function (session) {
      if (session && session.access_token) h.Authorization = 'Bearer ' + session.access_token;
      return h;
    });
  }

  function loadOptions() {
    return authHeaders(false).then(function (headers) {
      return fetch('/api/promo-image/options', { headers: headers }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      });
    });
  }

  function pointsPreview(width, height) {
    return authHeaders(false).then(function (headers) {
      var q = '?width=' + encodeURIComponent(width) + '&height=' + encodeURIComponent(height);
      return fetch('/api/promo-image/points-preview' + q, { headers: headers }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, data: data }; });
      });
    });
  }

  function generate(payload) {
    return authHeaders(true).then(function (headers) {
      return fetch('/api/promo-image/generate', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload || {})
      }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      });
    });
  }

  global.MatchdoPromoImage = {
    RATIO_PRESETS: RATIO_PRESETS,
    dimsForRatio: dimsForRatio,
    clampDim: clampDim,
    estimatePointsLocal: estimatePointsLocal,
    ratioSelectHtml: ratioSelectHtml,
    fillSelect: fillSelect,
    loadOptions: loadOptions,
    pointsPreview: pointsPreview,
    generate: generate
  };
})(typeof window !== 'undefined' ? window : this);
