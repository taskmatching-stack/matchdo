/**
 * 材料組合色卡 Step1：垂直無縫色帶（雙色／三色）或同材質全幅混色（heather）
 * 支援同材質交界漸層（transitions，僅 banded 模式）
 */
(function (global) {
  'use strict';

  var CANVAS_SIZE = 1024;

  var DUAL_PRESETS = {
    dual_75_25: { key: 'dual_75_25', label: '75 / 25', percents: [75, 25] },
    dual_50_50: { key: 'dual_50_50', label: '50 / 50', percents: [50, 50] }
  };

  var MIX_DUAL_PRESETS = {
    mix_70_30: { key: 'mix_70_30', label: '70 / 30', weights: [70, 30] },
    mix_50_50: { key: 'mix_50_50', label: '50 / 50', weights: [50, 50] }
  };

  var TRANSITION_EDGES = ['main_accent', 'accent_third'];

  function normalizeHex(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (s.charAt(0) !== '#') s = '#' + s;
    if (!/^#[0-9A-Fa-f]{6}$/.test(s)) return '';
    return s.toUpperCase();
  }

  function clampSpanPct(raw) {
    var n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return 12;
    return Math.max(1, Math.min(30, n));
  }

  /** @param {number[]} percents 整數％，合計須為 100，每段 >= 1 */
  function validatePercents(percents) {
    if (!Array.isArray(percents) || percents.length < 2) {
      return { ok: false, error: '比重無效' };
    }
    var nums = [];
    var sum = 0;
    for (var i = 0; i < percents.length; i++) {
      var n = parseInt(percents[i], 10);
      if (!Number.isFinite(n) || n < 1) {
        return { ok: false, error: '每一段比重至少 1%' };
      }
      nums.push(n);
      sum += n;
    }
    if (sum !== 100) {
      return { ok: false, error: '比重合計須為 100%（目前 ' + sum + '%）' };
    }
    return { ok: true, percents: nums };
  }

  function normalizeTransitionMap(transitions, bandCount) {
    var map = Object.create(null);
    var src = transitions;
    if (Array.isArray(transitions)) {
      src = Object.create(null);
      transitions.forEach(function (tr) {
        if (tr && tr.edge) src[tr.edge] = tr;
      });
    }
    if (!src || typeof src !== 'object') src = Object.create(null);
    var edges = bandCount >= 3 ? TRANSITION_EDGES.slice() : ['main_accent'];
    edges.forEach(function (edge) {
      var tr = src[edge] || {};
      var mode = tr.mode === 'gradient' ? 'gradient' : 'hard';
      map[edge] = {
        mode: mode,
        span_pct: clampSpanPct(tr.span_pct)
      };
    });
    return map;
  }

  /**
   * @param {{ hex: string, pct: number }[]} bands
   * @param {number} [size]
   * @param {{ transitions?: object|array }} [options]
   */
  function composeVerticalSwatch(bands, size, options) {
    options = options || {};
    var canvasSize = size > 0 ? size : CANVAS_SIZE;
    if (!Array.isArray(bands) || bands.length < 2) {
      throw new Error('至少需要兩段色塊');
    }
    var pcts = bands.map(function (b) { return b && b.pct; });
    var checked = validatePercents(pcts);
    if (!checked.ok) throw new Error(checked.error);
    var hexes = [];
    for (var i = 0; i < bands.length; i++) {
      var hx = normalizeHex(bands[i] && bands[i].hex);
      if (!hx) throw new Error('請填寫有效色號（#RRGGBB）');
      hexes.push(hx);
    }
    var heights = [];
    var yStarts = [];
    var used = 0;
    for (var j = 0; j < checked.percents.length; j++) {
      yStarts.push(used);
      if (j === checked.percents.length - 1) {
        heights.push(canvasSize - used);
      } else {
        var h = Math.floor(canvasSize * checked.percents[j] / 100);
        heights.push(h);
        used += h;
      }
    }
    var transitionMap = normalizeTransitionMap(options.transitions, hexes.length);

    var canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    var ctx = canvas.getContext('2d');
    var y = 0;
    for (var k = 0; k < hexes.length; k++) {
      ctx.fillStyle = hexes[k];
      ctx.fillRect(0, y, canvasSize, heights[k]);
      y += heights[k];
    }

    TRANSITION_EDGES.forEach(function (edge, bandIdx) {
      if (bandIdx >= hexes.length - 1) return;
      var tr = transitionMap[edge];
      if (!tr || tr.mode !== 'gradient') return;
      var boundaryY = yStarts[bandIdx + 1];
      var spanPx = Math.max(2, Math.round(canvasSize * clampSpanPct(tr.span_pct) / 100));
      var gradY0 = Math.max(0, boundaryY - Math.floor(spanPx / 2));
      var gradY1 = Math.min(canvasSize, boundaryY + Math.ceil(spanPx / 2));
      if (gradY1 <= gradY0) return;
      var g = ctx.createLinearGradient(0, gradY0, 0, gradY1);
      g.addColorStop(0, hexes[bandIdx]);
      g.addColorStop(1, hexes[bandIdx + 1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, gradY0, canvasSize, gradY1 - gradY0);
    });

    return canvas;
  }

  /** 混色比重：整數％，合計須為 100（與 validatePercents 相同規則） */
  function validateMixWeights(weights) {
    var checked = validatePercents(weights);
    if (!checked.ok) return checked;
    return { ok: true, weights: checked.percents };
  }

  function hexToRgb(hex) {
    var hx = normalizeHex(hex);
    if (!hx) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(hx.slice(1, 3), 16),
      g: parseInt(hx.slice(3, 5), 16),
      b: parseInt(hx.slice(5, 7), 16)
    };
  }

  function hashNoise(x, y, seed) {
    var n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.758) * 43758.5453;
    return n - Math.floor(n);
  }

  /**
   * 同材質全幅混色（heather 細點交織）
   * @param {{ hex: string, weight: number }[]} entries
   * @param {number} [size]
   * @param {{ style?: string }} [options]
   */
  function composeMixedSwatch(entries, size, options) {
    options = options || {};
    var canvasSize = size > 0 ? size : CANVAS_SIZE;
    if (!Array.isArray(entries) || entries.length < 2) {
      throw new Error('至少需要兩色');
    }
    var weights = entries.map(function (e) { return e && e.weight; });
    var checked = validateMixWeights(weights);
    if (!checked.ok) throw new Error(checked.error);
    var rgbs = [];
    for (var i = 0; i < entries.length; i++) {
      var hx = normalizeHex(entries[i] && entries[i].hex);
      if (!hx) throw new Error('請填寫有效色號（#RRGGBB）');
      rgbs.push(hexToRgb(hx));
    }
    var thresholds = [];
    var acc = 0;
    for (var j = 0; j < checked.weights.length; j++) {
      acc += checked.weights[j] / 100;
      thresholds.push(acc);
    }
    var canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    var ctx = canvas.getContext('2d');
    var img = ctx.createImageData(canvasSize, canvasSize);
    var data = img.data;
    for (var y = 0; y < canvasSize; y++) {
      for (var x = 0; x < canvasSize; x++) {
        var n = hashNoise(x, y, 1) * 0.55
          + hashNoise(x >> 1, y >> 1, 2) * 0.3
          + hashNoise(x >> 2, y >> 2, 3) * 0.15;
        var idx = 0;
        while (idx < thresholds.length - 1 && n >= thresholds[idx]) idx++;
        var rgb = rgbs[idx];
        var p = (y * canvasSize + x) * 4;
        data[p] = rgb.r;
        data[p + 1] = rgb.g;
        data[p + 2] = rgb.b;
        data[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  /** 相容舊呼叫：固定 75/25 */
  function composeDualColorSwatch(mainHex, accentHex) {
    return composeVerticalSwatch([
      { hex: mainHex, pct: 75 },
      { hex: accentHex, pct: 25 }
    ]);
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('無法產生色卡圖片'));
      }, type || 'image/png', quality != null ? quality : undefined);
    });
  }

  global.MatchdoMaterialDualColorCompose = {
    CANVAS_SIZE: CANVAS_SIZE,
    DUAL_PRESETS: DUAL_PRESETS,
    MIX_DUAL_PRESETS: MIX_DUAL_PRESETS,
    TRANSITION_EDGES: TRANSITION_EDGES,
    normalizeHex: normalizeHex,
    clampSpanPct: clampSpanPct,
    validatePercents: validatePercents,
    validateMixWeights: validateMixWeights,
    normalizeTransitionMap: normalizeTransitionMap,
    composeVerticalSwatch: composeVerticalSwatch,
    composeMixedSwatch: composeMixedSwatch,
    composeDualColorSwatch: composeDualColorSwatch,
    canvasToBlob: canvasToBlob
  };
})(typeof window !== 'undefined' ? window : this);
