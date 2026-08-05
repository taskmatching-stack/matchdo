/**
 * SSR 版型卡 — 對齊設計頁 buildVendorStyleBrowseCardHtml（bs-card）
 * 唯一按鈕規則：用此款／加入參考圖；看可搭配僅 link_count>0 → 產品樹
 */
'use strict';

function escapeHtmlAttr(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeHtmlText(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function prototypeLinkCount(item) {
    if (!item) return 0;
    if (item.link_count != null) return Number(item.link_count) || 0;
    return (Number(item.material_count || 0) + Number(item.part_count || 0)) || 0;
}

/** 對齊 VendorAssetShareUrls.buildShareDesignPath */
function designPath(item, opts) {
    opts = opts || {};
    if (!item || !item.id) return '/custom-product.html?tab=product-design';
    const official = opts.official === true || item.official === true;
    const kind = String(item.asset_kind || 'prototype').toLowerCase();
    let url = '/custom-product.html?tab=product-design';
    if (item.manufacturer_id && !official) {
        url += '&manufacturer_id=' + encodeURIComponent(item.manufacturer_id);
    }
    if (official) url += '&official=1';
    if (kind === 'material' || kind === 'part') {
        url += '&vendor_asset_id=' + encodeURIComponent(item.id);
    } else {
        url += '&prototype_asset_id=' + encodeURIComponent(item.id);
    }
    if (item.category_key) url += '&category_key=' + encodeURIComponent(item.category_key);
    if (item.subcategory_key) url += '&subcategory_key=' + encodeURIComponent(item.subcategory_key);
    return url;
}

/** 對齊設計頁舊卡：return_to 固定設計稿（產品樹「用此款開始設計」才會導入四槽） */
function matchGuidePath(item, returnPage) {
    if (!item || !item.id) return '';
    const kind = String(item.asset_kind || 'prototype').toLowerCase();
    if (kind === 'material' || kind === 'part') return '';
    // 舊版唯一正確：回設計稿，不是版型列表
    const returnTo = encodeURIComponent(
        returnPage || '/custom-product.html?tab=product-design'
    );
    let url = (item.match_guide_url && String(item.match_guide_url).trim())
        ? String(item.match_guide_url).trim()
        : ('/product-tree.html?prototype_asset_id=' + encodeURIComponent(item.id));
    if (url.indexOf('return_to=') < 0) {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'return_to=' + returnTo;
    }
    return url;
}

function selectLabel(item, official) {
    const kind = String((item && item.asset_kind) || 'prototype').toLowerCase();
    if (official && (kind === 'material' || kind === 'part')) return '加入參考圖';
    return '用此款進行設計';
}

function mfrLogoHtml(logoUrl) {
    if (logoUrl) {
        return '<img src="' + escapeHtmlAttr(logoUrl) + '" alt="" class="vendor-asset-mfr-logo" loading="lazy">';
    }
    return '<span class="vendor-asset-mfr-logo vendor-asset-mfr-logo--ph" aria-hidden="true"></span>';
}

/**
 * @param {object} item
 * @param {object} opts
 * @param {boolean} [opts.official]
 * @param {string} [opts.returnPage] - 看可搭配 return_to
 * @param {function} [opts.proxyImage]
 * @param {string} [opts.base]
 */
function buildBrowseStyleCardHtml(item, opts) {
    opts = opts || {};
    if (!item || !item.id) return '';
    const official = opts.official === true || item.official === true;
    const returnPage = opts.returnPage || '/custom-product.html?tab=product-design';
    const proxyImage = typeof opts.proxyImage === 'function'
        ? opts.proxyImage
        : function (u) { return u; };
    const base = opts.base || '';

    const imgRaw = item.image_url || '';
    const imgUrl = escapeHtmlAttr(proxyImage(imgRaw, base) || '');
    const title = escapeHtmlText(item.title || '未命名');
    const titleAttr = escapeHtmlAttr(item.title || '未命名');
    const kind = String(item.asset_kind || 'prototype').toLowerCase();
    const linkCount = prototypeLinkCount(item);
    const hasLinks = kind !== 'material' && kind !== 'part' && linkCount > 0;
    const design = designPath(item, { official: official });
    const guide = hasLinks ? matchGuidePath(item, returnPage) : '';

    const selectLbl = escapeHtmlText(selectLabel(item, official));
    const selectBtn = '<a href="' + escapeHtmlAttr(design) + '" class="btn btn-sm btn-primary w-100 bs-btn-select-design">' +
        selectLbl + '</a>';
    const guideBtn = (hasLinks && guide)
        ? ('<a href="' + escapeHtmlAttr(guide) + '" class="btn btn-sm btn-outline-secondary w-100">看可搭配</a>')
        : '';

    const linkHint = hasLinks
        ? ('<span class="badge bg-light text-secondary border mb-1">可搭配 ' +
            escapeHtmlText(String(linkCount)) + ' 項</span> ')
        : '';

    let kindBadge = '';
    if (official) {
        if (kind === 'material') {
            kindBadge = '<span class="badge bg-success-subtle text-success border mb-1">材料</span> ';
        } else if (kind === 'part') {
            kindBadge = '<span class="badge bg-warning-subtle text-warning border mb-1">配件／零件</span> ';
        } else {
            kindBadge = '<span class="badge bg-primary-subtle text-primary border mb-1">數位原型</span> ';
        }
    }

    const thumb = imgUrl
        ? ('<div class="bs-card-thumb-wrap position-relative">' +
            '<div class="bs-card-thumb-link"><img src="' + imgUrl + '" alt="' + titleAttr +
            '" class="bs-card-thumb-img" loading="lazy" width="400" height="400"></div></div>')
        : '<div class="bs-card-thumb-placeholder"><i class="bi bi-image fs-2"></i></div>';

    let mfrRow;
    if (official) {
        mfrRow = '<div class="small text-muted text-truncate">官方版型</div>';
    } else {
        const mfrName = escapeHtmlText(item.manufacturer_name || '廠商');
        const profile = item.manufacturer_profile_url
            || (item.manufacturer_id
                ? ('/vendor-profile.html?id=' + encodeURIComponent(item.manufacturer_id))
                : '#');
        const logo = mfrLogoHtml(item.manufacturer_logo_url
            ? proxyImage(item.manufacturer_logo_url, base)
            : '');
        mfrRow = '<div class="d-flex align-items-center gap-1">' + logo +
            '<a href="' + escapeHtmlAttr(profile) +
            '" class="small text-primary text-decoration-none text-truncate" target="_blank" rel="noopener" title="' +
            escapeHtmlAttr(item.manufacturer_name || '廠商') + '">' + mfrName + '</a></div>';
    }

    return (
        '<article class="bs-card h-100 d-flex flex-column"' +
        (official ? ' data-official="1"' : '') +
        ' data-vendor-asset-id="' + escapeHtmlAttr(item.id) + '"' +
        ' data-asset-kind="' + escapeHtmlAttr(kind) + '">' +
        thumb +
        '<div class="bs-card-body p-2 flex-grow-1">' +
        kindBadge +
        linkHint +
        '<div class="fw-semibold small text-truncate mb-1" title="' + titleAttr + '">' + title + '</div>' +
        mfrRow +
        '</div>' +
        '<div class="p-2 pt-0 bs-card-actions d-grid gap-1">' + guideBtn + selectBtn + '</div>' +
        '</article>'
    );
}

function categoryFilterLinks(basePath, categories, categoryKey) {
    const links = [
        '<a class="btn btn-sm ' + (!categoryKey ? 'btn-secondary' : 'btn-outline-secondary') +
        '" href="' + escapeHtmlAttr(basePath) + '">全部</a>'
    ];
    (categories || []).forEach(function (c) {
        if (!c || !c.key) return;
        const href = basePath + '?category_key=' + encodeURIComponent(c.key);
        const active = categoryKey === c.key;
        links.push(
            '<a class="btn btn-sm ' + (active ? 'btn-secondary' : 'btn-outline-secondary') +
            '" href="' + escapeHtmlAttr(href) + '">' + escapeHtmlText(c.name || c.key) + '</a>'
        );
    });
    return links.join('');
}

module.exports = {
    escapeHtmlAttr,
    escapeHtmlText,
    prototypeLinkCount,
    designPath,
    matchGuidePath,
    buildBrowseStyleCardHtml,
    categoryFilterLinks
};
