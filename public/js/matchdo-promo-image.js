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

  /** 空間模式：4 MP（Gemini 2K）或 16 MP（Gemini 4K）；長邊 2048／4096 */
  var SPACE_MP_TIERS = [4, 16];

  function spaceTierFromMegapixels(mp) {
    return parseInt(mp, 10) >= 16 ? '4k' : '2k';
  }

  function spaceMegapixelsFromTier(tier) {
    return String(tier || '2k').trim().toLowerCase() === '4k' ? 16 : 4;
  }

  function dimsForSpaceRatio(ratio, tier) {
    var t = String(tier || '2k').trim().toLowerCase() === '4k' ? '4k' : '2k';
    var minLong = t === '4k' ? 4096 : 2048;
    var usedRatio = RATIO_PRESETS[ratio] ? ratio : '1:1';
    var p = RATIO_PRESETS[usedRatio];
    var aspect = p.w / p.h;
    var w;
    var h;
    if (aspect >= 1) {
      w = minLong;
      h = Math.round(minLong / aspect);
    } else {
      h = minLong;
      w = Math.round(minLong * aspect);
    }
    w = Math.max(512, Math.round(w / 8) * 8);
    h = Math.max(512, Math.round(h / 8) * 8);
    /* 勿用 megapixelsFromDims（會把邊長 clamp 到 2048，4K 會算錯成 4MP） */
    var mp = Math.max(1, Math.ceil((w * h) / ONE_MP));
    return {
      w: w,
      h: h,
      width: w,
      height: h,
      ratio: usedRatio,
      space_resolution_tier: t,
      tier: t,
      mp: mp
    };
  }

  function estimatePointsLocal(width, height, base, perExtra) {
    var mp = megapixelsFromDims(width, height);
    var b = Math.max(0, parseInt(base, 10) || 20);
    var e = Math.max(0, parseInt(perExtra, 10) || 10);
    return b + (mp - 1) * e;
  }

  /** 情境圖 TAB：固定每張點數說明（來自 /api/promo-image/options） */
  function formatPromoTabPricingHint(data) {
    var std = data && data.points_standard != null ? data.points_standard : 20;
    var sub = data && data.points_subscriber != null ? data.points_subscriber : 15;
    if (global.i18n && typeof global.i18n.t === 'function') {
      var tpl = global.i18n.t('customProduct.promoImagePricingPerImage');
      if (tpl && tpl !== 'customProduct.promoImagePricingPerImage') {
        return tpl.replace('{std}', std).replace('{sub}', sub);
      }
    }
    return '每張 ' + std + ' 點（訂閱會員 ' + sub + ' 點）';
  }

  /** 攝影模擬：依 MP 計價說明（來自 /api/promo-camera/options） */
  function formatPromoCameraPricingHint(data) {
    var std = data && data.points_standard != null ? data.points_standard : 20;
    var sub = data && data.points_subscriber != null ? data.points_subscriber : 10;
    var extra = data && data.points_per_extra_mp != null ? data.points_per_extra_mp : 10;
    if (global.i18n && typeof global.i18n.t === 'function') {
      var tpl = global.i18n.t('promoCamera.pricingHint');
      if (tpl && tpl !== 'promoCamera.pricingHint') {
        return tpl.replace('{std}', std).replace('{sub}', sub).replace('{extra}', extra);
      }
    }
    return '1 MP＝' + std + ' 點（訂閱 ' + sub + ' 點），每多 1 MP ＋' + extra + ' 點';
  }

  function estimatePromoCameraPointsLocal(width, height, options) {
    var opts = options || {};
    var base = opts.points_standard != null ? opts.points_standard : 20;
    var perExtra = opts.points_per_extra_mp != null ? opts.points_per_extra_mp : 10;
    return estimatePointsLocal(width, height, base, perExtra);
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

  function getPromoCameraParamGroup(row) {
    var meta = row && row.meta;
    if (meta && typeof meta === 'object') {
      if (meta.group_display != null && String(meta.group_display).trim()) return String(meta.group_display).trim();
      if (meta.group != null) return String(meta.group).trim();
    }
    return '';
  }

  /** 依 meta.group 分組；同 key 只保留一筆（避免 DB 重複） */
  function fillSelectGrouped(el, items, valueKey, labelKey, selectedKey, emptyLabel) {
    if (!el) return;
    var vk = valueKey || 'key';
    var lk = labelKey || 'name';
    var sel = selectedKey != null ? String(selectedKey) : String(el.value || '');
    var seen = {};
    var list = [];
    (items || []).forEach(function (it) {
      var k = String(it[vk] || '').trim();
      if (!k || seen[k]) return;
      seen[k] = true;
      list.push(it);
    });
    var groups = {};
    var groupOrder = [];
    list.forEach(function (it) {
      var g = getPromoCameraParamGroup(it) || '';
      if (!groups[g]) {
        groups[g] = [];
        groupOrder.push(g);
      }
      groups[g].push(it);
    });
    var html = emptyLabel ? ('<option value="">' + emptyLabel + '</option>') : '';
    var hasNamedGroup = groupOrder.some(function (g) { return !!g; });
    groupOrder.forEach(function (g) {
      var opts = groups[g] || [];
      if (!opts.length) return;
      var inner = opts.map(function (it) {
        var val = String(it[vk] || '').replace(/"/g, '&quot;');
        var label = String(it[lk] || it[vk] || '').replace(/</g, '&lt;');
        return '<option value="' + val + '"' + (val === sel ? ' selected' : '') + '>' + label + '</option>';
      }).join('');
      if (hasNamedGroup && g) {
        html += '<optgroup label="' + String(g).replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">' + inner + '</optgroup>';
      } else {
        html += inner;
      }
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

  function pointsPreview() {
    return authHeaders(false).then(function (headers) {
      return fetch('/api/promo-image/points-preview', { headers: headers }).then(function (r) {
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

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  /**
   * 情境圖／攝影模擬結果區（與 custom-product 情境圖 Tab 同一套 DOM）
   * opts: { loadingText, errorText, resultNoteHtml, imageAlt, actions: { labels, libraryHref } }
   */
  function renderPromoResultPanel(container, imageDataUrl, meta, opts) {
    if (!container) return;
    opts = opts || {};
    var noteHtml = opts.resultNoteHtml || '';
    if (opts.errorText) {
      container.classList.remove('has-result');
      container.innerHTML = '<p class="text-danger small mb-0">' + escHtml(opts.errorText) + '</p>' + noteHtml;
      return;
    }
    if (opts.loadingText) {
      container.classList.remove('has-result');
      container.innerHTML = '<p class="text-muted small mb-0">' + escHtml(opts.loadingText) + '</p>' + noteHtml;
      return;
    }
    if (!imageDataUrl && !(meta && meta.image_url)) return;

    var displayUrl = (meta && meta.image_url) || imageDataUrl;
    container.classList.add('has-result');
    container.innerHTML = '';
    var inner = document.createElement('div');
    inner.className = 'scene-sim-result-inner';

    if (meta && meta.compare_ref_url) {
      var compareWrap = document.createElement('div');
      compareWrap.className = 'pc-space-compare row g-2 mb-2';
      var refCol = document.createElement('div');
      refCol.className = 'col-md-6';
      var refLabel = document.createElement('p');
      refLabel.className = 'small text-muted mb-1';
      refLabel.textContent = meta.compare_ref_label || '對照圖';
      var refImg = document.createElement('img');
      refImg.src = meta.compare_ref_url;
      refImg.alt = meta.compare_ref_label || '對照圖';
      refImg.className = 'img-fluid rounded border';
      refImg.style.cursor = 'zoom-in';
      refCol.appendChild(refLabel);
      refCol.appendChild(refImg);
      var outCol = document.createElement('div');
      outCol.className = 'col-md-6';
      var outLabel = document.createElement('p');
      outLabel.className = 'small text-muted mb-1';
      outLabel.textContent = meta.compare_result_label || '生成結果';
      var img = document.createElement('img');
      img.src = displayUrl;
      img.alt = opts.imageAlt || meta.compare_result_label || '生成結果';
      img.className = 'img-fluid rounded js-preview-enlarge matchdo-enlarge-trigger border';
      img.style.cursor = 'zoom-in';
      img.setAttribute('aria-label', opts.imageAlt || '生成結果');
      if (opts.lightboxCaption) {
        img.setAttribute('data-lightbox-caption', opts.lightboxCaption);
      }
      outCol.appendChild(outLabel);
      outCol.appendChild(img);
      compareWrap.appendChild(refCol);
      compareWrap.appendChild(outCol);
      inner.appendChild(compareWrap);
    } else {
      var img = document.createElement('img');
      img.src = displayUrl;
      img.alt = opts.imageAlt || '情境圖';
      img.className = 'img-fluid rounded js-preview-enlarge matchdo-enlarge-trigger';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.cursor = 'zoom-in';
      img.setAttribute('aria-label', opts.imageAlt || '生成結果');
      if (opts.lightboxCaption) {
        img.setAttribute('data-lightbox-caption', opts.lightboxCaption);
      }
      inner.appendChild(img);
    }

    if (meta && meta.points_deducted != null) {
      var pts = document.createElement('p');
      pts.className = 'small text-muted mt-2 mb-0';
      pts.textContent = '已扣除 ' + meta.points_deducted + ' 點';
      inner.appendChild(pts);
    }

    if (meta && meta.image_url) {
      var urlRow = document.createElement('div');
      urlRow.className = 'mt-2';
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'form-control form-control-sm mb-1';
      inp.readOnly = true;
      inp.value = meta.image_url;
      urlRow.appendChild(inp);
      var copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn btn-sm btn-outline-secondary me-1';
      copyBtn.textContent = '複製網址';
      copyBtn.addEventListener('click', function () {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(meta.image_url);
          } else {
            inp.select();
            document.execCommand('copy');
          }
        } catch (err) { console.warn(err); }
      });
      var openLink = document.createElement('a');
      openLink.className = 'btn btn-sm btn-outline-primary me-1';
      openLink.target = '_blank';
      openLink.rel = 'noopener';
      openLink.textContent = '開啟';
      openLink.href = meta.image_url;
      urlRow.appendChild(copyBtn);
      urlRow.appendChild(openLink);
      inner.appendChild(urlRow);
    }

    container.appendChild(inner);
    appendPromoResultActions(inner, meta || {}, imageDataUrl, opts.actions || {});
    if (noteHtml) {
      var noteHost = document.createElement('div');
      noteHost.innerHTML = noteHtml;
      while (noteHost.firstChild) container.appendChild(noteHost.firstChild);
    }
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
    SPACE_MP_TIERS: SPACE_MP_TIERS,
    spaceTierFromMegapixels: spaceTierFromMegapixels,
    spaceMegapixelsFromTier: spaceMegapixelsFromTier,
    dimsForRatio: dimsForRatio,
    dimsForSpaceRatio: dimsForSpaceRatio,
    megapixelsFromDims: megapixelsFromDims,
    clampDim: clampDim,
    estimatePointsLocal: estimatePointsLocal,
    formatPromoTabPricingHint: formatPromoTabPricingHint,
    formatPromoCameraPricingHint: formatPromoCameraPricingHint,
    estimatePromoCameraPointsLocal: estimatePromoCameraPointsLocal,
    ratioSelectHtml: ratioSelectHtml,
    mpSelectHtml: mpSelectHtml,
    fillSelect: fillSelect,
    fillSelectGrouped: fillSelectGrouped,
    getPromoCameraParamGroup: getPromoCameraParamGroup,
    fillPhotographySelect: fillPhotographySelect,
    resolveDefaultPhotographySetId: resolveDefaultPhotographySetId,
    bindSelectHint: bindSelectHint,
    loadOptions: loadOptions,
    pointsPreview: pointsPreview,
    generate: generate,
    triggerPromoDownload: triggerPromoDownload,
    savePromoToLibrary: savePromoToLibrary,
    ensurePromoSavedToLibrary: ensurePromoSavedToLibrary,
    appendPromoResultActions: appendPromoResultActions,
    renderPromoResultPanel: renderPromoResultPanel
  };
})(typeof window !== 'undefined' ? window : this);
