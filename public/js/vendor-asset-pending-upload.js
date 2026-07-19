/**
 * 待傳清單多圖 + 逐張 AI 重繪／放大（與 manufacturer-materials 相同）
 * 頁面設定 window.MatchdoVendorAssetPendingConfig 後載入本檔，再呼叫 MatchdoVendorAssetPending.init()
 */
(function (global) {
  'use strict';
  var CFG = global.MatchdoVendorAssetPendingConfig || {};
  function cfg(k, d) { var v = CFG[k]; return v !== undefined && v !== null ? v : d; }
  function tr(k, fb) { return (CFG.tr ? CFG.tr(k, fb) : (fb || k)); }
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function normalizeKind(k) { if (k === 'material') return 'material'; if (k === 'part') return 'part'; return 'prototype'; }
  var uploadPricing = CFG.uploadPricing || { points_upload: 5, points_optimize: 15, points_optimize_material: 10, points_optimize_extra: 5, points_upscale: 1 };
  function optimizePointsForKind(kind) {
    return normalizeKind(kind) === 'material'
      ? (uploadPricing.points_optimize_material != null ? uploadPricing.points_optimize_material : 10)
      : (uploadPricing.points_optimize != null ? uploadPricing.points_optimize : 15);
  }
  function getOptimizeBackgroundValue(root) {
    if (CFG.getOptimizeBackgroundValue) return CFG.getOptimizeBackgroundValue(root);
    var sel = root && root.querySelector ? root.querySelector('.add-optimize-bg') : null;
    if (!sel) return 'white';
    if (sel.value === 'custom') {
      var c = root.querySelector('.add-optimize-bg-custom');
      return (c && c.value) ? c.value : '#ffffff';
    }
    return sel.value || 'white';
  }
  function syncAddFormOptimizeBgWrap(form) {
    if (CFG.syncAddFormOptimizeBgWrap) CFG.syncAddFormOptimizeBgWrap(form);
  }
  function showToast(msg, type) { if (CFG.showToast) CFG.showToast(msg, type); }
  async function getTokenAsync() { return CFG.getToken ? CFG.getToken() : (CFG.token || null); }
  var token = CFG.token || null;
  var PROTOTYPE_MAX_IMAGES = cfg('maxImages', 12);
  var PREVIEW_REDRAW_URL = cfg('previewRedrawUrl', '/api/me/vendor-assets/preview-image-redraw');
  var PREVIEW_UPSCALE_URL = cfg('previewUpscaleUrl', '/api/me/vendor-assets/preview-image-upscale');
  var enableLinkGroup = cfg('enableLinkGroup', true);
  function getSelectedCatalogGroupIds(container) {
    if (CFG.getSelectedCatalogGroupIds) return CFG.getSelectedCatalogGroupIds(container);
    if (!container) return [];
    return Array.prototype.slice.call(container.querySelectorAll('input[type=checkbox][data-group-id]:checked'))
      .map(function (el) { return el.getAttribute('data-group-id'); }).filter(Boolean);
  }
  function schedulePendingDraftSave() {}
  function clearPendingDraft() {}
  function clearSupplierRefForManualUpload() {}

        /** 材料不提供上傳前 AI 放大（僅原型／零件保留） */
        function vendorUpscaleEnabledForKind(kind) {
            return normalizeKind(kind) !== 'material';
        }
        function labelFromFilename(name) {
            var base = (name || '').trim();
            if (!base) return '';
            var leaf = base.split(/[/\\]/).pop() || base;
            return leaf.replace(/\.[^.]+$/, '').trim() || leaf;
        }
        function calcPendingPreviewRedrawPoints(form, idx) {
            var kind = form.getAttribute('data-kind') || 'prototype';
            var extra = uploadPricing.points_optimize_extra != null ? uploadPricing.points_optimize_extra : 5;
            var upload = uploadPricing.points_upload != null ? uploadPricing.points_upload : 5;
            var opt = optimizePointsForKind(kind);
            return idx === 0 ? Math.max(extra, opt - upload) : extra;
        }

        async function blobUrlToRedrawFile(blobUrl, filename) {
            var r = await fetch(blobUrl);
            var blob = await r.blob();
            return new File([blob], filename || 'redraw.jpg', { type: blob.type || 'image/jpeg' });
        }

        function base64ToRedrawFile(b64, filename) {
            if (!b64) throw new Error('無法讀取預覽圖');
            var bin = atob(b64);
            var arr = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            return new File([arr], filename || 'redraw.jpg', { type: 'image/jpeg' });
        }

        /** 預覽 API 回傳 base64 或 URL，組成待上傳 File */
        async function fileFromPreviewResponse(data, filename) {
            if (data && data.preview_base64) {
                try {
                    return base64ToRedrawFile(data.preview_base64, filename);
                } catch (_) { /* fall through to URL */ }
            }
            if (data && data.preview_url) {
                return blobUrlToRedrawFile(data.preview_url, filename);
            }
            throw new Error('無法讀取預覽圖');
        }

        function previewDataUrlFromResponse(data) {
            if (data && data.preview_url) return data.preview_url;
            if (data && data.preview_base64) return 'data:image/jpeg;base64,' + data.preview_base64;
            return '';
        }

        async function ensurePendingDerivedFile(item, kind) {
            if (kind === 'redraw') {
                if (item.redrawFile || !item.uploadRedraw) return;
                var rdUrl = item.redrawPreviewStorageUrl
                    || (item.redrawPreviewUrl && String(item.redrawPreviewUrl).indexOf('http') === 0 ? item.redrawPreviewUrl : '');
                if (!rdUrl) throw new Error('重繪預覽圖已遺失，請重新按 AI 重繪');
                item.redrawFile = await blobUrlToRedrawFile(rdUrl, 'redraw-' + (item.id || '0') + '.jpg');
                return;
            }
            if (kind === 'upscale') {
                if (item.upscaleFile || !item.uploadUpscale) return;
                var upUrl = item.upscalePreviewStorageUrl
                    || (item.upscalePreviewUrl && String(item.upscalePreviewUrl).indexOf('http') === 0 ? item.upscalePreviewUrl : '');
                if (!upUrl) throw new Error('AI 放大預覽圖已遺失，請重新按 AI 放大');
                item.upscaleFile = await blobUrlToRedrawFile(upUrl, 'upscale-' + (item.id || '0') + '.jpg');
            }
        }

        async function ensureAllPendingDerivedFiles(form) {
            var list = getPendingImages(form);
            for (var i = 0; i < list.length; i++) {
                try {
                    await ensurePendingDerivedFile(list[i], 'redraw');
                    await ensurePendingDerivedFile(list[i], 'upscale');
                } catch (e) {
                    return e.message || '預覽圖遺失';
                }
            }
            return '';
        }
        function getPendingImages(form) {
            if (!form._pendingImages) form._pendingImages = [];
            return form._pendingImages;
        }

        function revokePendingImageUrls(wrap) {
            if (!wrap) return;
            wrap.querySelectorAll('img[data-object-url]').forEach(function (img) {
                var u = img.getAttribute('data-object-url');
                if (u) { try { URL.revokeObjectURL(u); } catch (_) {} }
            });
        }

        function clearPendingImages(form) {
            if (!form) return;
            var wrap = form.querySelector('.add-pending-images');
            revokePendingImageUrls(wrap);
            if (wrap) wrap.innerHTML = '';
            form._pendingImages = [];
            var kind = form.getAttribute('data-kind') || 'prototype';
            clearPendingDraft(kind);
            updateAddFormPointsEstimate(form);
        }

        function pendingUploadCheckHtml(checked, inputClass, labelText) {
            var c = checked !== false ? ' checked' : '';
            return '<label class="form-check pending-upload-check">' +
                '<input type="checkbox" class="form-check-input ' + inputClass + '"' + c + '> ' +
                esc(labelText) + '</label>';
        }

        function pendingHasAiPreview(item) {
            return !!(item.redrawPreviewUrl || item.upscalePreviewUrl);
        }

        function pendingHasDerivedPreview(item) {
            return pendingHasAiPreview(item);
        }

        function vendorImageDerivedKind(it) {
            if (!it) return '';
            var d = it.ai_derived != null ? String(it.ai_derived).trim() : '';
            if (d === 'redraw' || d === 'upscale') return d;
            var lbl = (it.label || '');
            if (lbl.indexOf('（重繪）') >= 0) return 'redraw';
            if (lbl.indexOf('（放大）') >= 0) return 'upscale';
            return '';
        }

        function stripLegacyDerivedLabelSuffix(label) {
            var lbl = String(label || '').trim();
            if (!lbl) return '';
            var prev;
            do {
                prev = lbl;
                lbl = lbl.replace(/（重繪）$/, '').replace(/（放大）$/, '').trim();
            } while (lbl !== prev);
            return lbl;
        }

        function displayGalleryImageLabel(it) {
            var lbl = (it && it.label) ? String(it.label).trim() : '';
            if (!lbl) return '';
            if (vendorImageDerivedKind(it)) return stripLegacyDerivedLabelSuffix(lbl) || lbl;
            return lbl;
        }

        /** 依勾選組出要上傳的檔案（順序：原圖 → 重繪 → 放大） */
        function pendingUploadEntries(item) {
            var baseLabel = (item.label || labelFromFilename(item.file && item.file.name)).trim().slice(0, 120);
            var out = [];
            if (item.file && item.uploadOriginal !== false) {
                out.push({ file: item.file, label: baseLabel, aiDerived: '' });
            }
            if (item.redrawFile && item.uploadRedraw !== false) {
                out.push({ file: item.redrawFile, label: baseLabel || 'AI重繪', aiDerived: 'redraw' });
            }
            if (item.upscaleFile && item.uploadUpscale !== false) {
                out.push({ file: item.upscaleFile, label: baseLabel || '放大', aiDerived: 'upscale' });
            }
            return out;
        }

        function collectPendingUploadPayload(pendingList) {
            var uploadFiles = [];
            var uploadLabels = [];
            var uploadLinkGroups = [];
            var uploadDerived = [];
            var optIdx = [];
            (pendingList || []).forEach(function (p) {
                var lg = (p.link_group || '').trim();
                var entries = pendingUploadEntries(p);
                var startIdx = uploadFiles.length;
                entries.forEach(function (ent) {
                    uploadFiles.push(ent.file);
                    uploadLabels.push(ent.label);
                    uploadLinkGroups.push(lg);
                    uploadDerived.push(ent.aiDerived || '');
                });
                if (p.optimize && !p.redrawFile && !p.upscaleFile && entries.length) {
                    optIdx.push(startIdx);
                }
            });
            return {
                uploadFiles: uploadFiles,
                uploadLabels: uploadLabels,
                uploadLinkGroups: uploadLinkGroups,
                uploadDerived: uploadDerived,
                optIdx: optIdx
            };
        }

        function prototypeShowsLinkGroup(kindOrAsset) { return enableLinkGroup && normalizeKind(typeof kindOrAsset === "string" ? kindOrAsset : (kindOrAsset && kindOrAsset.asset_kind)) === "prototype"; }

        function pendingLinkGroupFieldHtml(item) {
            return '<input type="text" class="form-control form-control-sm mt-1 pending-link-group" placeholder="' +
                esc(tr('baseModels.linkGroupPlaceholder', '連動組（同色同款填相同，例：black）')) + '" value="' +
                esc(item.link_group || '') + '">';
        }

        function validatePendingUploadList(list) {
            if (!list || !list.length) return tr('baseModels.needImage', '請至少新增一張圖片');
            for (var i = 0; i < list.length; i++) {
                if (!pendingUploadEntries(list[i]).length) {
                    return '第 ' + (i + 1) + ' 組圖片：請至少勾選一張要上傳（原圖或新圖）';
                }
            }
            return '';
        }

        function syncPendingUploadCheckboxUi(item, card, prefix) {
            var orig = card.querySelector('.' + prefix + '-upload-original');
            var rd = card.querySelector('.' + prefix + '-upload-redraw');
            var up = card.querySelector('.' + prefix + '-upload-upscale');
            if (orig) orig.checked = item.uploadOriginal !== false;
            if (rd) rd.checked = item.uploadRedraw !== false;
            if (up) up.checked = item.uploadUpscale !== false;
        }

        /** 勾選上傳新圖時不保留原圖；勾選上傳原圖時不併傳已產生的新圖 */
        function applyPendingUploadExclusive(item, card, prefix, changed) {
            if (changed === 'redraw' || changed === 'upscale') {
                if (item.uploadRedraw || item.uploadUpscale) item.uploadOriginal = false;
            } else if (changed === 'original' && item.uploadOriginal !== false) {
                item.uploadRedraw = false;
                item.uploadUpscale = false;
            }
            if (card && prefix) syncPendingUploadCheckboxUi(item, card, prefix);
        }

        function wirePendingUploadCheckboxes(card, item, prefix, onChange) {
            var notify = function () {
                if (typeof onChange === 'function') onChange();
            };
            var orig = card.querySelector('.' + prefix + '-upload-original');
            if (orig) {
                orig.addEventListener('change', function () {
                    item.uploadOriginal = orig.checked;
                    applyPendingUploadExclusive(item, card, prefix, 'original');
                    if (!pendingUploadEntries(item).length) {
                        item.uploadOriginal = true;
                        applyPendingUploadExclusive(item, card, prefix, 'original');
                        showToast('每組至少須上傳一張圖', 'warning');
                    }
                    notify();
                });
            }
            var rd = card.querySelector('.' + prefix + '-upload-redraw');
            if (rd) {
                rd.addEventListener('change', function () {
                    item.uploadRedraw = rd.checked;
                    applyPendingUploadExclusive(item, card, prefix, 'redraw');
                    if (!pendingUploadEntries(item).length) {
                        item.uploadRedraw = true;
                        applyPendingUploadExclusive(item, card, prefix, 'redraw');
                        showToast('每組至少須上傳一張圖', 'warning');
                    }
                    notify();
                });
            }
            var up = card.querySelector('.' + prefix + '-upload-upscale');
            if (up) {
                up.addEventListener('change', function () {
                    item.uploadUpscale = up.checked;
                    applyPendingUploadExclusive(item, card, prefix, 'upscale');
                    if (!pendingUploadEntries(item).length) {
                        item.uploadUpscale = true;
                        applyPendingUploadExclusive(item, card, prefix, 'upscale');
                        showToast('每組至少須上傳一張圖', 'warning');
                    }
                    notify();
                });
            }
        }

        function pendingOriginalUploadCheckHtml(item, prefix) {
            if (!pendingHasDerivedPreview(item)) return '';
            return pendingUploadCheckHtml(item.uploadOriginal !== false, prefix + '-upload-original', '上傳原圖');
        }

        function pendingRedrawThumbHtml(item, prefix) {
            if (!item.redrawPreviewUrl) return '';
            return '<div class="pending-redraw-new-row"><span class="d-block" style="font-size:0.65rem;color:#198754">重繪新圖</span>' +
                '<img src="' + esc(item.redrawPreviewUrl) + '" class="pending-redraw-thumb matchdo-enlarge-trigger" alt="" title="' + esc(trPreviewEnlargeTitle('重繪新圖')) + '">' +
                pendingUploadCheckHtml(item.uploadRedraw !== false, prefix + '-upload-redraw', '上傳此張') +
                '</div>';
        }

        function pendingUpscaleThumbHtml(item, prefix, includeUpscale) {
            if (includeUpscale === false || !item.upscalePreviewUrl) return '';
            return '<div class="pending-redraw-new-row"><span class="d-block" style="font-size:0.65rem;color:#198754">AI 放大新圖（≤1MP）</span>' +
                '<img src="' + esc(item.upscalePreviewUrl) + '" class="pending-redraw-thumb matchdo-enlarge-trigger" alt="" title="' + esc(trPreviewEnlargeTitle('AI 放大新圖')) + '">' +
                pendingUploadCheckHtml(item.uploadUpscale !== false, prefix + '-upload-upscale', '上傳此張') +
                '</div>';
        }

        function pendingDerivedThumbsHtml(item, prefix, includeUpscale) {
            var p = prefix || 'pending';
            return pendingRedrawThumbHtml(item, p) + pendingUpscaleThumbHtml(item, p, includeUpscale);
        }

        function pendingRedrawNewThumbHtml(item) {
            return pendingDerivedThumbsHtml(item);
        }

        function vendorAssetUpscalePoints(scale) {
            var U = global.MatchdoUpscaleScale;
            var base = uploadPricing.points_upscale != null ? uploadPricing.points_upscale : 1;
            if (U) return U.pointsForScale(base, scale, uploadPricing.upscale_points_by_scale);
            var s = parseInt(scale, 10) || 2;
            return base + (s / 2 - 1);
        }
        function upscaleScaleSelectHtml(extraClass) {
            var U = global.MatchdoUpscaleScale;
            if (U) return U.selectHtml(extraClass || 'matchdo-upscale-scale', uploadPricing);
            return '<select class="form-select form-select-sm ' + (extraClass || 'matchdo-upscale-scale') + '" style="width:auto;max-width:8rem;flex:0 0 auto"><option value="2" selected>2×</option><option value="4">4×</option><option value="6">6×</option><option value="8">8×</option><option value="10">10×</option></select>';
        }
        function upscaleControlsRowHtml(selectClass, buttonAndAfterHtml) {
            var U = global.MatchdoUpscaleScale;
            if (U) return U.controlsRowHtml(selectClass, buttonAndAfterHtml, uploadPricing);
            return '<div class="pending-upscale-controls">' +
                upscaleScaleSelectHtml(selectClass) + (buttonAndAfterHtml || '') + '</div>';
        }
        function pendingFooterFromItem(item, opts) {
            var U = global.MatchdoUpscaleScale;
            if (U && U.footerFromPreviewItem) return U.footerFromPreviewItem(item, opts || {});
            opts = opts || {};
            item = item || {};
            return '<div class="pending-footer-actions">' +
                (item.redrawPreviewUrl ? '<button type="button" class="btn btn-outline-warning btn-sm ' + (opts.redrawClass || 'pending-clear-redraw') + '">清除重繪</button>' : '') +
                (item.upscalePreviewUrl ? '<button type="button" class="btn btn-outline-warning btn-sm ' + (opts.upscaleClass || 'pending-clear-upscale') + '">清除放大</button>' : '') +
                (opts.coverHtml || '') +
                (opts.removeHtml || '') +
                '</div>';
        }
        function pendingFooterActionsRowHtml(partsOrHtml) {
            var U = global.MatchdoUpscaleScale;
            if (partsOrHtml && typeof partsOrHtml === 'object') {
                if (U) return U.footerActionsRowHtml(partsOrHtml);
                return '<div class="pending-footer-actions">' +
                    (partsOrHtml.clearRedraw || '') + (partsOrHtml.clearUpscale || '') +
                    (partsOrHtml.clearD2p || '') + (partsOrHtml.coverHtml || '') +
                    (partsOrHtml.removeHtml || '') + '</div>';
            }
            if (U) return U.footerActionsRowHtml({ removeHtml: partsOrHtml || '' });
            return '<div class="pending-footer-actions">' + (partsOrHtml || '') + '</div>';
        }
        function confirmUpscaleInputLimit(width, height) {
            var U = global.MatchdoUpscaleScale;
            if (U) return U.confirmIfOverInputLimit(width, height);
            return true;
        }
        function readUpscaleScaleFromEl(el) {
            var U = global.MatchdoUpscaleScale;
            if (U) return U.readScaleNear(el);
            return 2;
        }

        var ONE_MP_PX = 1024 * 1024;
        var VENDOR_UPSCALE_MIN_MP = 0.5;
        var VENDOR_UPSCALE_MAX_MP = 1;
        var VENDOR_AI_UPSCALE_BTN = 'AI 放大';
        var VENDOR_UPSCALE_RULE_TEXT = '依原圖比例放大，總解析度最高 1MP';

        function trPreviewEnlargeTitle(suffix) {
            var base = tr('baseModels.previewEnlarge', '預覽放大');
            return suffix ? (base + '（' + suffix + '）') : base;
        }

        function trPreviewEnlargeHint() {
            return tr('baseModels.previewEnlargeHint', '點圖片可預覽放大（只看大圖，不扣點、不產生新檔）。');
        }

        function upscaleApiErrorMessage(data, fallback) {
            var msg = (data && (data.error || data.message)) || fallback || 'AI 放大失敗';
            if (data && data.details) msg += '：' + data.details;
            return msg;
        }
        var AI_EDIT_UPSCALE_URL = '/client/ai-edit.html';
        var AI_EDIT_UPSCALE_HELP_TITLE = '圖片已 ≥0.5 MP。若仍需要更大解析度，請至「我的 AI 編輯區」→ 放大（4×，輸出 ≤4MP，10 點/次）';
        var galleryUpscaleProbe = {};

        function evaluatePendingUpscaleNeed(width, height) {
            var w = width | 0;
            var h = height | 0;
            if (w <= 0 || h <= 0) {
                return { needed: true, megapixels: 0, hint: '無法讀取尺寸，送出時由伺服器判斷', showAiEditHelp: false };
            }
            var px = w * h;
            var mp = px / ONE_MP_PX;
            if (mp >= VENDOR_UPSCALE_MIN_MP) {
                return {
                    needed: false,
                    megapixels: mp,
                    hint: '約 ' + mp.toFixed(2) + ' MP（≥0.5 MP），請用 AI 編輯區放大',
                    showAiEditHelp: true
                };
            }
            return { needed: true, megapixels: mp, hint: VENDOR_UPSCALE_RULE_TEXT, showAiEditHelp: false };
        }

        function pendingUpscaleAiEditHelpHtml(showHelp, extraClass) {
            if (!showHelp) return '';
            var cls = 'pending-upscale-ai-edit-help' + (extraClass ? ' ' + extraClass : '');
            return '<a href="' + esc(AI_EDIT_UPSCALE_URL) + '" class="' + esc(cls) + '" target="_blank" rel="noopener" ' +
                'title="' + esc(AI_EDIT_UPSCALE_HELP_TITLE) + '">AI 編輯區</a>';
        }

        function probeImageDimensionsFromFile(file) {
            return new Promise(function (resolve) {
                if (!file || !file.type || file.type.indexOf('image/') !== 0) {
                    resolve({ width: 0, height: 0 });
                    return;
                }
                var objUrl = URL.createObjectURL(file);
                var img = new Image();
                img.onload = function () {
                    URL.revokeObjectURL(objUrl);
                    resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
                };
                img.onerror = function () {
                    URL.revokeObjectURL(objUrl);
                    resolve({ width: 0, height: 0 });
                };
                img.src = objUrl;
            });
        }

        function probeImageDimensionsFromUrl(url) {
            return new Promise(function (resolve) {
                if (!url) {
                    resolve({ width: 0, height: 0 });
                    return;
                }
                var img = new Image();
                img.onload = function () {
                    resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
                };
                img.onerror = function () {
                    resolve({ width: 0, height: 0 });
                };
                img.src = url;
            });
        }

        function applyItemUpscaleProbe(item, width, height) {
            var ev = evaluatePendingUpscaleNeed(width, height);
            item.upscaleProbeDone = true;
            item.upscaleNeeded = ev.needed;
            item.upscaleMegapixels = ev.megapixels;
            item.upscaleHint = ev.hint;
            item.upscaleShowAiEditHelp = !!ev.showAiEditHelp;
            item.upscaleWidth = width | 0;
            item.upscaleHeight = height | 0;
        }

        function pendingUpscaleBtnDisabled(item) {
            if (item.imageBusy) return true;
            if (item.upscaleProbeDone === true && item.upscaleNeeded === false) return true;
            return false;
        }

        function pendingUpscaleBtnTitle(item) {
            if (item.imageBusy) return '';
            if (item.upscaleProbeDone !== true) return '正在檢查解析度…';
            if (item.upscaleNeeded === false) return item.upscaleHint || '已 ≥0.5 MP，請用 AI 編輯區放大';
            return item.upscaleHint || ('圖片 <0.5 MP 才可 AI 放大（' + VENDOR_UPSCALE_RULE_TEXT + '）');
        }

        function probePendingItemUpscale(form, item, rerenderFn) {
            if (!item || !item.file) return Promise.resolve();
            item.upscaleProbeDone = false;
            return probeImageDimensionsFromFile(item.file).then(function (dim) {
                applyItemUpscaleProbe(item, dim.width, dim.height);
                if (typeof rerenderFn === 'function') rerenderFn();
            });
        }

        function probeGalleryUrlForUpscale(url) {
            if (!url) return Promise.resolve();
            return probeImageDimensionsFromUrl(url).then(function (dim) {
                galleryUpscaleProbe[url] = evaluatePendingUpscaleNeed(dim.width, dim.height);
                syncGalleryUpscaleButtons();
            });
        }

        function syncGalleryUpscaleButtons() {
            var grid = document.getElementById('edit-gallery-grid');
            if (!grid) return;
            grid.querySelectorAll('.gallery-upscale-ai-edit-help').forEach(function (el) { el.remove(); });
            grid.querySelectorAll('.btn-gallery-upscale-one').forEach(function (btn) {
                var url = btn.getAttribute('data-url');
                var probe = galleryUpscaleProbe[url];
                if (!probe) {
                    btn.disabled = false;
                    btn.title = '解析度檢查中，仍可嘗試；' + VENDOR_UPSCALE_RULE_TEXT;
                    return;
                }
                btn.disabled = !probe.needed;
                btn.title = probe.hint || (probe.needed ? VENDOR_UPSCALE_RULE_TEXT : AI_EDIT_UPSCALE_HELP_TITLE);
                if (!probe.needed && probe.showAiEditHelp) {
                    btn.insertAdjacentHTML('afterend', pendingUpscaleAiEditHelpHtml(true, 'gallery-upscale-ai-edit-help'));
                }
            });
        }

        function pendingCardBadgeRow(coverBadge, extraBadge) {
            return '<div class="pending-card-badges d-flex flex-wrap align-items-center gap-1">' +
                (coverBadge || '') + (extraBadge || '') + '</div>';
        }

        function pendingCardActionSpacer() {
            return '<span class="btn btn-outline-primary btn-sm invisible" aria-hidden="true">設為封面</span>' +
                '<span class="btn btn-outline-danger btn-sm invisible" aria-hidden="true">移除</span>';
        }

        function pendingCardClearRedrawSpacer() {
            return '<span class="btn btn-outline-warning btn-sm invisible" aria-hidden="true">清除重繪新圖</span>';
        }

        /** 圖庫卡片：每筆 image_items 一卡，不區分衍生／原圖 */
        function galleryCardsFromItems(items) {
            return (items || []).filter(function (it) { return it && it.url; });
        }

        function editGalleryPreviewBlock(slot, prefix) {
            if (!pendingHasAiPreview(slot)) return '';
            return pendingOriginalUploadCheckHtml(slot, prefix) + pendingDerivedThumbsHtml(slot, prefix);
        }

        function appendMaterialCatalogHintToRedrawFormData(fd, m) {
            if (!fd || !m || normalizeKind(m.asset_kind) !== 'material') return;
            var ids = m.catalog_group_ids || (m.catalog_groups || []).map(function (g) { return g.id; });
            if (ids && ids.length) fd.append('catalog_group_ids', JSON.stringify(ids));
        }

        function appendMaterialCatalogHintToRedrawFormDataFromForm(fd, form) {
            if (!fd || !form || form.getAttribute('data-kind') !== 'material') return;
            var grpIds = getSelectedCatalogGroupIds(form.querySelector('.add-catalog-groups-material'));
            if (grpIds.length) fd.append('catalog_group_ids', JSON.stringify(grpIds));
        }

        function buildMaterialFluxPromptPreview(surfaceType) {
            var t = String(surfaceType || '').trim().replace(/[\[\]{}<>\n\r]/g, '').slice(0, 32);
            if (!t) return '（填材質類型後顯示）';
            return '保持顏色並優化此' + t + '材質光影';
        }

        function syncMaterialFluxPromptPreviewEl(el, surfaceType) {
            if (!el) return;
            el.textContent = buildMaterialFluxPromptPreview(surfaceType);
        }

        function syncAllMaterialFluxPromptPreviews() {
            document.querySelectorAll('.material-flux-prompt-preview').forEach(function (el) {
                var form = el.closest('form');
                syncMaterialFluxPromptPreviewEl(el, form ? getMaterialSurfaceTypeFromAddForm(form) : '');
            });
            syncMaterialFluxPromptPreviewEl(
                document.getElementById('edit-material-flux-prompt-preview'),
                getMaterialSurfaceTypeFromEdit()
            );
        }

        function getMaterialSurfaceTypeFromAddForm(form) {
            if (!form || form.getAttribute('data-kind') !== 'material') return '';
            var inp = form.querySelector('.add-material-surface-type');
            return inp ? String(inp.value || '').trim() : '';
        }

        function getMaterialSurfaceTypeFromEdit() {
            var inp = document.getElementById('edit-material-surface-type');
            return inp ? String(inp.value || '').trim() : '';
        }

        function validateMaterialSurfaceTypeForRedraw(surfaceType) {
            if (String(surfaceType || '').trim()) return '';
            return '請填材質類型（例：皮革、丹寧）再執行 AI 重繪';
        }

        function appendMaterialSurfaceTypeToFormData(fd, surfaceType) {
            if (!fd) return;
            var v = String(surfaceType || '').trim();
            if (v) fd.append('material_surface_type', v);
        }

        function syncEditGalleryMaterialUi(isMaterial) {
            var bgWrap = document.getElementById('edit-gallery-optimize-bg-wrap');
            var surfWrap = document.getElementById('edit-material-surface-wrap');
            if (bgWrap) bgWrap.classList.toggle('d-none', !!isMaterial);
            if (surfWrap) surfWrap.classList.toggle('d-none', !isMaterial);
        }

        function showAiPromptAfterPreview(data) {
            if (!data || !data.ai_prompt) return;
            setEditGalleryStatus('本次 AI 提示詞：' + data.ai_prompt, 'info');
        }

        async function fileFromImageUrl(url, filename) {
            var r = await fetch(url, { mode: 'cors' });
            if (!r.ok) throw new Error('無法讀取圖片');
            var blob = await r.blob();
            var type = (blob.type && blob.type.indexOf('image/') === 0) ? blob.type : 'image/jpeg';
            return new File([blob], filename || 'source.jpg', { type: type });
        }

        function validateEditGallerySlotSelection(slot) {
            var keepOrig = slot.uploadOriginal !== false;
            var keepNew = (slot.uploadRedraw !== false && (!!slot.redrawFile || !!slot.redrawPreviewUrl)) ||
                (slot.uploadUpscale !== false && (!!slot.upscaleFile || !!slot.upscalePreviewUrl));
            if (!keepOrig && !keepNew) return '請至少勾選「上傳原圖」或「上傳此張」';
            return '';
        }

        async function previewGallerySlotRedraw(sourceUrl) {
            if (!sourceUrl || editGalleryUploading) return;
            var id = document.getElementById('edit-id').value;
            var m = materialsAll.find(function (x) { return x.id === id; });
            var surfaceErr = normalizeKind(m && m.asset_kind) === 'material'
                ? validateMaterialSurfaceTypeForRedraw(getMaterialSurfaceTypeFromEdit()) : '';
            if (surfaceErr) { showToast(surfaceErr, 'warning'); return; }
            var pts = calcRedrawPointsForUrl(m, sourceUrl);
            if (!window.confirm('AI 重繪？（-' + pts + ' 點；勾選要上傳的圖後按「儲存」）')) return;
            var slot = editGallerySlotPreview[sourceUrl] || {};
            slot.imageBusy = true;
            editGallerySlotPreview[sourceUrl] = slot;
            if (m) renderEditGallery(m);
            try {
                var tok = token || (await getTokenAsync());
                if (!tok) { showToast('請先登入', 'danger'); return; }
                var items = assetImageItems(m);
                var srcItem = items.find(function (it) { return it.url === sourceUrl; });
                var isCover = srcItem && (srcItem.is_cover || items[0].url === sourceUrl);
                var file = await fileFromImageUrl(sourceUrl, 'gallery-source.jpg');
                var fd = new FormData();
                fd.append('image', file);
                fd.append('asset_kind', m ? m.asset_kind : 'prototype');
                fd.append('is_cover', isCover ? '1' : '0');
                fd.append('optimize_background', getEditGalleryOptimizeBackground());
                if (m && m.title) fd.append('title', m.title);
                if (srcItem && srcItem.label) fd.append('image_label', displayGalleryImageLabel(srcItem));
                appendMaterialCatalogHintToRedrawFormData(fd, m);
                if (m && normalizeKind(m.asset_kind) === 'material') {
                    appendMaterialSurfaceTypeToFormData(fd, getMaterialSurfaceTypeFromEdit());
                }
                var r = await fetch(PREVIEW_REDRAW_URL, {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + tok },
                    body: fd
                });
                var data = await r.json().catch(function () { return {}; });
                if (r.status === 402) {
                    showToast((data.error || '點數不足') + ' (' + (data.required || '') + ')', 'danger');
                    return;
                }
                if (!r.ok) {
                    showToast(data.error || '重繪失敗', 'danger');
                    return;
                }
                slot.redrawPreviewUrl = previewDataUrlFromResponse(data);
                slot.redrawPreviewStorageUrl = data.preview_url || '';
                slot.redrawChargedPts = data.points_deducted || 0;
                slot.previewCreditTxId = data.credit_transaction_id || null;
                slot.uploadRedraw = true;
                slot.uploadOriginal = false;
                slot.redrawFile = await fileFromPreviewResponse(data, 'redraw-gallery.jpg');
                var okMsg = '已產生 AI 新圖，預設只上傳新圖（不保留原圖）';
                if (data.points_deducted) okMsg += ' · -' + data.points_deducted + ' 點';
                showToast(okMsg);
                showAiPromptAfterPreview(data);
            } catch (err) {
                showToast(err.message || '重繪失敗', 'danger');
            } finally {
                slot.imageBusy = false;
                editGallerySlotPreview[sourceUrl] = slot;
                var refreshed = materialsAll.find(function (x) { return x.id === id; });
                if (refreshed) renderEditGallery(refreshed);
            }
        }

        function getEditGallerySlot(sourceUrl) {
            return editGallerySlotPreview[sourceUrl] || null;
        }

        async function clearEditGallerySlotRedrawPreview(sourceUrl) {
            delete editGallerySlotPreview[sourceUrl];
            var id = document.getElementById('edit-id').value;
            var m = materialsAll.find(function (x) { return x.id === id; });
            if (m) renderEditGallery(m);
        }

        async function deleteGalleryImageSilent(url) {
            var id = document.getElementById('edit-id').value;
            if (!id || !url) return null;
            editGalleryHighlightUrls.delete(url);
            var r = await fetch('/api/me/vendor-assets/' + encodeURIComponent(id) + '/gallery-images', {
                method: 'DELETE',
                headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            });
            var data = await r.json().catch(function () { return {}; });
            if (!r.ok) throw new Error(data.error || '移除圖片失敗');
            var idx = materialsAll.findIndex(function (x) { return x.id === id; });
            if (idx >= 0) materialsAll[idx] = data;
            return data;
        }

        async function postGalleryImageFiles(files, labels, derivedKinds) {
            var id = document.getElementById('edit-id').value;
            var tok = token || (await getTokenAsync());
            if (!tok) throw new Error('請先登入');
            var fd = new FormData();
            for (var i = 0; i < files.length; i++) fd.append('images', files[i]);
            if (labels && labels.length) fd.append('image_labels', JSON.stringify(labels));
            if (derivedKinds && derivedKinds.some(function (d) { return d === 'redraw' || d === 'upscale'; })) {
                fd.append('image_ai_derived', JSON.stringify(derivedKinds));
            }
            var r = await fetch('/api/me/vendor-assets/' + encodeURIComponent(id) + '/gallery-images', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + tok },
                body: fd
            });
            var data = await r.json().catch(function () { return {}; });
            if (r.status === 402) throw new Error((data.error || '點數不足') + ' (' + (data.required || '') + ')');
            if (!r.ok) throw new Error(data.error || data.message || '上傳失敗');
            var idx = materialsAll.findIndex(function (x) { return x.id === id; });
            if (idx >= 0) materialsAll[idx] = data;
            return data;
        }

        async function applyEditGallerySlotPreview(sourceUrl, slot) {
            var err = validateEditGallerySlotSelection(slot);
            if (err) return { ok: false, error: err };
            var id = document.getElementById('edit-id').value;
            var m = materialsAll.find(function (x) { return x.id === id; });
            var keepOrig = slot.uploadOriginal !== false;
            var keepNew = (slot.uploadRedraw !== false && (!!slot.redrawFile || !!slot.redrawPreviewUrl)) ||
                (slot.uploadUpscale !== false && (!!slot.upscaleFile || !!slot.upscalePreviewUrl));
            if (keepOrig && !keepNew && !(slot.redrawPreviewUrl || slot.upscalePreviewUrl)) {
                delete editGallerySlotPreview[sourceUrl];
                return { ok: true };
            }
            if (keepOrig && !keepNew) {
                delete editGallerySlotPreview[sourceUrl];
                return { ok: true };
            }
            var srcItem = assetImageItems(m).find(function (it) { return it.url === sourceUrl; });
            var label = srcItem ? (displayGalleryImageLabel(srcItem) || 'AI重繪') : 'AI重繪';
            var urlsBefore = assetImageUrls(m);
            var data = await postGalleryImageFiles([slot.redrawFile], [label], ['redraw']);
            var newUrl = assetImageUrls(data).find(function (u) { return urlsBefore.indexOf(u) < 0; });
            if (!newUrl) return { ok: false, error: '上傳重繪新圖失敗' };
            if (!keepOrig) {
                var coverUrl = String(data.image_url || '').trim();
                if (!coverUrl || coverUrl === sourceUrl) {
                    var tok2 = token || (await getToken());
                    var cr = await fetch('/api/me/vendor-assets/' + encodeURIComponent(id) + '/gallery-images/cover', {
                        method: 'PATCH',
                        headers: { Authorization: 'Bearer ' + tok2, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: newUrl })
                    });
                    var coverData = await cr.json().catch(function () { return {}; });
                    if (cr.ok) {
                        data = coverData;
                        var idx2 = materialsAll.findIndex(function (x) { return x.id === id; });
                        if (idx2 >= 0) materialsAll[idx2] = data;
                    }
                }
                data = await deleteGalleryImageSilent(sourceUrl) || data;
            }
            delete editGallerySlotPreview[sourceUrl];
            return { ok: true, data: data };
        }

        async function flushEditGallerySlotPreviewsBeforeSave() {
            var urls = Object.keys(editGallerySlotPreview).filter(function (u) {
                var s = editGallerySlotPreview[u];
                return s && pendingHasDerivedPreview(s);
            });
            if (!urls.length) return true;
            for (var i = 0; i < urls.length; i++) {
                var slotErr = validateEditGallerySlotSelection(editGallerySlotPreview[urls[i]]);
                if (slotErr) {
                    setEditGalleryStatus(slotErr, 'danger');
                    showToast(slotErr, 'warning');
                    return false;
                }
            }
            if (!window.confirm('將依勾選寫入 ' + urls.length + ' 組 AI 重繪結果。繼續？')) return false;
            editGalleryUploading = true;
            gridDisableEditGalleryActions(true);
            setEditGalleryStatus('寫入勾選的圖片…', 'info');
            try {
                var lastData = null;
                for (var j = 0; j < urls.length; j++) {
                    var applied = await applyEditGallerySlotPreview(urls[j], editGallerySlotPreview[urls[j]]);
                    if (!applied.ok) {
                        setEditGalleryStatus(applied.error || '寫入失敗', 'danger');
                        showToast(applied.error || '寫入失敗', 'danger');
                        return false;
                    }
                    if (applied.data) lastData = applied.data;
                }
                await loadMaterials();
                renderGrid();
                var id = document.getElementById('edit-id').value;
                var refreshed = materialsAll.find(function (x) { return x.id === id; }) || lastData;
                if (refreshed) renderEditGallery(refreshed);
                setEditGalleryStatus('已依勾選寫入圖庫', 'success');
                showToast('已依勾選寫入圖庫');
                return true;
            } catch (err) {
                setEditGalleryStatus(err.message || '寫入失敗', 'danger');
                showToast(err.message || '寫入失敗', 'danger');
                return false;
            } finally {
                releaseEditGalleryBusyState();
            }
        }

        async function previewPendingRedraw(form, item, idx) {
            if (item.imageBusy) return;
            var kindEarly = form.getAttribute('data-kind') || 'prototype';
            if (kindEarly === 'material') {
                var surfaceErr0 = validateMaterialSurfaceTypeForRedraw(getMaterialSurfaceTypeFromAddForm(form));
                if (surfaceErr0) { showToast(surfaceErr0, 'warning'); return; }
            }
            var pts = calcPendingPreviewRedrawPoints(form, idx);
            if (!window.confirm('AI 重繪並追加新圖？（-' + pts + ' 點，原圖保留；發布時一併上傳新圖）')) return;
            item.imageBusy = true;
            renderPendingImages(form);
            try {
                var tok = token || (await getTokenAsync());
                if (!tok) { showToast('請先登入', 'danger'); return; }
                var kind = form.getAttribute('data-kind') || 'prototype';
                var fd = new FormData();
                fd.append('image', item.file);
                fd.append('asset_kind', kind);
                fd.append('is_cover', idx === 0 ? '1' : '0');
                fd.append('optimize_background', getOptimizeBackgroundValue(form));
                var titleIn = form.querySelector('.add-title');
                if (titleIn && titleIn.value) fd.append('title', titleIn.value.trim());
                if (item.label) fd.append('image_label', item.label);
                appendMaterialCatalogHintToRedrawFormDataFromForm(fd, form);
                if (kind === 'material') appendMaterialSurfaceTypeToFormData(fd, getMaterialSurfaceTypeFromAddForm(form));
                var r = await fetch(PREVIEW_REDRAW_URL, {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + tok },
                    body: fd
                });
                var data = await r.json().catch(function () { return {}; });
                if (r.status === 402) {
                    showToast((data.error || '點數不足') + ' (' + (data.required || '') + ')', 'danger');
                    return;
                }
                if (!r.ok) {
                    showToast(data.error || '重繪失敗', 'danger');
                    return;
                }
                item.redrawPreviewUrl = previewDataUrlFromResponse(data);
                item.redrawPreviewStorageUrl = data.preview_url || '';
                item.redrawChargedPts = data.points_deducted || 0;
                item.previewCreditTxId = data.credit_transaction_id || null;
                item.optimize = true;
                item.uploadRedraw = true;
                item.uploadOriginal = false;
                item.redrawFile = await fileFromPreviewResponse(data, 'redraw-' + idx + '.jpg');
                var okMsg = '已產生重繪新圖，預設只上傳新圖（不保留原圖）';
                if (data.points_deducted) okMsg += ' · -' + data.points_deducted + ' 點';
                if (data.ai_prompt) okMsg += ' · 提示詞：' + data.ai_prompt;
                showToast(okMsg);
            } catch (err) {
                showToast(err.message || '重繪失敗', 'danger');
            } finally {
                item.imageBusy = false;
                renderPendingImages(form);
                updateAddFormPointsEstimate(form);
                schedulePendingDraftSave(form);
            }
        }

        async function previewPendingUpscale(form, item, idx, scaleOpt) {
            if (item.imageBusy) return;
            var kind = form.getAttribute('data-kind') || 'prototype';
            if (!vendorUpscaleEnabledForKind(kind)) return;
            if (item.upscaleProbeDone && item.upscaleNeeded === false) {
                showToast((item.upscaleHint || '已 ≥0.5 MP') + ' · 請至「我的 AI 編輯區」放大', 'warning');
                return;
            }
            var scale = (global.MatchdoUpscaleScale && global.MatchdoUpscaleScale.normalizeScale(scaleOpt)) || (parseInt(scaleOpt, 10) || 2);
            var pts = vendorAssetUpscalePoints(scale);
            if (!confirmUpscaleInputLimit(item.upscaleWidth || 0, item.upscaleHeight || 0)) return;
            if (!window.confirm('AI 放大並追加新圖？（' + scale + '×，-' + pts + ' 點，圖片須 <0.5 MP；' + VENDOR_UPSCALE_RULE_TEXT + '）')) return;
            item.imageBusy = true;
            renderPendingImages(form);
            try {
                var tok = token || (await getTokenAsync());
                if (!tok) { showToast('請先登入', 'danger'); return; }
                var fd = new FormData();
                fd.append('image', item.file);
                fd.append('asset_kind', kind);
                fd.append('scale', String(scale));
                var r = await fetch(PREVIEW_UPSCALE_URL, {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + tok },
                    body: fd
                });
                var data = await r.json().catch(function () { return {}; });
                if (r.status === 402) {
                    showToast((data.error || '點數不足') + ' (' + (data.required || '') + ')', 'danger');
                    return;
                }
                if (!r.ok) {
                    showToast(upscaleApiErrorMessage(data), 'danger');
                    return;
                }
                item.upscalePreviewUrl = previewDataUrlFromResponse(data);
                item.upscalePreviewStorageUrl = data.preview_url || '';
                item.upscaleChargedPts = data.points_deducted || 0;
                item.previewCreditTxId = data.credit_transaction_id || null;
                item.uploadUpscale = true;
                item.uploadOriginal = false;
                item.upscaleFile = await fileFromPreviewResponse(data, 'upscale-' + idx + '.jpg');
                var okMsg = '已產生 AI 放大新圖，預設只上傳新圖（不保留原圖）';
                if (data.points_deducted) okMsg += ' · -' + data.points_deducted + ' 點';
                showToast(okMsg);
            } catch (err) {
                showToast(err.message || 'AI 放大失敗', 'danger');
            } finally {
                item.imageBusy = false;
                renderPendingImages(form);
                updateAddFormPointsEstimate(form);
                schedulePendingDraftSave(form);
            }
        }

        function clearPendingRedrawPreview(form, item) {
            item.redrawPreviewUrl = null;
            item.redrawPreviewStorageUrl = '';
            item.redrawFile = null;
            item.redrawChargedPts = 0;
            item.optimize = false;
            item.uploadRedraw = false;
            if (!pendingHasDerivedPreview(item)) item.uploadOriginal = true;
            item.imageBusy = false;
            renderPendingImages(form);
            updateAddFormPointsEstimate(form);
            schedulePendingDraftSave(form);
        }

        function clearPendingUpscalePreview(form, item) {
            item.upscalePreviewUrl = null;
            item.upscalePreviewStorageUrl = '';
            item.upscaleFile = null;
            item.upscaleChargedPts = 0;
            item.uploadUpscale = false;
            if (!pendingHasDerivedPreview(item)) item.uploadOriginal = true;
            item.imageBusy = false;
            renderPendingImages(form);
            updateAddFormPointsEstimate(form);
            schedulePendingDraftSave(form);
        }

        function renderPendingImages(form) {
            var wrap = form.querySelector('.add-pending-images');
            var list = getPendingImages(form);
            if (!wrap) return;
            revokePendingImageUrls(wrap);
            wrap.innerHTML = '';
            var formKind = form.getAttribute('data-kind') || 'prototype';
            var upscaleOn = vendorUpscaleEnabledForKind(formKind);
            list.forEach(function (item, idx) {
                var col = document.createElement('div');
                col.className = 'col-6 col-sm-4 col-md-3';
                var card = document.createElement('div');
                card.className = 'pending-image-card' + (idx === 0 ? ' is-cover' : '') + ((item.redrawPreviewUrl || item.upscalePreviewUrl) ? ' is-new-redraw' : '');
                card.dataset.pendingId = item.id;
                var url = '';
                var objectUrl = '';
                if (item.file) {
                    objectUrl = URL.createObjectURL(item.file);
                    url = objectUrl;
                } else if (item.redrawPreviewUrl) {
                    url = item.redrawPreviewUrl;
                } else if (item.upscalePreviewUrl) {
                    url = item.upscalePreviewUrl;
                }
                var coverBadge = idx === 0 ? '<span class="badge bg-primary" style="font-size:0.65rem">' + esc(tr('baseModels.coverImage', '封面')) + '</span>' : '';
                var imgHtml = item.imageBusy
                    ? '<div class="text-muted small text-center py-4">處理中…</div>'
                    : (url
                        ? '<img src="' + esc(url) + '"' + (objectUrl ? ' data-object-url="' + esc(objectUrl) + '"' : '') + ' class="matchdo-enlarge-trigger" alt="" title="' + esc(trPreviewEnlargeTitle()) + '">'
                        : '<div class="text-muted small text-center py-4">無預覽</div>');
                var upscaleBtnHtml = upscaleOn
                    ? upscaleControlsRowHtml(
                        'pending-upscale-scale matchdo-upscale-scale',
                        '<button type="button" class="btn btn-outline-info btn-sm pending-upscale-btn"' + (pendingUpscaleBtnDisabled(item) ? ' disabled' : '') + ' title="' + esc(pendingUpscaleBtnTitle(item)) + '"><i class="bi bi-stars me-1"></i>' + esc(VENDOR_AI_UPSCALE_BTN) + '</button>' +
                        pendingUpscaleAiEditHelpHtml(item.upscaleProbeDone && item.upscaleShowAiEditHelp)
                    )
                    : '';
                card.innerHTML = pendingCardBadgeRow(coverBadge, '') +
                    '<div class="pending-card-media">' + imgHtml + '</div>' +
                    '<div class="pending-card-preview">' + pendingOriginalUploadCheckHtml(item, 'pending') + pendingDerivedThumbsHtml(item, 'pending', upscaleOn) + '</div>' +
                    '<input type="text" class="form-control form-control-sm mt-1 pending-card-label pending-image-label" placeholder="圖片名稱" value="' + esc(item.label || labelFromFilename(item.file && item.file.name)) + '">' +
                    (formKind === 'prototype' ? pendingLinkGroupFieldHtml(item) : '') +
                    '<div class="pending-actions">' +
                    '<button type="button" class="btn btn-outline-secondary btn-sm pending-redraw-btn"' + (item.imageBusy ? ' disabled' : '') + '><i class="bi bi-magic me-1"></i>AI 重繪</button>' +
                    upscaleBtnHtml +
                    pendingFooterFromItem(item, {
                        redrawClass: 'pending-clear-redraw',
                        upscaleClass: 'pending-clear-upscale',
                        coverHtml: idx > 0
                            ? '<button type="button" class="btn btn-outline-primary btn-sm pending-set-cover">設為封面</button>'
                            : '',
                        removeHtml: '<button type="button" class="btn btn-outline-danger btn-sm pending-remove">移除</button>'
                    }) +
                    '</div>';
                col.appendChild(card);
                wrap.appendChild(col);
                card.querySelector('.pending-redraw-btn').addEventListener('click', function () {
                    previewPendingRedraw(form, item, idx);
                });
                var upscaleBtn = card.querySelector('.pending-upscale-btn');
                if (upscaleBtn) {
                    upscaleBtn.addEventListener('click', function () {
                        previewPendingUpscale(form, item, idx, readUpscaleScaleFromEl(upscaleBtn));
                    });
                }
                wirePendingUploadCheckboxes(card, item, 'pending');
                var clearBtn = card.querySelector('.pending-clear-redraw');
                if (clearBtn) {
                    clearBtn.addEventListener('click', function () { clearPendingRedrawPreview(form, item); });
                }
                var clearUp = card.querySelector('.pending-clear-upscale');
                if (clearUp) {
                    clearUp.addEventListener('click', function () { clearPendingUpscalePreview(form, item); });
                }
                var labelIn = card.querySelector('.pending-image-label');
                if (labelIn) {
                    labelIn.addEventListener('input', function () {
                        item.label = (this.value || '').trim();
                        schedulePendingDraftSave(form);
                    });
                }
                var linkGroupIn = card.querySelector('.pending-link-group');
                if (linkGroupIn) {
                    linkGroupIn.addEventListener('input', function () {
                        item.link_group = (this.value || '').trim();
                        schedulePendingDraftSave(form);
                    });
                }
                card.querySelector('.pending-remove').addEventListener('click', function () {
                    var i = list.findIndex(function (x) { return x.id === item.id; });
                    if (i >= 0) list.splice(i, 1);
                    renderPendingImages(form);
                    updateAddFormPointsEstimate(form);
                    schedulePendingDraftSave(form);
                });
                var setCoverBtn = card.querySelector('.pending-set-cover');
                if (setCoverBtn) {
                    setCoverBtn.addEventListener('click', function () {
                        var i = list.findIndex(function (x) { return x.id === item.id; });
                        if (i > 0) {
                            var moved = list.splice(i, 1)[0];
                            list.unshift(moved);
                            renderPendingImages(form);
                            updateAddFormPointsEstimate(form);
                        }
                    });
                }
            });
        }

        function collectPreviewCreditTxIds(form) {
            return getPendingImages(form).reduce(function (ids, p) {
                if (p.previewCreditTxId) ids.push(p.previewCreditTxId);
                return ids;
            }, []);
        }

        function uploadFailureMessage(form, data, status) {
            var failMsg = (data && data.error) || '上傳失敗';
            if (data && data.preview_points_refunded > 0) {
                if (data.balance_after != null) {
                    failMsg += ' · 餘額 ' + data.balance_after;
                }
                getPendingImages(form).forEach(function (p) {
                    p.redrawChargedPts = 0;
                    p.upscaleChargedPts = 0;
                    p.previewCreditTxId = null;
                });
                return failMsg;
            }
            var charged = getPendingImages(form).reduce(function (s, p) {
                return s + (p.redrawChargedPts || 0) + (p.upscaleChargedPts || 0);
            }, 0);
            if (charged > 0 || status >= 500) {
                failMsg += '。重繪／放大圖仍保留在上方待傳清單（綠框），請勿關閉此頁後再按發布；本次未扣發布上傳費。';
            }
            return failMsg;
        }

        function updateAddFormPointsEstimate(form) {
            if (!form) return;
            var kind = form.getAttribute('data-kind') || 'prototype';
            if (kind !== 'prototype' && kind !== 'part' && kind !== 'material') return;
            var list = getPendingImages(form);
            var upload = uploadPricing.points_upload != null ? uploadPricing.points_upload : 5;
            var charged = list.reduce(function (s, p) {
                return s + (p.redrawChargedPts || 0) + (p.upscaleChargedPts || 0);
            }, 0);
            var valEl = form.querySelector('.add-points-estimate-val');
            var hintEl = form.querySelector('.add-points-estimate-hint');
            var redrawLine = form.querySelector('.add-points-redraw-estimate-line');
            if (valEl) valEl.textContent = String(upload);
            if (hintEl) {
                var upscaleHint = vendorUpscaleEnabledForKind(kind)
                    ? '重繪／AI 放大後請勾選要上傳的圖，可只傳原圖或只傳新圖'
                    : '重繪後請勾選要上傳的圖，可只傳原圖或只傳新圖';
                hintEl.textContent = charged > 0
                    ? '（發布上傳 ' + upload + ' 點；已預覽重繪 -' + charged + ' 點，發布時採用預覽不再重扣）'
                    : '（發布上傳 ' + upload + ' 點；' + upscaleHint + '）';
            }
            if (redrawLine) redrawLine.classList.add('d-none');
            syncAddFormOptimizeBgWrap(form);
        }

        function clearSupplierRefForManualUpload(form) {
            if (!form || form.dataset.supplierImported !== '1') return;
            delete form.dataset.supplierImported;
            delete form.dataset.supplierVendorAssetId;
            var st = form.querySelector('.supplier-ref-status');
            if (st) { st.classList.add('d-none'); st.innerHTML = ''; }
            showLocalImagePreview(form.querySelector('.add-image-preview'), null);
        }

        function appendFilesToPending(form, fileList) {
            if (!form || !fileList || !fileList.length) return 0;
            var list = getPendingImages(form);
            var added = 0;
            for (var i = 0; i < fileList.length; i++) {
                if (list.length >= PROTOTYPE_MAX_IMAGES) {
                    showToast('最多 ' + PROTOTYPE_MAX_IMAGES + ' 張圖片', 'warning');
                    break;
                }
                list.push({
                    id: 'p' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2),
                    file: fileList[i],
                    optimize: false,
                    label: labelFromFilename(fileList[i].name),
                    link_group: '',
                    uploadOriginal: true,
                    uploadRedraw: false,
                    uploadUpscale: false,
                    upscaleProbeDone: false,
                    upscaleNeeded: true
                });
                added++;
            }
            if (added) {
                clearSupplierRefForManualUpload(form);
                renderPendingImages(form);
                updateAddFormPointsEstimate(form);
                schedulePendingDraftSave(form);
                if (vendorUpscaleEnabledForKind(form.getAttribute('data-kind') || 'prototype')) {
                    list.slice(-added).forEach(function (item) {
                        probePendingItemUpscale(form, item, function () { renderPendingImages(form); });
                    });
                }
            }
            return added;
        }

  function wirePendingImageUpload(form) {
    var multiInput = form.querySelector('.add-image-multi');
    if (!multiInput || multiInput._wired) return;
    multiInput._wired = true;
    multiInput.addEventListener('change', function () {
      if (!multiInput.files || !multiInput.files.length) return;
      appendFilesToPending(form, multiInput.files);
      multiInput.value = '';
    });
  }
  global.MatchdoVendorAssetPending = {
    getPendingImages: getPendingImages,
    clearPendingImages: clearPendingImages,
    renderPendingImages: renderPendingImages,
    appendFilesToPending: appendFilesToPending,
    wirePendingImageUpload: wirePendingImageUpload,
    collectPendingUploadPayload: collectPendingUploadPayload,
    validatePendingUploadList: validatePendingUploadList,
    ensureAllPendingDerivedFiles: ensureAllPendingDerivedFiles,
    updateAddFormPointsEstimate: updateAddFormPointsEstimate,
    collectPreviewCreditTxIds: collectPreviewCreditTxIds,
    uploadFailureMessage: uploadFailureMessage,
    getMaterialSurfaceTypeFromAddForm: getMaterialSurfaceTypeFromAddForm,
    validateMaterialSurfaceTypeForRedraw: validateMaterialSurfaceTypeForRedraw,
    appendMaterialSurfaceTypeToFormData: appendMaterialSurfaceTypeToFormData,
    appendMaterialCatalogHintToRedrawFormDataFromForm: appendMaterialCatalogHintToRedrawFormDataFromForm,
    syncAllMaterialFluxPromptPreviews: syncAllMaterialFluxPromptPreviews,
    vendorUpscaleEnabledForKind: vendorUpscaleEnabledForKind,
    labelFromFilename: labelFromFilename,
    getMaterialSurfaceTypeFromEdit: getMaterialSurfaceTypeFromEdit,
    syncEditGalleryMaterialUi: syncEditGalleryMaterialUi,
    appendMaterialCatalogHintToRedrawFormData: appendMaterialCatalogHintToRedrawFormData,
    init: function () { if (CFG.onInit) CFG.onInit(global.MatchdoVendorAssetPending); }
  };
})(typeof window !== 'undefined' ? window : this);
