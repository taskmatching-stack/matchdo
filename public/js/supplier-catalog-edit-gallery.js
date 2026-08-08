/**
 * 供應商編輯 Modal 圖庫 AI 重繪／放大（對齊 manufacturer-materials 編輯區）
 */
(function (global) {
  'use strict';
  function getCfg() {
    return global.MatchdoSupplierCatalogEditGalleryConfig || {};
  }
  var Pending = global.MatchdoVendorAssetPending;
  var editGallerySlotPreview = {};
  var editGalleryUploading = false;
  var editGalleryHighlightUrls = new Set();
  var galleryUpscaleProbe = {};
  var VENDOR_AI_UPSCALE_BTN = 'AI 放大';
  var VENDOR_UPSCALE_RULE_TEXT = '依原圖比例放大，總解析度最高 1MP';

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function showToast(m, t) { if (getCfg().showToast) getCfg().showToast(m, t); }
  function getToken() { return getCfg().getToken ? getCfg().getToken() : null; }
  function uploadPricing() { return getCfg().uploadPricing || {}; }
  function catalogItemAssetKind(item) {
    if (!item) return 'prototype';
    var k = item.item_kind || '';
    if (k === 'material') return 'material';
    if (k === 'part') return 'part';
    return 'prototype';
  }
  function catalogImageItems(item) {
    if (!item) return [];
    var items = [];
    var cover = (item.cover_image_url || '').trim();
    var gallery = item.gallery_images || [];
    if (cover) {
      items.push({
        url: cover,
        label: (item.cover_image_label || '').trim() || Pending.labelFromFilename(cover),
        is_cover: true,
        sort_order: 0
      });
    }
    gallery.forEach(function (g) {
      if (!g || !g.url || g.url === cover) return;
      items.push({
        url: g.url,
        label: (g.label || '').trim() || Pending.labelFromFilename(g.url),
        is_cover: false,
        sort_order: g.sort_order != null ? g.sort_order : items.length
      });
    });
    if (!items.length && item.image_urls && item.image_urls.length) {
      item.image_urls.forEach(function (url, idx) {
        items.push({ url: url, label: Pending.labelFromFilename(url), is_cover: idx === 0, sort_order: idx });
      });
    }
    return items;
  }
  function catalogImageUrls(item) {
    return catalogImageItems(item).map(function (it) { return it.url; });
  }
  function apiItemBase(id) {
    return '/api/me/industry-supplier/catalog-items/' + encodeURIComponent(id);
  }
  function setEditGalleryStatus(msg, type) {
    var el = document.getElementById('edit-gallery-status');
    if (!el) return;
    if (!msg) { el.classList.add('d-none'); el.textContent = ''; return; }
    el.className = 'alert border-0 small py-2 mb-2 alert-' + (type || 'info');
    el.textContent = msg;
    el.classList.remove('d-none');
  }
  function syncEditGalleryRedrawSettings() {
    var up = uploadPricing();
    var extra = up.points_optimize_extra != null ? up.points_optimize_extra : 5;
    var upscale = up.points_upscale != null ? up.points_upscale : 1;
    document.querySelectorAll('.edit-gallery-redraw-points-extra').forEach(function (el) {
      el.textContent = String(extra);
    });
    document.querySelectorAll('.edit-gallery-upscale-points').forEach(function (el) {
      el.textContent = String(upscale);
    });
    var hint = document.getElementById('edit-gallery-ai-vs-preview-hint');
    if (hint) {
      syncEditGalleryUpscaleHint();
    }
    var settings = document.getElementById('edit-gallery-redraw-settings');
    var grid = document.getElementById('edit-gallery-grid');
    var hasItems = grid && grid.querySelector('.pending-image-card');
    if (settings) settings.classList.toggle('d-none', !hasItems);
  }
  function trLocal(k, fb) {
    var trFn = getCfg().tr;
    return trFn ? trFn(k, fb) : fb;
  }
  function syncEditGalleryUpscaleHint() {
    var hint = document.getElementById('edit-gallery-ai-vs-preview-hint');
    if (!hint) return;
    var kindEl = document.getElementById('edit-kind');
    var isMaterial = kindEl && kindEl.value === 'material';
    var up = uploadPricing();
    var extra = up.points_optimize_extra != null ? up.points_optimize_extra : 5;
    var upscale = up.points_upscale != null ? up.points_upscale : 1;
    if (isMaterial) {
      hint.innerHTML = '「<strong>預覽放大</strong>」：點圖片只看大圖，不扣點。「<strong>AI 重繪</strong>」：先預覽，勾選「上傳原圖／上傳此張」後按「<strong>儲存</strong>」寫入。重繪約 <span class="edit-gallery-redraw-points-extra">' + extra + '</span> 點起。';
    } else {
      hint.innerHTML = '「<strong>預覽放大</strong>」：點圖片只看大圖，不扣點。「<strong>AI 重繪</strong>」：先預覽，勾選「上傳原圖／上傳此張」後按「<strong>儲存</strong>」寫入（與上方新增待傳相同）。重繪約 <span class="edit-gallery-redraw-points-extra">' + extra + '</span> 點起；&lt;0.5 MP 可按 AI 放大（2× 起 ' + upscale + ' 點，每升一階 +1；≤1MP）。≥0.5 MP 請至 <a href="/client/ai-edit.html" target="_blank" rel="noopener">我的 AI 編輯區</a>。';
    }
  }
  function pendingUpscaleAiEditHelpHtml() {
    return '';
  }
  function pendingAiPairRowHtml(innerHtml) {
    return '<div class="pending-ai-pair">' + (innerHtml || '') + '</div>';
  }
  function gridDisableEditGalleryActions(disabled) {
    var inputMulti = document.getElementById('edit-gallery-add');
    var btnPendingOnly = document.getElementById('btn-edit-upload-pending-only');
    var btnPendingClear = document.getElementById('btn-edit-clear-pending');
    if (inputMulti) inputMulti.disabled = disabled;
    if (btnPendingOnly) btnPendingOnly.disabled = disabled;
    if (btnPendingClear) btnPendingClear.disabled = disabled;
    var grid = document.getElementById('edit-gallery-grid');
    if (grid) {
      grid.querySelectorAll('.btn-gallery-redraw-one, .btn-gallery-upscale-one, .btn-gallery-del, .btn-gallery-set-cover, .btn-gallery-move-left, .btn-gallery-move-right').forEach(function (el) {
        el.disabled = disabled;
      });
      grid.querySelectorAll('.edit-gallery-col').forEach(function (col) {
        col.draggable = !disabled;
      });
    }
  }
  var editGalleryDragUrl = null;
  function collectEditGalleryOrderFromGrid(grid) {
    if (!grid) return [];
    return Array.from(grid.querySelectorAll('.edit-gallery-col')).map(function (el) {
      return el.getAttribute('data-gallery-url');
    }).filter(Boolean);
  }
  function applyEditItemFromApi(item) {
    if (item && getCfg().updateEditItem) getCfg().updateEditItem(item);
    return item;
  }
  async function persistGalleryOrderFromUrls(orderedUrls) {
    var id = document.getElementById('edit-id').value;
    if (!id || !orderedUrls || !orderedUrls.length) return;
    if (editGalleryUploading) {
      setEditGalleryStatus('上一批仍在處理中，請稍候', 'warning');
      return;
    }
    editGalleryUploading = true;
    gridDisableEditGalleryActions(true);
    setEditGalleryStatus('儲存順序中…', 'info');
    try {
      var tok = getToken();
      if (!tok) { setEditGalleryStatus('請先登入', 'danger'); return; }
      var getItemFn = getCfg().getEditItem;
      var prevItem = typeof getItemFn === 'function' ? getItemFn() : null;
      var r = await fetch(apiItemBase(id) + '/gallery-images/order', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: orderedUrls })
      });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok) {
        var errMsg = data.error || data.message || ('排序儲存失敗 (HTTP ' + r.status + ')');
        setEditGalleryStatus(errMsg, 'danger');
        showToast(errMsg, 'danger');
        if (prevItem) renderEditGallery(prevItem);
        return;
      }
      var item = applyEditItemFromApi(data.item);
      renderEditGallery(item);
      setEditGalleryStatus('已更新順序', 'success');
    } catch (err) {
      setEditGalleryStatus(err.message || '排序儲存失敗', 'danger');
      showToast(err.message, 'danger');
    } finally {
      editGalleryUploading = false;
      gridDisableEditGalleryActions(false);
    }
  }
  async function moveGalleryImage(url, delta) {
    var getItemFn = getCfg().getEditItem;
    var item = typeof getItemFn === 'function' ? getItemFn() : null;
    if (!item || !url) return;
    var urls = catalogImageUrls(item);
    var idx = urls.indexOf(url);
    if (idx < 0) return;
    var newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= urls.length) return;
    var next = urls.slice();
    var tmp = next[idx];
    next[idx] = next[newIdx];
    next[newIdx] = tmp;
    await persistGalleryOrderFromUrls(next);
  }
  async function setGalleryCover(url) {
    var id = document.getElementById('edit-id').value;
    if (!id || !url) return;
    if (editGalleryUploading) {
      setEditGalleryStatus('上一批仍在處理中，請稍候', 'warning');
      return;
    }
    editGalleryUploading = true;
    gridDisableEditGalleryActions(true);
    setEditGalleryStatus('設定封面中…', 'info');
    try {
      var tok = getToken();
      if (!tok) { setEditGalleryStatus('請先登入', 'danger'); return; }
      var r = await fetch(apiItemBase(id) + '/gallery-images/cover', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
      });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok) {
        var errMsg = data.error || data.message || ('設定封面失敗 (HTTP ' + r.status + ')');
        setEditGalleryStatus(errMsg, 'danger');
        showToast(errMsg, 'danger');
        return;
      }
      var item = applyEditItemFromApi(data.item);
      renderEditGallery(item);
      setEditGalleryStatus('已設為封面', 'success');
      showToast(trLocal('baseModels.coverSet', '已設為封面'), 'success');
    } catch (err) {
      setEditGalleryStatus(err.message || '設定封面失敗', 'danger');
      showToast(err.message, 'danger');
    } finally {
      editGalleryUploading = false;
      gridDisableEditGalleryActions(false);
    }
  }
  function bindEditGalleryReorder(grid) {
    if (!grid) return;
    grid.querySelectorAll('.edit-gallery-col').forEach(function (col) {
      col.addEventListener('dragstart', function (e) {
        if (editGalleryUploading) { e.preventDefault(); return; }
        editGalleryDragUrl = col.getAttribute('data-gallery-url');
        col.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', editGalleryDragUrl); } catch (_) {}
        }
      });
      col.addEventListener('dragend', function () {
        col.classList.remove('dragging');
        editGalleryDragUrl = null;
      });
      col.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (!editGalleryDragUrl || editGalleryDragUrl === col.getAttribute('data-gallery-url')) return;
        var dragEl = null;
        grid.querySelectorAll('.edit-gallery-col').forEach(function (el) {
          if (el.getAttribute('data-gallery-url') === editGalleryDragUrl) dragEl = el;
        });
        if (!dragEl || dragEl === col) return;
        var rect = col.getBoundingClientRect();
        var after = (e.clientX - rect.left) > rect.width / 2;
        if (after) grid.insertBefore(dragEl, col.nextSibling);
        else grid.insertBefore(dragEl, col);
      });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        var getItemFn = getCfg().getEditItem;
        var item = typeof getItemFn === 'function' ? getItemFn() : null;
        var prev = item ? catalogImageUrls(item) : [];
        var next = collectEditGalleryOrderFromGrid(grid);
        if (!next.length || prev.join('\0') === next.join('\0')) return;
        persistGalleryOrderFromUrls(next);
      });
    });
  }
  function getEditGalleryOptimizeBackground() {
    var sel = document.getElementById('edit-gallery-optimize-bg');
    if (!sel) return 'white';
    if (sel.value === 'custom') {
      var c = document.getElementById('edit-gallery-optimize-bg-custom');
      return (c && c.value) ? c.value : '#ffffff';
    }
    return sel.value || 'white';
  }
  function vendorUpscaleEnabledForEdit() {
    var kind = document.getElementById('edit-kind');
    return Pending.vendorUpscaleEnabledForKind(kind ? kind.value : 'prototype');
  }
  function calcRedrawPointsForUrl(item, sourceUrl) {
    var up = uploadPricing();
    var extra = up.points_optimize_extra != null ? up.points_optimize_extra : 5;
    var upload = up.points_upload != null ? up.points_upload : 5;
    var kind = catalogItemAssetKind(item);
    var opt = kind === 'material'
      ? (up.points_optimize_material != null ? up.points_optimize_material : 10)
      : (up.points_optimize != null ? up.points_optimize : 15);
    var urls = catalogImageUrls(item);
    var isCover = urls[0] === sourceUrl;
    return isCover ? Math.max(extra, opt - upload) : extra;
  }
  function pendingHasDerivedPreview(slot) {
    return !!(slot && (slot.redrawPreviewUrl || slot.upscalePreviewUrl));
  }
  function getEditGallerySlot(url) { return editGallerySlotPreview[url] || null; }
  function resetEditGalleryState() {
    editGallerySlotPreview = {};
    editGalleryUploading = false;
    editGalleryHighlightUrls = new Set();
    galleryUpscaleProbe = {};
    setEditGalleryStatus('');
    var pendingForm = document.getElementById('edit-gallery-pending-form');
    if (pendingForm && Pending.clearPendingImages) Pending.clearPendingImages(pendingForm);
    var actions = document.getElementById('edit-gallery-pending-actions');
    if (actions) actions.classList.add('d-none');
  }
  function getEditGalleryPendingForm() {
    return document.getElementById('edit-gallery-pending-form');
  }
  function syncEditGalleryPendingMirrors(item) {
    var titleMir = document.getElementById('edit-gallery-pending-title-mirror');
    var surfMir = document.getElementById('edit-gallery-pending-surface-mirror');
    var titleEl = document.getElementById('edit-title');
    var surfEl = document.getElementById('edit-material-surface-type');
    if (titleMir && titleEl) titleMir.value = titleEl.value;
    if (surfMir && surfEl) surfMir.value = surfEl.value;
    var form = getEditGalleryPendingForm();
    if (form && item) {
      form.setAttribute('data-kind', catalogItemAssetKind(item));
    }
  }
  async function fileFromImageUrl(url, filename) {
    var r = await fetch(url, { mode: 'cors' });
    if (!r.ok) throw new Error('無法讀取圖片');
    var blob = await r.blob();
    var type = (blob.type && blob.type.indexOf('image/') === 0) ? blob.type : 'image/jpeg';
    return new File([blob], filename || 'source.jpg', { type: type });
  }
  function pendingCardBadgeRow(a, b) {
    return '<div class="pending-card-badges d-flex flex-wrap align-items-center gap-1">' + (a || '') + (b || '') + '</div>';
  }
  function pendingCardActionSpacer() {
    return '<span class="btn btn-outline-primary btn-sm invisible" aria-hidden="true">設為封面</span>' +
      '<span class="btn btn-outline-danger btn-sm invisible" aria-hidden="true">移除</span>';
  }
  function pendingCardClearRedrawSpacer() {
    return '<span class="btn btn-outline-warning btn-sm invisible" aria-hidden="true">清除重繪新圖</span>';
  }
  function editGalleryPreviewBlock(slot, prefix) {
    if (!slot || !pendingHasDerivedPreview(slot)) return '';
    var orig = slot.uploadOriginal !== false;
    var rd = slot.uploadRedraw !== false && (!!slot.redrawFile || !!slot.redrawPreviewUrl);
    var html = '';
    html += '<label class="form-check pending-upload-check"><input type="checkbox" class="form-check-input ' + prefix + '-upload-original"' + (orig ? ' checked' : '') + '> 上傳原圖</label>';
    if (slot.redrawPreviewUrl || slot.redrawFile) {
      html += '<label class="form-check pending-upload-check"><input type="checkbox" class="form-check-input ' + prefix + '-upload-redraw"' + (rd ? ' checked' : '') + '> 上傳此張（AI 重繪）</label>';
      html += '<img src="' + esc(slot.redrawPreviewUrl) + '" class="pending-redraw-thumb matchdo-enlarge-trigger" alt="">';
    }
    return html;
  }
  function wireSlotUploadCheckboxes(card, slot, prefix, onChange) {
    var orig = card.querySelector('.' + prefix + '-upload-original');
    var rd = card.querySelector('.' + prefix + '-upload-redraw');
    if (orig) orig.addEventListener('change', function () {
      slot.uploadOriginal = orig.checked;
      if (orig.checked) { slot.uploadRedraw = false; }
      if (onChange) onChange();
    });
    if (rd) rd.addEventListener('change', function () {
      slot.uploadRedraw = rd.checked;
      if (rd.checked) slot.uploadOriginal = false;
      if (onChange) onChange();
    });
  }
  function renderEditGallery(item) {
    var grid = document.getElementById('edit-gallery-grid');
    if (!grid) return;
    var items = catalogImageItems(item);
    var editId = document.getElementById('edit-id').value;
    Pending.syncEditGalleryMaterialUi(catalogItemAssetKind(item) === 'material');
    if (!items.length) {
      grid.innerHTML = '<div class="col-12"><p class="text-muted small mb-0">—</p></div>';
      syncEditGalleryRedrawSettings();
      return;
    }
    var upscaleOn = vendorUpscaleEnabledForEdit();
    var lightboxItemsJson = esc(JSON.stringify(items.map(function (x) {
      return { url: x.url, label: x.label || '' };
    }))).replace(/"/g, '&quot;');
    grid.innerHTML = items.map(function (it, idx) {
      var url = it.url;
      var slot = getEditGallerySlot(url);
      var hasPreview = slot && pendingHasDerivedPreview(slot);
      var isCover = !!(it.is_cover || idx === 0);
      var isNew = editGalleryHighlightUrls.has(url);
      var coverBadge = isCover ? '<span class="badge bg-primary" style="font-size:0.65rem">' + esc(trLocal('baseModels.coverImage', '封面')) + '</span>' : '';
      var newBadge = (isNew && !hasPreview) ? '<span class="badge bg-success" style="font-size:0.65rem">新上傳</span>' : '';
      var labelField = isCover
        ? '<input type="text" class="form-control form-control-sm mt-1 pending-card-label" id="edit-cover-label" placeholder="封面名稱" value="' + esc(it.label || '') + '">'
        : '<input type="text" class="form-control form-control-sm mt-1 pending-card-label edit-gallery-label-input" data-url="' + esc(url) + '" placeholder="圖片名稱" value="' + esc(it.label || '') + '">';
      var slotPrefix = 'egslot-' + idx;
      var imgHtml = (slot && slot.imageBusy)
        ? '<div class="text-muted small text-center py-4">處理中…</div>'
        : ('<img src="' + esc(url) + '" class="matchdo-enlarge-trigger" alt="" title="預覽放大" data-image-items="' + lightboxItemsJson + '">');
      var previewBlock = hasPreview ? editGalleryPreviewBlock(slot, slotPrefix) : '';
      var upscaleBtn = upscaleOn
        ? ((window.MatchdoUpscaleScale && window.MatchdoUpscaleScale.controlsRowHtml(
            'gallery-upscale-scale matchdo-upscale-scale',
            '<button type="button" class="btn btn-outline-info btn-sm btn-gallery-upscale-one" data-url="' + esc(url) + '" title="' + esc(VENDOR_UPSCALE_RULE_TEXT) + '"><i class="bi bi-stars me-1"></i>' + esc(VENDOR_AI_UPSCALE_BTN) + '</button>'
          )) ||
          ('<button type="button" class="btn btn-outline-info btn-sm btn-gallery-upscale-one" data-url="' + esc(url) + '" title="' + esc(VENDOR_UPSCALE_RULE_TEXT) + '"><i class="bi bi-stars me-1"></i>' + esc(VENDOR_AI_UPSCALE_BTN) + '</button>'))
        : '';
      var actions = '<div class="pending-actions">' +
        (items.length > 1
          ? ('<div class="d-flex align-items-center gap-1 mb-1 edit-gallery-move-row w-100">' +
            '<span class="text-muted edit-gallery-drag" title="' + esc(trLocal('baseModels.catalogGroupsDrag', '拖曳排序')) + '"><i class="bi bi-grip-vertical"></i></span>' +
            '<button type="button" class="btn btn-outline-secondary btn-sm btn-gallery-move-left py-0 px-1"' + (idx > 0 ? '' : ' disabled') + ' data-url="' + esc(url) + '" title="' + esc(trLocal('baseModels.galleryMoveLeft', '往前')) + '"><i class="bi bi-chevron-left"></i></button>' +
            '<button type="button" class="btn btn-outline-secondary btn-sm btn-gallery-move-right py-0 px-1"' + (idx < items.length - 1 ? '' : ' disabled') + ' data-url="' + esc(url) + '" title="' + esc(trLocal('baseModels.galleryMoveRight', '往後')) + '"><i class="bi bi-chevron-right"></i></button>' +
            '</div>')
          : '') +
        pendingAiPairRowHtml(
          '<button type="button" class="btn btn-outline-secondary btn-sm btn-gallery-redraw-one" data-url="' + esc(url) + '"' + ((slot && slot.imageBusy) ? ' disabled' : '') + '><i class="bi bi-magic me-1"></i>AI 重繪</button>'
        ) +
        upscaleBtn +
        ((window.MatchdoUpscaleScale && window.MatchdoUpscaleScale.footerFromPreviewItem)
          ? window.MatchdoUpscaleScale.footerFromPreviewItem(slot || {}, {
              redrawClass: 'btn-gallery-clear-redraw',
              upscaleClass: 'btn-gallery-clear-upscale',
              redrawAttrs: ' data-url="' + esc(url) + '"',
              upscaleAttrs: ' data-url="' + esc(url) + '"',
              coverHtml: !isCover
                ? '<button type="button" class="btn btn-outline-primary btn-sm btn-gallery-set-cover" data-url="' + esc(url) + '">' + esc(trLocal('baseModels.setAsCover', '設為封面')) + '</button>'
                : '',
              removeHtml: !isCover
                ? '<button type="button" class="btn btn-outline-danger btn-sm btn-gallery-del" data-url="' + esc(url) + '">移除</button>'
                : ''
            })
          : ('<div class="pending-footer-actions">' +
            ((slot && slot.redrawPreviewUrl) ? '<button type="button" class="btn btn-outline-warning btn-sm btn-gallery-clear-redraw" data-url="' + esc(url) + '">清除重繪</button>' : '') +
            ((slot && slot.upscalePreviewUrl) ? '<button type="button" class="btn btn-outline-warning btn-sm btn-gallery-clear-upscale" data-url="' + esc(url) + '">清除放大</button>' : '') +
            (!isCover
              ? '<button type="button" class="btn btn-outline-primary btn-sm btn-gallery-set-cover" data-url="' + esc(url) + '">' + esc(trLocal('baseModels.setAsCover', '設為封面')) + '</button>' +
                '<button type="button" class="btn btn-outline-danger btn-sm btn-gallery-del" data-url="' + esc(url) + '">移除</button>'
              : '') +
            '</div>')) +
        '</div>';
      var assetKind = catalogItemAssetKind(item);
      var Compose = global.MatchdoMaterialCoverGridCompose;
      var composeSlot = (Compose && Compose.coverGridComposeEnabledForKind && Compose.coverGridComposeEnabledForKind(assetKind) && Compose.materialCoverComposeSlotHtml)
        ? Compose.materialCoverComposeSlotHtml(isCover, true, {
            kind: assetKind,
            buttonLabel: Compose.coverComposeButtonLabel ? Compose.coverComposeButtonLabel(assetKind) : undefined
          })
        : '';
      return '<div class="col-6 col-sm-4 col-md-3 edit-gallery-col" draggable="true" data-gallery-url="' + esc(url) + '">' +
        composeSlot +
        '<div class="pending-image-card' + (isCover ? ' is-cover' : '') + (hasPreview ? ' is-new-redraw' : '') + '">' +
        pendingCardBadgeRow(coverBadge, newBadge) +
        '<div class="pending-card-media">' + imgHtml + '</div>' +
        (previewBlock ? '<div class="pending-card-preview">' + previewBlock + '</div>' : '') +
        labelField + actions + '</div></div>';
    }).join('');
    grid.querySelectorAll('.btn-gallery-redraw-one').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        previewGallerySlotRedraw(item, btn.getAttribute('data-url'));
      });
    });
    function clearGallerySlotKind(url, kind) {
      var slot = editGallerySlotPreview[url];
      if (!slot) return;
      if (kind === 'redraw') {
        slot.redrawPreviewUrl = null;
        slot.redrawFile = null;
        slot.uploadRedraw = false;
      } else if (kind === 'upscale') {
        slot.upscalePreviewUrl = null;
        slot.upscaleFile = null;
        slot.uploadUpscale = false;
      }
      if (!pendingHasDerivedPreview(slot)) delete editGallerySlotPreview[url];
      var getItemFn = getCfg().getEditItem;
      renderEditGallery(typeof getItemFn === 'function' ? getItemFn() : item);
    }
    grid.querySelectorAll('.btn-gallery-clear-redraw, .btn-gallery-clear-preview').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        clearGallerySlotKind(btn.getAttribute('data-url'), 'redraw');
      });
    });
    grid.querySelectorAll('.btn-gallery-clear-upscale').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        clearGallerySlotKind(btn.getAttribute('data-url'), 'upscale');
      });
    });
    grid.querySelectorAll('.btn-gallery-del').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (getCfg().deleteGalleryImage) getCfg().deleteGalleryImage(btn.getAttribute('data-url'));
      });
    });
    grid.querySelectorAll('.btn-gallery-set-cover').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        setGalleryCover(btn.getAttribute('data-url'));
      });
    });
    grid.querySelectorAll('.btn-gallery-move-left').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        moveGalleryImage(btn.getAttribute('data-url'), -1);
      });
    });
    grid.querySelectorAll('.btn-gallery-move-right').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        moveGalleryImage(btn.getAttribute('data-url'), 1);
      });
    });
    grid.querySelectorAll('.btn-gallery-upscale-one').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var scale = (window.MatchdoUpscaleScale && window.MatchdoUpscaleScale.readScaleNear(btn)) || 2;
        upscaleGalleryImage(item, btn.getAttribute('data-url'), scale);
      });
    });
    items.forEach(function (it, idx) {
      var slot = editGallerySlotPreview[it.url];
      if (!slot || !pendingHasDerivedPreview(slot)) return;
      var card = grid.children[idx] && grid.children[idx].querySelector('.pending-image-card');
      if (card) wireSlotUploadCheckboxes(card, slot, 'egslot-' + idx, function () { renderEditGallery(getCfg().getEditItem()); });
    });
    var scheduleLabels = getCfg().scheduleSaveImageLabels;
    if (typeof scheduleLabels === 'function') {
      var coverLabelIn = document.getElementById('edit-cover-label');
      if (coverLabelIn) coverLabelIn.addEventListener('input', function () { scheduleLabels(editId); });
      grid.querySelectorAll('.edit-gallery-label-input').forEach(function (inp) {
        inp.addEventListener('input', function () { scheduleLabels(editId); });
      });
    }
    bindEditGalleryReorder(grid);
    syncEditGalleryRedrawSettings();
    var cfgSync = getCfg().syncMaterialComposeCoverButton;
    if (cfgSync && catalogItemAssetKind(item) === 'material') cfgSync(item);
  }
  async function previewGallerySlotRedraw(item, sourceUrl) {
    if (!sourceUrl || editGalleryUploading) return;
    var kind = catalogItemAssetKind(item);
    if (kind === 'material') {
      var surfaceErr = Pending.validateMaterialSurfaceTypeForRedraw(Pending.getMaterialSurfaceTypeFromEdit());
      if (surfaceErr) { showToast(surfaceErr, 'warning'); return; }
    }
    var pts = calcRedrawPointsForUrl(item, sourceUrl);
    if (!window.confirm('AI 重繪？（-' + pts + ' 點；勾選要上傳的圖後按「儲存」）')) return;
    var slot = editGallerySlotPreview[sourceUrl] || {};
    slot.imageBusy = true;
    editGallerySlotPreview[sourceUrl] = slot;
    renderEditGallery(item);
    try {
      var tok = getToken();
      if (!tok) { showToast('請先登入', 'danger'); return; }
      var srcItems = catalogImageItems(item);
      var srcItem = srcItems.find(function (it) { return it.url === sourceUrl; });
      var isCover = srcItems[0] && srcItems[0].url === sourceUrl;
      var file = await fileFromImageUrl(sourceUrl, 'gallery-source.jpg');
      var fd = new FormData();
      fd.append('image', file);
      fd.append('asset_kind', kind);
      fd.append('is_cover', isCover ? '1' : '0');
      fd.append('optimize_background', getEditGalleryOptimizeBackground());
      if (item.title) fd.append('title', item.title);
      if (srcItem && srcItem.label) fd.append('image_label', srcItem.label);
      Pending.appendMaterialCatalogHintToRedrawFormData(fd, {
        asset_kind: kind,
        catalog_groups: item.catalog_groups || [],
        catalog_group_ids: (item.catalog_groups || []).map(function (g) { return g.id; })
      });
      if (kind === 'material') {
        Pending.appendMaterialSurfaceTypeToFormData(fd, Pending.getMaterialSurfaceTypeFromEdit());
      }
      var previewUrl = (global.MatchdoVendorAssetPendingConfig && global.MatchdoVendorAssetPendingConfig.previewRedrawUrl)
        || '/api/me/industry-supplier/catalog-items/preview-image-redraw';
      var r = await fetch(previewUrl, { method: 'POST', headers: { Authorization: 'Bearer ' + tok }, body: fd });
      var data = await r.json().catch(function () { return {}; });
      if (r.status === 402) { showToast((data.error || '點數不足') + ' (' + (data.required || '') + ')', 'danger'); return; }
      if (!r.ok) { showToast(data.error || '重繪失敗', 'danger'); return; }
      slot.redrawPreviewUrl = data.preview_url || (data.preview_base64 ? ('data:image/jpeg;base64,' + data.preview_base64) : '');
      slot.redrawPreviewStorageUrl = data.preview_url || '';
      slot.previewCreditTxId = data.credit_transaction_id || null;
      slot.uploadRedraw = true;
      slot.uploadOriginal = false;
      if (data.preview_base64) {
        var bin = atob(data.preview_base64);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        slot.redrawFile = new File([arr], 'redraw-gallery.jpg', { type: 'image/jpeg' });
      } else if (data.preview_url) {
        slot.redrawFile = await fileFromImageUrl(data.preview_url, 'redraw-gallery.jpg');
      }
      showToast('已產生 AI 新圖，預設只上傳新圖（不保留原圖）' + (data.points_deducted ? ' · -' + data.points_deducted + ' 點' : ''));
    } catch (err) {
      showToast(err.message || '重繪失敗', 'danger');
    } finally {
      slot.imageBusy = false;
      editGallerySlotPreview[sourceUrl] = slot;
      renderEditGallery(getCfg().getEditItem());
    }
  }
  async function upscaleGalleryImage(item, sourceUrl, scaleOpt) {
    if (!sourceUrl || editGalleryUploading || !vendorUpscaleEnabledForEdit()) return;
    var id = document.getElementById('edit-id').value;
    var up = uploadPricing();
    var scale = (window.MatchdoUpscaleScale && window.MatchdoUpscaleScale.normalizeScale(scaleOpt)) || (parseInt(scaleOpt, 10) || 2);
    var base = up.points_upscale != null ? up.points_upscale : 1;
    var pts = (window.MatchdoUpscaleScale && window.MatchdoUpscaleScale.pointsForScale(base, scale, up.upscale_points_by_scale)) || (base + (scale / 2 - 1));
    var dim = await new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 }); };
      img.onerror = function () { resolve({ w: 0, h: 0 }); };
      img.src = sourceUrl;
    });
    if (window.MatchdoUpscaleScale && !window.MatchdoUpscaleScale.confirmIfOverInputLimit(dim.w, dim.h)) return;
    if (!window.confirm('以此圖 AI 放大並新增一張新圖？（' + scale + '×，-' + pts + ' 點；' + VENDOR_UPSCALE_RULE_TEXT + '）')) return;
    editGalleryUploading = true;
    setEditGalleryStatus('AI 放大中…', 'info');
    try {
      var tok = getToken();
      if (!tok) { showToast('請先登入', 'danger'); return; }
      var r = await fetch(apiItemBase(id) + '/gallery-images/upscale', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url: sourceUrl, scale: scale })
      });
      var data = await r.json().catch(function () { return {}; });
      if (r.status === 402) { showToast((data.error || '點數不足') + ' (' + (data.required || '') + ')', 'danger'); return; }
      if (!r.ok) { showToast(data.error || 'AI 放大失敗', 'danger'); return; }
      if (data.item && getCfg().updateEditItem) getCfg().updateEditItem(data.item);
      renderEditGallery(data.item || getCfg().getEditItem());
      setEditGalleryStatus('已追加放大新圖', 'success');
      showToast('已追加放大新圖' + (data.points_deducted ? ' · -' + data.points_deducted + ' 點' : ''));
    } catch (err) {
      showToast(err.message || '放大失敗', 'danger');
    } finally {
      editGalleryUploading = false;
    }
  }
  async function postGalleryImageFiles(id, files, labels, derivedKinds, optIdx) {
    var tok = getToken();
    if (!tok) throw new Error('請先登入');
    var fd = new FormData();
    files.forEach(function (f) { fd.append('images', f); });
    if (labels && labels.length) fd.append('image_labels', JSON.stringify(labels));
    if (derivedKinds && derivedKinds.some(function (d) { return d === 'redraw' || d === 'upscale'; })) {
      fd.append('image_ai_derived', JSON.stringify(derivedKinds));
    }
    if (optIdx && optIdx.length) {
      fd.append('optimize_image_indices', JSON.stringify(optIdx));
      fd.append('optimize_background', getEditGalleryOptimizeBackground());
    }
    var kind = document.getElementById('edit-kind');
    if (kind && kind.value === 'material') {
      Pending.appendMaterialSurfaceTypeToFormData(fd, Pending.getMaterialSurfaceTypeFromEdit());
    }
    var r = await fetch(apiItemBase(id) + '/gallery-images', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok },
      body: fd
    });
    var data = await r.json().catch(function () { return {}; });
    if (r.status === 402) throw new Error((data.error || '點數不足') + (data.required ? ' (' + data.required + ')' : ''));
    if (!r.ok) throw new Error(data.error || '上傳失敗');
    return data;
  }
  async function applyEditGallerySlotPreview(item, sourceUrl, slot) {
    if (!slot || !slot.redrawFile) return { ok: true };
    var id = document.getElementById('edit-id').value;
    var keepOrig = slot.uploadOriginal !== false;
    var keepNew = slot.uploadRedraw !== false && !!slot.redrawFile;
    if (!keepOrig && !keepNew) return { ok: false, error: '請至少勾選「上傳原圖」或「上傳此張」' };
    if (keepOrig && !keepNew) {
      delete editGallerySlotPreview[sourceUrl];
      return { ok: true };
    }
    var srcItem = catalogImageItems(item).find(function (it) { return it.url === sourceUrl; });
    var label = (srcItem && srcItem.label) || 'AI重繪';
    var urlsBefore = catalogImageUrls(item);
    var data = await postGalleryImageFiles(id, [slot.redrawFile], [label], ['redraw'], []);
    var newItem = data.item;
    if (getCfg().updateEditItem) getCfg().updateEditItem(newItem);
    if (!keepOrig && getCfg().deleteGalleryImage) {
      await getCfg().deleteGalleryImage(sourceUrl, true);
    }
    delete editGallerySlotPreview[sourceUrl];
    return { ok: true, data: newItem };
  }
  async function flushEditGallerySlotPreviewsBeforeSave() {
    var getItemFn = getCfg().getEditItem;
    var item = typeof getItemFn === 'function' ? getItemFn() : null;
    if (!item) return true;
    var urls = Object.keys(editGallerySlotPreview).filter(function (u) {
      var s = editGallerySlotPreview[u];
      return s && pendingHasDerivedPreview(s);
    });
    if (!urls.length) return true;
    for (var i = 0; i < urls.length; i++) {
      var slot = editGallerySlotPreview[urls[i]];
      if (!slot.uploadOriginal && !slot.uploadRedraw) {
        setEditGalleryStatus('請至少勾選「上傳原圖」或「上傳此張」', 'danger');
        return false;
      }
    }
    if (!window.confirm('將依勾選寫入 ' + urls.length + ' 組 AI 重繪結果。繼續？')) return false;
    editGalleryUploading = true;
    setEditGalleryStatus('寫入勾選的圖片…', 'info');
    try {
      for (var j = 0; j < urls.length; j++) {
        var applied = await applyEditGallerySlotPreview(item, urls[j], editGallerySlotPreview[urls[j]]);
        if (!applied.ok) {
          setEditGalleryStatus(applied.error || '寫入失敗', 'danger');
          return false;
        }
        item = getCfg().getEditItem();
      }
      setEditGalleryStatus('已依勾選寫入圖庫', 'success');
      renderEditGallery(item);
      return true;
    } catch (err) {
      setEditGalleryStatus(err.message || '寫入失敗', 'danger');
      return false;
    } finally {
      editGalleryUploading = false;
    }
  }
  async function uploadEditGalleryPending(id) {
    var form = getEditGalleryPendingForm();
    if (!form) return;
    syncEditGalleryPendingMirrors(getCfg().getEditItem());
    var deriveErr = await Pending.ensureAllPendingDerivedFiles(form);
    if (deriveErr) throw new Error(deriveErr);
    var pending = Pending.getPendingImages(form);
    var selErr = Pending.validatePendingUploadList(pending);
    if (selErr) throw new Error(selErr);
    var payload = Pending.collectPendingUploadPayload(pending);
    if (!payload.uploadFiles.length) return;
    var data = await postGalleryImageFiles(
      id, payload.uploadFiles, payload.uploadLabels, payload.uploadDerived, payload.optIdx
    );
    if (data.item && getCfg().updateEditItem) getCfg().updateEditItem(data.item);
    Pending.clearPendingImages(form);
    var actions = document.getElementById('edit-gallery-pending-actions');
    if (actions) actions.classList.add('d-none');
    renderEditGallery(data.item || getCfg().getEditItem());
    if (data.gallery_migration_required) showToast('請執行 docs/add-supplier-catalog-gallery-images.sql', 'warning');
  }
  function wireEditGalleryPendingInput() {
    var input = document.getElementById('edit-gallery-add');
    var form = getEditGalleryPendingForm();
    if (!input || !form || input._wired) return;
    input._wired = true;
    input.addEventListener('change', function () {
      if (!input.files || !input.files.length) return;
      syncEditGalleryPendingMirrors(getCfg().getEditItem());
      Pending.appendFilesToPending(form, input.files);
      var actions = document.getElementById('edit-gallery-pending-actions');
      if (actions) actions.classList.remove('d-none');
      input.value = '';
    });
    var dropZone = input.closest('.col-12') || input.parentElement;
    if (global.MatchdoImageDrop && dropZone) {
      global.MatchdoImageDrop.wire({
        zone: dropZone,
        multiple: true,
        onFiles: function (files) {
          syncEditGalleryPendingMirrors(getCfg().getEditItem());
          Pending.appendFilesToPending(form, files);
          var actions = document.getElementById('edit-gallery-pending-actions');
          if (actions) actions.classList.remove('d-none');
        }
      });
    }
    var btnUpload = document.getElementById('btn-edit-upload-pending-only');
    if (btnUpload) {
      btnUpload.addEventListener('click', async function () {
        var id = document.getElementById('edit-id').value;
        if (!id) return;
        try {
          await uploadEditGalleryPending(id);
          showToast('已上傳所選圖片', 'success');
        } catch (e) {
          showToast(e.message, 'danger');
        }
      });
    }
    var btnClear = document.getElementById('btn-edit-clear-pending');
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        Pending.clearPendingImages(form);
        var actions = document.getElementById('edit-gallery-pending-actions');
        if (actions) actions.classList.add('d-none');
      });
    }
    var bgSel = document.getElementById('edit-gallery-optimize-bg');
    if (bgSel) {
      bgSel.addEventListener('change', function () {
        var custom = document.getElementById('edit-gallery-optimize-bg-custom');
        if (custom) custom.classList.toggle('d-none', bgSel.value !== 'custom');
      });
    }
  }
  global.MatchdoSupplierCatalogEditGallery = {
    reset: resetEditGalleryState,
    render: renderEditGallery,
    catalogImageItems: catalogImageItems,
    syncEditGalleryRedrawSettings: syncEditGalleryRedrawSettings,
    syncUpscaleHint: syncEditGalleryUpscaleHint,
    flushBeforeSave: flushEditGallerySlotPreviewsBeforeSave,
    uploadPending: uploadEditGalleryPending,
    wire: wireEditGalleryPendingInput,
    syncPendingMirrors: syncEditGalleryPendingMirrors
  };
})(typeof window !== 'undefined' ? window : this);
