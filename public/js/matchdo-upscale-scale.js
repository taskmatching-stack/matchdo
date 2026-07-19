/**
 * 待傳／編輯卡片：放大倍數列 + 清除／移除列（上傳區與編輯區必須共用，勿各寫一套）
 * 不改圖庫「原圖上／新圖下」同格結構。
 */
(function (global) {
  var SCALES = [2, 4, 6, 8, 10];
  var DEFAULT_SCALE = 2;
  var MAX_INPUT_SIDE = 1440;
  var STYLE_ID = 'matchdo-pending-actions-css';

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.pending-upscale-controls{flex-basis:100%;width:100%;display:flex!important;flex-wrap:nowrap!important;align-items:center;gap:4px;margin-top:4px;}',
      '.pending-upscale-controls .form-select{width:auto!important;max-width:7.5rem!important;flex:0 0 auto!important;display:inline-block!important;}',
      '.pending-upscale-controls .btn{flex:0 0 auto;}',
      '.pending-footer-actions{flex-basis:100%;width:100%;display:flex!important;flex-wrap:wrap;align-items:center;gap:4px;margin-top:4px;}',
      '.pending-footer-actions .btn{flex:0 0 auto;}'
    ].join('');
    document.head.appendChild(s);
  }

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
    ensureStyles();
    var base = pricing && pricing.points_upscale != null ? pricing.points_upscale : 1;
    var map = pricing && pricing.upscale_points_by_scale;
    var opts = SCALES.map(function (s) {
      var pts = pointsForScale(base, s, map);
      return '<option value="' + s + '"' + (s === DEFAULT_SCALE ? ' selected' : '') + '>' + s + '×（' + pts + '點）</option>';
    }).join('');
    return (
      '<select class="form-select form-select-sm ' +
      (className || 'matchdo-upscale-scale') +
      '" title="放大倍數">' +
      opts +
      '</select>'
    );
  }

  /** 倍數 + AI 放大（同一列；select 不可 width:100%） */
  function controlsRowHtml(selectClass, buttonAndAfterHtml, pricing) {
    ensureStyles();
    return (
      '<div class="pending-upscale-controls">' +
      selectHtml(selectClass || 'matchdo-upscale-scale', pricing) +
      (buttonAndAfterHtml || '') +
      '</div>'
    );
  }

  var CLEAR_LABELS = {
    redraw: '清除重繪',
    upscale: '清除放大',
    d2p: '清除寫實化'
  };

  /** 短標籤清除鈕（上傳／編輯同一文案，避免長句把「移除」擠到下一列） */
  function clearBtnHtml(kind, className, extraAttrs) {
    var label = CLEAR_LABELS[kind] || '清除';
    return (
      '<button type="button" class="btn btn-outline-warning btn-sm ' +
      (className || '') +
      '"' +
      (extraAttrs || '') +
      '>' +
      label +
      '</button>'
    );
  }

  /**
   * 清除重繪／寫實化／放大 + 封面 + 移除（同一列；上傳區／編輯區共用）
   * @param {{ clearRedraw?: string, clearUpscale?: string, clearD2p?: string, coverHtml?: string, removeHtml?: string }} parts
   */
  function footerActionsRowHtml(parts) {
    ensureStyles();
    parts = parts || {};
    return (
      '<div class="pending-footer-actions">' +
      (parts.clearRedraw || '') +
      (parts.clearUpscale || '') +
      (parts.clearD2p || '') +
      (parts.coverHtml || '') +
      (parts.removeHtml || '') +
      '</div>'
    );
  }

  /**
   * 依預覽旗標組 footer（上傳區／編輯區同一結構）
   * @param {{ redrawPreviewUrl?: *, upscalePreviewUrl?: *, d2pPreviewUrl?: * }} item
   * @param {{ redrawClass?: string, upscaleClass?: string, d2pClass?: string, redrawAttrs?: string, upscaleAttrs?: string, d2pAttrs?: string, coverHtml?: string, removeHtml?: string }} opts
   */
  function footerFromPreviewItem(item, opts) {
    opts = opts || {};
    item = item || {};
    return footerActionsRowHtml({
      clearRedraw: item.redrawPreviewUrl
        ? clearBtnHtml('redraw', opts.redrawClass || 'pending-clear-redraw', opts.redrawAttrs)
        : '',
      clearUpscale: item.upscalePreviewUrl
        ? clearBtnHtml('upscale', opts.upscaleClass || 'pending-clear-upscale', opts.upscaleAttrs)
        : '',
      clearD2p: item.d2pPreviewUrl
        ? clearBtnHtml('d2p', opts.d2pClass || 'pending-clear-d2p', opts.d2pAttrs)
        : '',
      coverHtml: opts.coverHtml || '',
      removeHtml: opts.removeHtml || ''
    });
  }

  function readScaleNear(el, selector) {
    if (!el) return DEFAULT_SCALE;
    var root = el.closest
      ? el.closest('.pending-upscale-controls, .pending-footer-actions, .pending-image-card, .col, div')
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

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureStyles);
    } else {
      ensureStyles();
    }
  }

  global.MatchdoUpscaleScale = {
    SCALES: SCALES,
    DEFAULT_SCALE: DEFAULT_SCALE,
    MAX_INPUT_SIDE: MAX_INPUT_SIDE,
    CLEAR_LABELS: CLEAR_LABELS,
    normalizeScale: normalizeScale,
    pointsForScale: pointsForScale,
    selectHtml: selectHtml,
    controlsRowHtml: controlsRowHtml,
    clearBtnHtml: clearBtnHtml,
    footerActionsRowHtml: footerActionsRowHtml,
    footerFromPreviewItem: footerFromPreviewItem,
    readScaleNear: readScaleNear,
    inputLimitMessage: inputLimitMessage,
    confirmIfOverInputLimit: confirmIfOverInputLimit,
    ensureStyles: ensureStyles
  };
})(typeof window !== 'undefined' ? window : global);
