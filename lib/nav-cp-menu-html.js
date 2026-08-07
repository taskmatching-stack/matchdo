/**
 * 客製產品 dropdown 內容（單一來源；site-header.js 須同步）
 */
'use strict';

function buildNavCpMenuInnerHtml(t) {
    t = typeof t === 'function' ? t : function (k) { return k; };
    return (
        '<a href="/custom-product.html" class="nav-cp-link nav-cp-link--design"><i class="bi bi-pencil-square"></i>' +
        (t('nav.productDesign') || '設計稿') + '</a>' +
        '<div class="nav-cp-section nav-cp-section--structure">' +
        '<span class="nav-cp-section-label">' + (t('nav.sectionStructure') || '以結構') + '</span>' +
        '<a href="/vendor-styles/" class="nav-cp-link"><i class="bi bi-grid"></i>' + t('nav.browseVendorStyles') + '</a>' +
        '<a href="/official-templates/" class="nav-cp-link"><i class="bi bi-collection"></i>' + t('nav.browseOfficialTemplates') + '</a>' +
        '</div>' +
        '<div class="nav-cp-section nav-cp-section--style">' +
        '<span class="nav-cp-section-label">' + (t('nav.sectionStyle') || '以風格') + '</span>' +
        '<a href="/client/material-dual-color.html?return=design" class="nav-cp-link"><i class="bi bi-layout-split"></i>' +
        (t('nav.materialCombination') || '材料組合') + '</a>' +
        '<a href="/client/print-asset.html" class="nav-cp-link"><i class="bi bi-flower1"></i>' + (t('nav.printAsset') || '印花') + '</a>' +
        '</div>' +
        '<div class="nav-cp-section nav-cp-section--marketing">' +
        '<span class="nav-cp-section-label">' + (t('nav.marketingVisuals') || '行銷影像') + '</span>' +
        '<a href="/promo-image/" class="nav-cp-link"><i class="bi bi-megaphone"></i>' + t('nav.promoImage') + '</a>' +
        '<a href="/promo-camera" class="nav-cp-link"><i class="bi bi-camera"></i>' + (t('nav.promoCamera') || '商攝導演') + '</a>' +
        '</div>' +
        '<div class="nav-cp-section nav-cp-section--assist">' +
        '<span class="nav-cp-section-label">' + (t('nav.sectionAssistTools') || '輔助工具') + '</span>' +
        '<a href="/pattern-extract/" class="nav-cp-link"><i class="bi bi-bounding-box"></i>' + t('nav.patternExtract') + '</a>' +
        '<a href="/design-to-physical/" class="nav-cp-link"><i class="bi bi-box"></i>' + t('nav.designToPhysical') + '</a>' +
        '<a href="/scene-sim/" class="nav-cp-link"><i class="bi bi-image"></i>' + t('nav.sceneSim') + '</a>' +
        '</div>' +
        '<div class="nav-cp-section nav-cp-section--utility">' +
        '<a href="/client/my-custom-products.html" class="nav-cp-link"><i class="bi bi-box-seam"></i>' +
        (t('nav.myCustomProducts') || '我的數位資產') + '</a>' +
        '<a href="/custom/gallery.html" class="nav-cp-link"><i class="bi bi-images"></i>' +
        (t('gallery.title') || '圖庫找廠商') + '</a>' +
        '</div>'
    );
}

module.exports = { buildNavCpMenuInnerHtml: buildNavCpMenuInnerHtml };
