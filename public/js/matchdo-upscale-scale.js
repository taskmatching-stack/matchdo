/**
 * AI 放大倍數選單（僅 UI 輔助；不改圖庫同格結構）
 * 2× 基準點 + 每升一階 +1
 * Real-ESRGAN 建議輸入最長邊 ≤1440px（約 1440p）
 */
(function (global) {
  var SCALES = [2, 4, 6, 8, 10];
  var DEFAULT_SCALE = 2;
  var MAX_INPUT_SIDE = 1440;

  function normalizeScale(raw) {
    var n = parseInt(raw, 10);
    return SCALES.indexOf(n) >= 0 ? n : DEFAULT_SCALE;
  }

  function pointsForScale(basePoints, scale, byScaleMap) {
    var s = normalizeScale(scale);
    if (byScaleMap && byScaleMap[s] != null) return parseInt(byScaleMap[s], 10) || 0;
    var base = Math.max(0, parseInt(basePoints, 10) || 1);
    return base + (s / 2 - 1);
  }

  function selectHtml(className, pricing) {
    var base = pricing && pricing.points_upscale != null ? pricing.points_upscale : 1;
    var map = pricing && pricing.upscale_points_by_scale;
    var opts = SCALES.map(function (s) {
      var pts = pointsForScale(base, s, map);
      return '<option value="' + s + '"' + (s === DEFAULT_SCALE ? ' selected' : '') + '>' + s + '×（' + pts + '點）</option>';
    }).join('');
    return (
      '<select class="form-select form-select-sm ' +
      (className || 'matchdo-upscale-scale') +
      '" style="width:auto;max-width:8rem;flex:0 0 auto" title="放大倍數">' +
      opts +
      '</select>'
    );
  }

  /** 倍數 + 放大鈕同一列，避免跟重繪／寫實化排在一起被誤會 */
  function controlsRowHtml(selectClass, buttonAndAfterHtml) {
    return (
      '<div class="d-flex align-items-center gap-1 flex-wrap w-100 mt-1 pending-upscale-controls" style="flex-basis:100%;">' +
      selectHtml(selectClass || 'matchdo-upscale-scale') +
      (buttonAndAfterHtml || '') +
      '</div>'
    );
  }

  function readScaleNear(el, selector) {
    if (!el) return DEFAULT_SCALE;
    var root = el.closest
      ? el.closest('.pending-upscale-controls, .pending-item, .edit-gallery-slot, .gallery-item, .card, tr, .col, .pending-image-card, div')
      : null;
    var sel =
      (root &&
        root.querySelector(
          selector ||
            '.matchdo-upscale-scale, .pending-upscale-scale, .edit-upscale-scale, .gallery-upscale-scale'
        )) ||
      (el.parentElement &&
        el.parentElement.querySelector(
          '.matchdo-upscale-scale, .pending-upscale-scale, .edit-upscale-scale, .gallery-upscale-scale'
        ));
    return normalizeScale(sel && sel.value);
  }

  function inputLimitMessage(width, height) {
    var w = width | 0;
    var h = height | 0;
    var maxSide = Math.max(w, h);
    if (maxSide <= MAX_INPUT_SIDE) return '';
    return (
      'Real-ESRGAN 建議輸入最長邊 ≤' +
      MAX_INPUT_SIDE +
      'px（約 1440p）。目前 ' +
      w +
      '×' +
      h +
      '，超過上限；繼續將先縮小再放大，細節可能變差。'
    );
  }

  function confirmIfOverInputLimit(width, height) {
    var msg = inputLimitMessage(width, height);
    if (!msg) return true;
    return window.confirm(msg + '\n\n仍要繼續放大？');
  }

  global.MatchdoUpscaleScale = {
    SCALES: SCALES,
    DEFAULT_SCALE: DEFAULT_SCALE,
    MAX_INPUT_SIDE: MAX_INPUT_SIDE,
    normalizeScale: normalizeScale,
    pointsForScale: pointsForScale,
    selectHtml: selectHtml,
    controlsRowHtml: controlsRowHtml,
    readScaleNear: readScaleNear,
    inputLimitMessage: inputLimitMessage,
    confirmIfOverInputLimit: confirmIfOverInputLimit
  };
})(typeof window !== 'undefined' ? window : global);
