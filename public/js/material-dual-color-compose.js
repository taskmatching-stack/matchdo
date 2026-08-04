/**
 * 材料雙色卡 Step1：1024×1024，上方 75% 主色、下方 25% 配色（零 FLUX）
 */
(function (global) {
  'use strict';

  var CANVAS_SIZE = 1024;

  function normalizeHex(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (s.charAt(0) !== '#') s = '#' + s;
    if (!/^#[0-9A-Fa-f]{6}$/.test(s)) return '';
    return s.toUpperCase();
  }

  function composeDualColorSwatch(mainHex, accentHex) {
    var main = normalizeHex(mainHex);
    var accent = normalizeHex(accentHex);
    if (!main || !accent) throw new Error('請填寫有效的主色與配色（#RRGGBB）');
    var topH = Math.floor(CANVAS_SIZE * 0.75);
    var bottomH = CANVAS_SIZE - topH;
    var canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = main;
    ctx.fillRect(0, 0, CANVAS_SIZE, topH);
    ctx.fillStyle = accent;
    ctx.fillRect(0, topH, CANVAS_SIZE, bottomH);
    return canvas;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('無法產生色卡圖片'));
      }, type || 'image/jpeg', quality != null ? quality : 0.92);
    });
  }

  global.MatchdoMaterialDualColorCompose = {
    CANVAS_SIZE: CANVAS_SIZE,
    normalizeHex: normalizeHex,
    composeDualColorSwatch: composeDualColorSwatch,
    canvasToBlob: canvasToBlob
  };
})(typeof window !== 'undefined' ? window : this);
