/**
 * 材料封面：2～9 張單色樣張拼成 1:1 色卡（零 FLUX；格內 cover 滿格、等比裁切不拉伸）
 */
(function (global) {
  'use strict';

  var CANVAS_SIZE = 1024;
  var GAP = 3;
  var BG = '#EAEEF3';
  var MIN_COUNT = 2;
  var MAX_COUNT = 9;
  var COMPOSE_CHECK_CLASS = 'compose-into-cover-check';

  function getRowLayout(count) {
    var map = {
      2: [2],
      3: [3],
      4: [2, 2],
      5: [3, 2],
      6: [3, 3],
      7: [4, 3],
      8: [4, 4],
      9: [3, 3, 3]
    };
    return map[count] || null;
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      if (src instanceof HTMLImageElement && src.complete && src.naturalWidth) {
        resolve(src);
        return;
      }
      var img = new Image();
      img.crossOrigin = 'anonymous';
      if (typeof src === 'string') {
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error('無法載入圖片')); };
        img.src = src;
        return;
      }
      if (src instanceof Blob || src instanceof File) {
        var url = URL.createObjectURL(src);
        img.onload = function () {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = function () {
          URL.revokeObjectURL(url);
          reject(new Error('無法載入圖片'));
        };
        img.src = url;
        return;
      }
      reject(new Error('不支援的圖片來源'));
    });
  }

  /** 每一列橫向滿版；欄數較少的列加寬格子，避免下排左右留白 */
  function computeCellRects(size, gap, rowCounts) {
    var rows = rowCounts.length;
    var maxCols = Math.max.apply(null, rowCounts);
    var defaultCellW = (size - gap * (maxCols - 1)) / maxCols;
    var cellH = (size - gap * (rows - 1)) / rows;
    var rects = [];
    rowCounts.forEach(function (cols, rowIdx) {
      var y = rowIdx * (cellH + gap);
      var rowCellW = cols < maxCols
        ? (size - gap * (cols - 1)) / cols
        : defaultCellW;
      for (var c = 0; c < cols; c++) {
        rects.push({
          x: c * (rowCellW + gap),
          y: y,
          w: rowCellW,
          h: cellH
        });
      }
    });
    return rects;
  }

  /** object-fit: cover — 等比放大至填滿格內，裁切超出部分（不拉伸紋路） */
  function drawImageCover(ctx, img, rect) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var scale = Math.max(rect.w / iw, rect.h / ih);
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = rect.x + (rect.w - dw) / 2;
    var dy = rect.y + (rect.h - dh) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  function isAiDerivedItem(it) {
    if (!it) return false;
    var d = it.ai_derived != null ? String(it.ai_derived).trim() : '';
    return d === 'redraw' || d === 'upscale' || d === 'design_to_physical';
  }

  /** 已是拼好的多色封面（不應再當單色樣張預設勾選） */
  function isComposedCoverGridLabel(label) {
    var s = String(label || '').trim();
    return /^多色色卡|^多色展示/.test(s);
  }

  function isComposedCoverGridItem(item) {
    if (!item) return false;
    if (item.coverGridCompose) return true;
    return isComposedCoverGridLabel(item.label);
  }

  /**
   * 拼入封面勾選框。預設：單色樣張勾選；已是多色拼圖的封面不勾選。
   * （舊邏輯一律跳過封面欄 → 封面若是第一色，第一次會少那張、第二次才對）
   */
  function composeSwatchCheckHtml(opts) {
    opts = opts || {};
    var checked = opts.checked !== false;
    var title = opts.title || '勾選後會拼進封面色卡';
    return '<div class="form-check mt-1 mb-0 compose-into-cover-wrap">' +
      '<input class="form-check-input ' + COMPOSE_CHECK_CLASS + '" type="checkbox" value="1"' +
      (checked ? ' checked' : '') + ' title="' + String(title).replace(/"/g, '&quot;') + '">' +
      '<label class="form-check-label small">' +
      (opts.labelText || '拼入封面') +
      '</label></div>';
  }

  function defaultComposeCheckChecked(item, isCover) {
    if (isComposedCoverGridItem(item)) return false;
    return true;
  }

  async function composeGrid(imageSources) {
    var count = imageSources.length;
    if (count < MIN_COUNT || count > MAX_COUNT) {
      throw new Error('需要 ' + MIN_COUNT + '～' + MAX_COUNT + ' 張單色樣張');
    }
    var rowCounts = getRowLayout(count);
    if (!rowCounts) throw new Error('不支援 ' + count + ' 張排版');

    var canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    var imgs = await Promise.all(imageSources.map(loadImage));
    var rects = computeCellRects(CANVAS_SIZE, GAP, rowCounts);
    for (var i = 0; i < imgs.length; i++) {
      drawImageCover(ctx, imgs[i], rects[i]);
    }

    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) reject(new Error('合成失敗'));
        else resolve(blob);
      }, 'image/jpeg', 0.92);
    });
  }

  function gridHasComposeChecks(gridEl) {
    return !!(gridEl && gridEl.querySelector('.' + COMPOSE_CHECK_CLASS));
  }

  function colComposeChecked(col) {
    if (!col) return false;
    var cb = col.querySelector('.' + COMPOSE_CHECK_CLASS);
    if (!cb) return true;
    return !!cb.checked;
  }

  /** 待傳清單：有 selectedIds 則依勾選；否則略過已拼多色封面，其餘單色都納入（含原封面色） */
  function collectPendingSwatchSources(list, opts) {
    opts = opts || {};
    var sources = [];
    (list || []).forEach(function (item, idx) {
      if (isAiDerivedItem(item)) return;
      if (opts.selectedIds) {
        if (opts.selectedIds.indexOf(item.id) < 0) return;
      } else if (opts.skipComposedCover !== false && isComposedCoverGridItem(item) && idx === 0) {
        return;
      }
      if (item.file) sources.push(item.file);
    });
    return sources.slice(0, MAX_COUNT);
  }

  function coverLabelForCount(n) {
    return '多色色卡（' + n + '色）';
  }

  function normalizeComposeKind(kind) {
    return String(kind || '').trim().toLowerCase();
  }

  /** 材料 + 數位版型（官方／廠商 prototype） */
  function coverGridComposeEnabledForKind(kind) {
    var k = normalizeComposeKind(kind);
    return k === 'material' || k === 'prototype';
  }

  function coverComposeButtonLabel(kind) {
    return normalizeComposeKind(kind) === 'prototype'
      ? '拼封面（2～9 張）'
      : '拼封面色卡（2～9 張）';
  }

  function coverLabelForKind(kind, n) {
    return normalizeComposeKind(kind) === 'prototype'
      ? ('多色展示（' + n + '款）')
      : coverLabelForCount(n);
  }

  /** 封面欄上方拼封面按鈕；其餘欄用等高 spacer 對齊圖卡 */
  function materialCoverComposeSlotHtml(isCover, forEdit, opts) {
    opts = opts || {};
    if (isCover) {
      var idAttr = forEdit ? ' id="btn-edit-compose-material-cover"' : '';
      var label = opts.buttonLabel || coverComposeButtonLabel(opts.kind);
      return '<div class="material-cover-compose-slot">' +
        '<button type="button" class="btn btn-outline-primary btn-sm btn-compose-material-cover"' + idAttr + ' disabled>' +
        '<i class="bi bi-grid-3x3-gap me-1"></i>' + label + '</button></div>';
    }
    return '<div class="material-cover-compose-slot material-cover-compose-slot--spacer" aria-hidden="true"></div>';
  }

  function countMaterialSwatchCols(gridEl) {
    if (!gridEl) return 0;
    var cols = gridEl.querySelectorAll(':scope > [class*="col-"]');
    if (gridHasComposeChecks(gridEl)) {
      var n = 0;
      cols.forEach(function (col) {
        if (colComposeChecked(col)) n++;
      });
      return n;
    }
    return Math.max(0, cols.length - 1);
  }

  function resolveColSource(col, opts) {
    opts = opts || {};
    if (opts.resolveLocalFile) {
      var localId = col.getAttribute('data-local-id');
      if (localId) {
        var localFile = opts.resolveLocalFile(localId);
        if (localFile) return localFile;
      }
    }
    if (opts.resolvePendingFile) {
      var pendingId = col.getAttribute('data-pending-id');
      if (pendingId) {
        var pendingFile = opts.resolvePendingFile(pendingId);
        if (pendingFile) return pendingFile;
      }
    }
    var url = col.getAttribute('data-gallery-url');
    return url || null;
  }

  /**
   * 編輯／待傳 grid：有「拼入封面」勾選則依勾選（可含封面欄）。
   * 無勾選框時：略過已是多色拼圖的封面欄，其餘欄都納入（含單色封面＝第一色）。
   */
  function collectMaterialSwatchSourcesFromGrid(gridEl, opts) {
    opts = opts || {};
    var sources = [];
    if (!gridEl) return sources;
    var cols = gridEl.querySelectorAll(':scope > [class*="col-"]');
    var useChecks = gridHasComposeChecks(gridEl);
    cols.forEach(function (col, idx) {
      if (useChecks) {
        if (!colComposeChecked(col)) return;
      } else if (idx === 0 && !opts.includeCoverColumn) {
        return;
      }
      var src = resolveColSource(col, opts);
      if (src) sources.push(src);
    });
    return sources.slice(0, MAX_COUNT);
  }

  function syncMaterialCoverComposeButton(btn, gridEl) {
    if (!btn) return;
    var n = countMaterialSwatchCols(gridEl);
    btn.disabled = n < MIN_COUNT;
    btn.title = n >= MIN_COUNT
      ? ('將 ' + Math.min(n, MAX_COUNT) + ' 張圖片拼成 1:1 封面（不扣點）')
      : ('請勾選至少 ' + MIN_COUNT + ' 張要拼入的顏色；目前 ' + n + ' 張');
  }

  global.MatchdoMaterialCoverGridCompose = {
    CANVAS_SIZE: CANVAS_SIZE,
    MIN_COUNT: MIN_COUNT,
    MAX_COUNT: MAX_COUNT,
    COMPOSE_CHECK_CLASS: COMPOSE_CHECK_CLASS,
    getRowLayout: getRowLayout,
    composeGrid: composeGrid,
    collectPendingSwatchSources: collectPendingSwatchSources,
    materialCoverComposeSlotHtml: materialCoverComposeSlotHtml,
    countMaterialSwatchCols: countMaterialSwatchCols,
    collectMaterialSwatchSourcesFromGrid: collectMaterialSwatchSourcesFromGrid,
    syncMaterialCoverComposeButton: syncMaterialCoverComposeButton,
    coverLabelForCount: coverLabelForCount,
    coverGridComposeEnabledForKind: coverGridComposeEnabledForKind,
    coverComposeButtonLabel: coverComposeButtonLabel,
    coverLabelForKind: coverLabelForKind,
    isAiDerivedItem: isAiDerivedItem,
    isComposedCoverGridLabel: isComposedCoverGridLabel,
    isComposedCoverGridItem: isComposedCoverGridItem,
    composeSwatchCheckHtml: composeSwatchCheckHtml,
    defaultComposeCheckChecked: defaultComposeCheckChecked,
    gridHasComposeChecks: gridHasComposeChecks
  };
})(typeof window !== 'undefined' ? window : this);
