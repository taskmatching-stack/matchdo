/**
 * AI 放大倍數選單（僅 UI 輔助；不改圖庫同格結構）
 * 2× 基準點 + 每升一階 +1
 */
(function (global) {
  var SCALES = [2, 4, 6, 8, 10];
  var DEFAULT_SCALE = 2;

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
      '" style="width:auto;max-width:8rem;display:inline-block;vertical-align:middle" title="放大倍數">' +
      opts +
      '</select>'
    );
  }

  function readScaleNear(el, selector) {
    if (!el) return DEFAULT_SCALE;
    var root = el.closest ? el.closest('.pending-item, .edit-gallery-slot, .gallery-item, .card, tr, .col, div') : null;
    var sel = (root && root.querySelector(selector || '.matchdo-upscale-scale, .pending-upscale-scale, .edit-upscale-scale, .gallery-upscale-scale')) ||
      (el.parentElement && el.parentElement.querySelector('.matchdo-upscale-scale, .pending-upscale-scale, .edit-upscale-scale, .gallery-upscale-scale'));
    return normalizeScale(sel && sel.value);
  }

  global.MatchdoUpscaleScale = {
    SCALES: SCALES,
    DEFAULT_SCALE: DEFAULT_SCALE,
    normalizeScale: normalizeScale,
    pointsForScale: pointsForScale,
    selectHtml: selectHtml,
    readScaleNear: readScaleNear
  };
})(typeof window !== 'undefined' ? window : global);
