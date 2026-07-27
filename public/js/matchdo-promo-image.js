/**
 * Matchdo 產品情境圖 — 共用前端輔助（比例／解析度 MP／點數預覽／API）
 * 僅供情境圖 TAB 使用；不改動既有寫實化／圖樣提取邏輯。
 */
(function (global) {
  'use strict';

  /** 各長寬比約 1 MP 基準尺寸（與後端 options.ratio_presets 對齊） */
  var RATIO_PRESETS = {
    '1:1': { w: 1024, h: 1024 },
    '4:3': { w: 1152, h: 864 },
    '3:4': { w: 864, h: 1152 },
    '16:9': { w: 1344, h: 756 },
    '9:16': { w: 756, h: 1344 },
    '21:9': { w: 1536, h: 658 },
    '3:1': { w: 1728, h: 576 },
    '4:1': { w: 2048, h: 512 },
    '9:21': { w: 658, h: 1536 },
    '1:3': { w: 576, h: 1728 },
    '1:4': { w: 512, h: 2048 }
  };

  var MP_TIERS = [1, 2, 3, 4];
  var ONE_MP = 1024 * 1024;
  var MAX_SIDE = 2048;
  var MIN_SIDE = 512;

  function clampDim(n, fallback) {
    var v = parseInt(n, 10);
    if (!isFinite(v)) v = fallback || 1024;
    return Math.min(MAX_SIDE, Math.max(MIN_SIDE, v));
  }

  function roundToStep(n, step) {
    step = step || 8;
    return Math.round(n / step) * step;
  }

  function megapixelsFromDims(width, height) {
    var w = clampDim(width, 1024);
    var h = clampDim(height, 1024);
    return Math.min(4, Math.ceil((w * h) / ONE_MP) || 1);
  }

  function fitAspect(w, h, aspect) {
    if (aspect >= 1) {
      h = clampDim(roundToStep(w / aspect, 8), MIN_SIDE);
      if (h > MAX_SIDE) {
        h = MAX_SIDE;
        w = clampDim(roundToStep(h * aspect, 8), MIN_SIDE);
      }
    } else {
      w = clampDim(roundToStep(h * aspect, 8), MIN_SIDE);
      if (w > MAX_SIDE) {
        w = MAX_SIDE;
        h = clampDim(roundToStep(w / aspect, 8), MIN_SIDE);
      }
    }
    return { w: w, h: h };
  }

  /**
   * 依長寬比與目標 MP 計算輸出尺寸（最長邊 ≤ 2048）。
   * 計價用 ceil(像素/1MP)，故輸出嚴格壓在所選檔位內；非 1:1 的 4MP 可能因長邊上限只能到約 3MP。
   */
  function dimsForRatio(ratio, megapixels) {
    var p = RATIO_PRESETS[ratio] || RATIO_PRESETS['1:1'];
    var usedRatio = RATIO_PRESETS[ratio] ? ratio : '1:1';
    var targetMp = Math.min(4, Math.max(1, parseInt(megapixels, 10) || 1));
    if (targetMp <= 1) {
      return { w: p.w, h: p.h, ratio: usedRatio, mp: megapixelsFromDims(p.w, p.h) };
    }
    if (usedRatio === '1:1' && targetMp === 4) {
      return { w: 2048, h: 2048, ratio: usedRatio, mp: 4 };
    }

    var aspect = p.w / p.h;
    // 目標像素取檔位上界的 99%，避免捨入後 ceil 跳檔
    var aimPixels = targetMp * ONE_MP * 0.99;
    var w = Math.sqrt(aimPixels * aspect);
    var h = w / aspect;
    var scale = Math.min(1, MAX_SIDE / w, MAX_SIDE / h);
    var fitted = fitAspect(
      clampDim(roundToStep(w * scale, 8), p.w),
      clampDim(roundToStep(h * scale, 8), p.h),
      aspect
    );
    w = fitted.w;
    h = fitted.h;

    // 若仍超過目標檔（捨入誤差），逐步縮小
    var guard = 0;
    while (megapixelsFromDims(w, h) > targetMp && guard < 24) {
      w = Math.max(MIN_SIDE, w - 8);
      fitted = fitAspect(w, h, aspect);
      w = fitted.w;
      h = fitted.h;
      guard += 1;
    }

    return { w: w, h: h, ratio: usedRatio, mp: megapixelsFromDims(w, h) };
  }

  function estimatePointsLocal(width, height, base, perExtra) {
    var mp = megapixelsFromDims(width, height);
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

  function mpSelectHtml(selected, className) {
    var sel = String(parseInt(selected, 10) || 1);
    var labels = {
      1: '1 MP（標準）',
      2: '2 MP',
      3: '3 MP',
      4: '4 MP'
    };
    var opts = MP_TIERS.map(function (n) {
      var k = String(n);
      return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + (labels[n] || (k + ' MP')) + '</option>';
    }).join('');
    return '<select class="form-select form-select-sm ' + (className || 'promo-mp-select') + '">' + opts + '</select>';
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

  /** 情境圖攝影參數：預設「通用預設」；「（不追加）」固定在最下方 */
  function resolveDefaultPhotographySetId(items) {
    var list = items || [];
    var exact = list.find(function (it) { return String(it.name || '').trim() === '通用預設'; });
    if (exact && exact.id) return String(exact.id);
    var byKey = list.find(function (it) {
      var k = String(it.key || '').trim().toLowerCase();
      return k === 'general_default' || k === 'promo_default' || k === 'default';
    });
    if (byKey && byKey.id) return String(byKey.id);
    if (list.length && list[0].id) return String(list[0].id);
    return '';
  }

  function fillPhotographySelect(el, items, emptyLabel) {
    if (!el) return;
    var list = items || [];
    var label = emptyLabel || '（不追加）';
    var defaultId = resolveDefaultPhotographySetId(list);
    var html = '';
    list.forEach(function (it) {
      var val = String(it.id || '').replace(/"/g, '&quot;');
      var selected = defaultId && val === defaultId ? ' selected' : '';
      html += '<option value="' + val + '"' + selected + '>' +
        String(it.name || it.key || val).replace(/</g, '&lt;') + '</option>';
    });
    html += '<option value="">' + label + '</option>';
    el.innerHTML = html;
  }

  /** 依選項 description 更新提示文字（名稱不進 FLUX，說明只給人看） */
  function bindSelectHint(selectEl, hintEl, items, valueKey) {
    if (!selectEl || !hintEl) return;
    var vk = valueKey || 'key';
    var list = items || [];
    function refresh() {
      var v = String(selectEl.value || '').trim();
      var found = list.find(function (it) { return String(it[vk] || '') === v; });
      hintEl.textContent = (found && found.description) ? String(found.description) : '';
    }
    selectEl.removeEventListener('change', selectEl.__promoHintHandler);
    selectEl.__promoHintHandler = refresh;
    selectEl.addEventListener('change', refresh);
    refresh();
  }

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

  function loadOptions(lang, bustCache) {
    var q = '';
    if (lang != null && String(lang).trim()) {
      q = '?lang=' + encodeURIComponent(String(lang).trim().toLowerCase().replace(/-.*$/, ''));
    }
    if (bustCache) {
      q += (q ? '&' : '?') + '_=' + Date.now();
    }
    return authHeaders(false).then(function (headers) {
      return fetch('/api/promo-image/options' + q, { headers: headers, cache: 'no-store' }).then(function (r) {
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

  function triggerPromoDownload(displayUrl, imageDataUrl, filename) {
    var name = filename || 'promo-image.jpg';
    try {
      if (displayUrl && !String(displayUrl).startsWith('data:')) {
        fetch(displayUrl, { mode: 'cors' }).then(function (r) { return r.blob(); }).then(function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = name;
          a.click();
          URL.revokeObjectURL(url);
        }).catch(function () {
          var a = document.createElement('a');
          a.href = displayUrl;
          a.download = name;
          a.target = '_blank';
          a.rel = 'noopener';
          a.click();
        });
        return;
      }
      var dataUrl = imageDataUrl || displayUrl || '';
      var mimeMatch = dataUrl.match(/^data:image\/(jpeg|jpg|png);base64,/i);
      var ext = (mimeMatch && mimeMatch[1]) ? (mimeMatch[1].toLowerCase() === 'png' ? 'png' : 'jpg') : 'jpg';
      var mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      var base64 = dataUrl.split(',')[1];
      if (!base64) return;
      var bin = atob(base64);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      var blob = new Blob([arr], { type: mime });
      var url = URL.createObjectURL(blob);
      var a2 = document.createElement('a');
      a2.href = url;
      a2.download = 'promo-image.' + ext;
      a2.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.warn(err); }
  }

  function savePromoToLibrary(meta, imageDataUrl) {
    var payload = {
      id: meta && meta.id ? meta.id : undefined,
      imageData: imageDataUrl || undefined,
      width: meta && meta.width,
      height: meta && meta.height,
      aspect_ratio: meta && meta.aspect_ratio,
      theme_key: meta && (meta.theme_key || meta.scene_template_key),
      scene_key: meta && meta.scene_key,
      user_prompt: meta && meta.user_prompt
    };
    return authHeaders(true).then(function (headers) {
      return fetch('/api/promo-image/save-to-library', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      });
    });
  }

  /** 生成後若後端未寫入資產庫，自動補存 */
  function ensurePromoSavedToLibrary(meta, imageDataUrl) {
    if (meta && meta.id && meta.image_url) {
      return Promise.resolve({ ok: true, data: { success: true, id: meta.id, image_url: meta.image_url, already_saved: true } });
    }
    if (!imageDataUrl) {
      return Promise.resolve({ ok: false, data: { error: '無圖片可儲存' } });
    }
    return savePromoToLibrary(meta, imageDataUrl);
  }

  /**
   * 情境圖結果區：下載 + 儲存到數位資產庫按鈕（回傳 DOM 元素）
   * opts: { labels: { download, save, saved, viewLibrary }, libraryHref }
   */
  function appendPromoResultActions(container, meta, imageDataUrl, opts) {
    if (!container) return;
    opts = opts || {};
    var labels = opts.labels || {};
    var downloadLabel = labels.download || '下載圖片';
    var saveLabel = labels.save || '儲存到數位資產庫';
    var savedLabel = labels.saved || '已存入數位資產庫';
    var viewLabel = labels.viewLibrary || '查看資產庫';
    var libraryHref = opts.libraryHref || '/client/my-custom-products.html?tab=promo';
    var displayUrl = (meta && meta.image_url) || imageDataUrl || '';
    var row = document.createElement('div');
    row.className = 'd-flex flex-wrap gap-2 mt-2 promo-result-actions';

    var dlBtn = document.createElement('button');
    dlBtn.type = 'button';
    dlBtn.className = 'btn btn-sm btn-outline-primary';
    dlBtn.innerHTML = '<i class="fas fa-download me-1"></i>' + downloadLabel;
    dlBtn.addEventListener('click', function (e) {
      e.preventDefault();
      triggerPromoDownload(displayUrl, imageDataUrl, 'promo-image.jpg');
    });
    row.appendChild(dlBtn);

    var alreadySaved = !!(meta && meta.id && meta.image_url);
    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-sm ' + (alreadySaved ? 'btn-success' : 'btn-outline-success');
    saveBtn.innerHTML = '<i class="fas fa-' + (alreadySaved ? 'check' : 'box') + ' me-1"></i>' +
      (alreadySaved ? savedLabel : saveLabel);
    if (alreadySaved) saveBtn.disabled = true;
    saveBtn.addEventListener('click', function () {
      if (saveBtn.disabled) return;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>…';
      savePromoToLibrary(meta, imageDataUrl).then(function (res) {
        var data = res.data || {};
        if (res.ok && data.success) {
          if (data.id && meta) meta.id = data.id;
          if (data.image_url && meta) meta.image_url = data.image_url;
          saveBtn.className = 'btn btn-sm btn-success';
          saveBtn.innerHTML = '<i class="fas fa-check me-1"></i>' + savedLabel;
        } else {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fas fa-box me-1"></i>' + saveLabel;
          alert(data.error || '儲存失敗');
        }
      }).catch(function () {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-box me-1"></i>' + saveLabel;
        alert('儲存失敗');
      });
    });
    row.appendChild(saveBtn);

    var viewLink = document.createElement('a');
    viewLink.className = 'btn btn-sm btn-outline-secondary';
    viewLink.href = libraryHref;
    viewLink.innerHTML = '<i class="bi bi-images me-1"></i>' + viewLabel;
    row.appendChild(viewLink);

    container.appendChild(row);
    return row;
  }

  global.MatchdoPromoImage = {
    RATIO_PRESETS: RATIO_PRESETS,
    MP_TIERS: MP_TIERS,
    dimsForRatio: dimsForRatio,
    megapixelsFromDims: megapixelsFromDims,
    clampDim: clampDim,
    estimatePointsLocal: estimatePointsLocal,
    ratioSelectHtml: ratioSelectHtml,
    mpSelectHtml: mpSelectHtml,
    fillSelect: fillSelect,
    fillPhotographySelect: fillPhotographySelect,
    resolveDefaultPhotographySetId: resolveDefaultPhotographySetId,
    bindSelectHint: bindSelectHint,
    loadOptions: loadOptions,
    pointsPreview: pointsPreview,
    generate: generate,
    triggerPromoDownload: triggerPromoDownload,
    savePromoToLibrary: savePromoToLibrary,
    ensurePromoSavedToLibrary: ensurePromoSavedToLibrary,
    appendPromoResultActions: appendPromoResultActions
  };
})(typeof window !== 'undefined' ? window : this);
