/**
 * 材料封面：4～9 張單色樣張拼成 1:1 色卡（零 FLUX；格內 contain 不裁切）
 */
(function (global) {
  'use strict';

  var CANVAS_SIZE = 1024;
  var GAP = 3;
  var BG = '#EAEEF3';
  var MIN_COUNT = 4;
  var MAX_COUNT = 9;

  function getRowLayout(count) {
    var map = {
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

  function computeCellRects(size, gap, rowCounts) {
    var rows = rowCounts.length;
    var cellH = (size - gap * (rows - 1)) / rows;
    var rects = [];
    rowCounts.forEach(function (cols, rowIdx) {
      var y = rowIdx * (cellH + gap);
      var cellW = (size - gap * (cols - 1)) / cols;
      var rowTotalW = cols * cellW + gap * (cols - 1);
      var offsetX = (size - rowTotalW) / 2;
      for (var c = 0; c < cols; c++) {
        rects.push({
          x: offsetX + c * (cellW + gap),
          y: y,
          w: cellW,
          h: cellH
        });
      }
    });
    return rects;
  }

  function drawImageContain(ctx, img, rect) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var scale = Math.min(rect.w / iw, rect.h / ih);
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = rect.x + (rect.w - dw) / 2;
    var dy = rect.y + (rect.h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function isAiDerivedItem(it) {
    if (!it) return false;
    var d = it.ai_derived != null ? String(it.ai_derived).trim() : '';
    return d === 'redraw' || d === 'upscale' || d === 'design_to_physical';
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
      drawImageContain(ctx, imgs[i], rects[i]);
    }

    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) reject(new Error('合成失敗'));
        else resolve(blob);
      }, 'image/jpeg', 0.92);
    });
  }

  /** 待傳清單：跳過封面（index 0），取有原圖的單色樣張 */
  function collectPendingSwatchSources(list, opts) {
    opts = opts || {};
    var sources = [];
    (list || []).forEach(function (item, idx) {
      if (idx === 0) return;
      if (opts.requireSelectable && item.designer_selectable === false) return;
      if (isAiDerivedItem(item)) return;
      if (item.file) sources.push(item.file);
    });
    return sources.slice(0, MAX_COUNT);
  }

  function coverLabelForCount(n) {
    return '多色色卡（' + n + '色）';
  }

  global.MatchdoMaterialCoverGridCompose = {
    CANVAS_SIZE: CANVAS_SIZE,
    MIN_COUNT: MIN_COUNT,
    MAX_COUNT: MAX_COUNT,
    getRowLayout: getRowLayout,
    composeGrid: composeGrid,
    collectPendingSwatchSources: collectPendingSwatchSources,
    coverLabelForCount: coverLabelForCount,
    isAiDerivedItem: isAiDerivedItem
  };
})(typeof window !== 'undefined' ? window : this);
