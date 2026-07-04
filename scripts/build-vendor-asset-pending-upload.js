/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../public/client/manufacturer-materials.html'), 'utf8');
const lines = src.split(/\r?\n/);
const ranges = [[1120, 1123], [1265, 1270], [1405, 1475], [1771, 2804]];
const chunks = [];
for (const [a, b] of ranges) chunks.push(...lines.slice(a - 1, b));

const header = `/**
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
  var uploadPricing = CFG.uploadPricing || { points_upload: 5, points_optimize: 15, points_optimize_material: 10, points_optimize_extra: 5, points_upscale: 5 };
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
`;

const footer = `
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
`;

let body = chunks.join('\n');
// 移除 IndexedDB 草稿（供應商頁不需要）
body = body.replace(/\n        var pendingDraftDbPromise[\s\S]*?\n        function getPendingImages\(form\) \{/m, '\n        function getPendingImages(form) {');
body = body.replace(/fetch\('\/api\/me\/vendor-assets\/preview-image-redraw'/g, 'fetch(PREVIEW_REDRAW_URL');
body = body.replace(/fetch\('\/api\/me\/vendor-assets\/preview-image-upscale'/g, 'fetch(PREVIEW_UPSCALE_URL');
body = body.replace(/var tok = token \|\| \(await getToken\(\)\)/g, 'var tok = token || (await getTokenAsync())');
body = body.replace(
  /function prototypeShowsLinkGroup\(kindOrAsset\) \{[\s\S]*?\n        \}/m,
  'function prototypeShowsLinkGroup(kindOrAsset) { return enableLinkGroup && normalizeKind(typeof kindOrAsset === "string" ? kindOrAsset : (kindOrAsset && kindOrAsset.asset_kind)) === "prototype"; }'
);
body = body.replace(/function wirePendingImageUpload\(form\) \{[\s\S]*?\n        \}\n\n        function renderPendingImages/m, 'function renderPendingImages');

const out = path.join(__dirname, '../public/js/vendor-asset-pending-upload.js');
fs.writeFileSync(out, header + '\n' + body + '\n' + footer);
console.log('wrote', out, fs.statSync(out).size, 'bytes');
