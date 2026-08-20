/**
 * SSR 版型卡 — 對齊設計頁 buildVendorStyleBrowseCardHtml（bs-card）
 * 唯一按鈕規則：用此款／加入參考圖；看可搭配僅 link_count>0 → 產品樹
 */
'use strict';

const publicLang = require('./public-lang');

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

/** 對齊設計頁 vendorStyleItemImageItems：封面＋圖庫供 lightbox 左右切換 */
function browseItemImageItems(item, proxyImage, base) {
    if (!item) return [];
    var proxy = typeof proxyImage === 'function' ? proxyImage : function (u) { return u; };
    var b = base || '';
    var out = [];
    if (item.image_items && item.image_items.length) {
        item.image_items.forEach(function (it) {
            if (!it || !it.url) return;
            out.push({
                url: proxy(it.url, b) || it.url,
                label: String(it.label != null ? it.label : '').trim()
            });
        });
        if (out.length) return out;
    }
    var urls = (item.image_urls && item.image_urls.length)
        ? item.image_urls.filter(Boolean)
        : (item.image_url ? [item.image_url] : []);
    return urls.map(function (u, idx) {
        var pu = proxy(u, b) || u;
        return { url: pu, label: '' };
    });
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

function selectLabelKey(item, official) {
    const kind = String((item && item.asset_kind) || 'prototype').toLowerCase();
    if (official && (kind === 'material' || kind === 'part')) return 'browseStyles.addAsRef';
    return 'browseStyles.selectForDesign';
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
    const imageItems = browseItemImageItems(item, proxyImage, base);
    const imageUrls = imageItems.map(function (it) { return it.url; }).filter(Boolean);
    const imgUrl = imageUrls.length
        ? escapeHtmlAttr(imageUrls[0])
        : escapeHtmlAttr(proxyImage(imgRaw, base) || '');
    const imageItemsJson = escapeHtmlAttr(JSON.stringify(imageItems)).replace(/"/g, '&quot;');
    const title = escapeHtmlText(item.title || '未命名');
    const titleAttr = escapeHtmlAttr(item.title || '未命名');
    const kind = String(item.asset_kind || 'prototype').toLowerCase();
    const linkCount = prototypeLinkCount(item);
    const hasLinks = kind !== 'material' && kind !== 'part' && linkCount > 0;
    const design = designPath(item, { official: official });
    const guide = hasLinks ? matchGuidePath(item, returnPage) : '';

    const selectKey = selectLabelKey(item, official);
    const selectLbl = escapeHtmlText(selectLabel(item, official));
    const selectBtn = '<a href="' + escapeHtmlAttr(design) + '" class="btn btn-sm btn-primary w-100 bs-btn-select-design">' +
        '<span data-i18n="' + escapeHtmlAttr(selectKey) + '">' + selectLbl + '</span></a>';
    const guideBtn = (hasLinks && guide)
        ? ('<a href="' + escapeHtmlAttr(guide) + '" class="btn btn-sm btn-outline-secondary w-100">' +
            '<span data-i18n="browseStyles.viewMatchGuide">看可搭配</span></a>')
        : '';

    const linkHint = hasLinks
        ? ('<span class="badge bg-light text-secondary border mb-1" data-i18n-link-count="' +
            escapeHtmlAttr(String(linkCount)) + '">可搭配 ' +
            escapeHtmlText(String(linkCount)) + ' 項</span> ')
        : '';

    let kindBadge = '';
    if (official) {
        if (kind === 'material') {
            kindBadge = '<span class="badge bg-success-subtle text-success border mb-1" data-i18n="browseStyles.badgeMaterial">材料</span> ';
        } else if (kind === 'part') {
            kindBadge = '<span class="badge bg-warning-subtle text-warning border mb-1" data-i18n="browseStyles.badgePart">配件／零件</span> ';
        } else {
            kindBadge = '<span class="badge bg-primary-subtle text-primary border mb-1" data-i18n="browseStyles.badgePrototype">數位原型</span> ';
        }
    }

    const multiBadge = imageUrls.length > 1
        ? ('<span class="badge bg-dark position-absolute top-0 start-0 m-1 bs-card-img-count" style="z-index:2;font-size:.65rem">' +
            escapeHtmlText(String(imageUrls.length)) + ' 張</span>')
        : '';

    const thumb = imgUrl
        ? ('<div class="bs-card-thumb-wrap position-relative">' + multiBadge +
            '<img src="' + imgUrl + '" alt="' + titleAttr +
            '" class="bs-card-thumb-img matchdo-enlarge-trigger" loading="lazy" width="400" height="400"' +
            ' title="點擊放大預覽" data-lightbox-caption="' + titleAttr + '"' +
            ' data-image-items="' + imageItemsJson + '"></div>')
        : '<div class="bs-card-thumb-placeholder"><i class="bi bi-image fs-2"></i></div>';

    let mfrRow;
    if (official) {
        mfrRow = '<div class="small text-muted text-truncate" data-i18n="browseStyles.officialLabel">官方版型</div>';
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
        ' data-image-url="' + imgUrl + '"' +
        ' data-image-items="' + imageItemsJson + '"' +
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

function categoryFilterLinks(basePath, categories, categoryKey, lang) {
    lang = publicLang.normalizePublicLang(lang);
    const links = [
        '<a class="btn btn-sm ' + (!categoryKey ? 'btn-secondary' : 'btn-outline-secondary') +
        '" href="' + escapeHtmlAttr(basePath) + '"><span data-i18n="browseStyles.filterAll">全部</span></a>'
    ];
    (categories || []).forEach(function (c) {
        if (!c || !c.key) return;
        const href = basePath + '?category_key=' + encodeURIComponent(c.key);
        const active = categoryKey === c.key;
        const nameZh = c.name || c.key;
        const nameEn = c.name_en || '';
        const displayName = publicLang.pickLocalizedName(nameZh, nameEn, lang);
        links.push(
            '<a class="btn btn-sm ' + (active ? 'btn-secondary' : 'btn-outline-secondary') +
            '" href="' + escapeHtmlAttr(href) + '">' +
            '<span class="bs-cat-filter-label" data-cat-key="' + escapeHtmlAttr(c.key) + '"' +
            ' data-name-zh="' + escapeHtmlAttr(nameZh) + '"' +
            ' data-name-en="' + escapeHtmlAttr(nameEn) + '">' +
            escapeHtmlText(displayName) + '</span></a>'
        );
    });
    return links.join('');
}

function getCategoryFilterLabel(categories, categoryKey, lang) {
    lang = publicLang.normalizePublicLang(lang);
    if (!categoryKey) {
        return lang === 'en' ? 'All' : '全部';
    }
    var cat = (categories || []).find(function (c) { return c && c.key === categoryKey; });
    if (!cat) return categoryKey;
    return publicLang.pickLocalizedName(cat.name || cat.key, cat.name_en || '', lang);
}

function getSubcategoryFilterLabel(categories, categoryKey, subcategoryKey, lang) {
    lang = publicLang.normalizePublicLang(lang);
    if (!subcategoryKey) {
        return lang === 'en' ? 'All subcategories' : '全部子分類';
    }
    var cat = (categories || []).find(function (c) { return c && c.key === categoryKey; });
    var subs = (cat && cat.subcategories) || [];
    var sub = subs.find(function (s) { return s && s.key === subcategoryKey; });
    if (!sub) return subcategoryKey;
    return publicLang.pickLocalizedName(sub.name || sub.key, sub.name_en || '', lang);
}

/**
 * 設計頁同款過濾列：主／子分類下拉 +（官方）素材類型 +（廠商）廠商名 + 搜尋
 * 禁止再輸出大分類 chip 牆。
 * 預設以中文顯示分類名；僅 ?lang=en 時才用英文（勿因瀏覽器語系 SSR 英文選單）。
 */
function buildBrowseCatalogFiltersHtml(opts) {
    opts = opts || {};
    var basePath = String(opts.basePath || '/').trim() || '/';
    var mode = String(opts.mode || 'official').trim().toLowerCase() === 'vendor' ? 'vendor' : 'official';
    var lang = publicLang.normalizePublicLang(opts.lang);
    var isEn = lang === 'en';
    var categories = opts.categories || [];
    var categoryKey = String(opts.categoryKey || '').trim();
    var subcategoryKey = String(opts.subcategoryKey || '').trim();
    var assetKind = String(opts.assetKind || '').trim();
    var assetKindExplicitAll = opts.assetKindExplicitAll === true;
    var manufacturerName = String(opts.manufacturerName || '').trim();
    var q = String(opts.q || '').trim();

    function catLabel(zh, en) {
        return publicLang.pickLocalizedName(zh, en, lang);
    }

    var mainOpts = [
        '<option value="" data-name-zh="請選擇主分類" data-name-en="Select category">' +
        escapeHtmlText(isEn ? 'Select category' : '請選擇主分類') + '</option>'
    ];
    categories.forEach(function (c) {
        if (!c || !c.key) return;
        var zh = c.name || c.key;
        var en = c.name_en || '';
        mainOpts.push(
            '<option value="' + escapeHtmlAttr(c.key) + '"' +
            ' data-cat-key="' + escapeHtmlAttr(c.key) + '"' +
            ' data-name-zh="' + escapeHtmlAttr(zh) + '"' +
            ' data-name-en="' + escapeHtmlAttr(en) + '"' +
            (categoryKey === c.key ? ' selected' : '') + '>' +
            escapeHtmlText(catLabel(zh, en)) + '</option>'
        );
    });

    var activeCat = categories.find(function (c) { return c && c.key === categoryKey; });
    var subs = (activeCat && activeCat.subcategories) || [];
    var subOpts = [
        '<option value="" data-name-zh="全部子分類" data-name-en="All subcategories">' +
        escapeHtmlText(isEn ? 'All subcategories' : '全部子分類') + '</option>'
    ];
    subs.forEach(function (s) {
        if (!s || !s.key) return;
        var zh = s.name || s.key;
        var en = s.name_en || '';
        subOpts.push(
            '<option value="' + escapeHtmlAttr(s.key) + '"' +
            ' data-name-zh="' + escapeHtmlAttr(zh) + '"' +
            ' data-name-en="' + escapeHtmlAttr(en) + '"' +
            (subcategoryKey === s.key ? ' selected' : '') + '>' +
            escapeHtmlText(catLabel(zh, en)) + '</option>'
        );
    });

    var kindBlock = '';
    if (mode === 'official') {
        var kindValue = assetKindExplicitAll ? '' : (assetKind || 'prototype');
        var kinds = [
            { v: 'prototype', zh: '數位原型', en: 'Digital prototype' },
            { v: 'part', zh: '配件／零件', en: 'Parts' },
            { v: 'material', zh: '材料/顏色', en: 'Materials' },
            { v: '', zh: '類型 — 全部', en: 'All types' }
        ];
        var kindOpts = kinds.map(function (k) {
            var selected = k.v === kindValue;
            return '<option value="' + escapeHtmlAttr(k.v) + '"' +
                ' data-name-zh="' + escapeHtmlAttr(k.zh) + '"' +
                ' data-name-en="' + escapeHtmlAttr(k.en) + '"' +
                (selected ? ' selected' : '') + '>' +
                escapeHtmlText(isEn ? k.en : k.zh) + '</option>';
        }).join('');
        kindBlock =
            '<div class="col-md-3">' +
            '<label class="form-label small mb-1" for="bsCatalogAssetKind">' +
            escapeHtmlText(isEn ? 'Asset type' : '素材類型') + '</label>' +
            '<select class="form-select form-select-sm" id="bsCatalogAssetKind" name="asset_kind">' +
            kindOpts + '</select></div>';
    }

    var mfrBlock = '';
    if (mode === 'vendor') {
        mfrBlock =
            '<div class="col-md-3">' +
            '<label class="form-label small mb-1" for="bsCatalogMfrName">' +
            escapeHtmlText(isEn ? 'Vendor name' : '廠商名稱') + '</label>' +
            '<input type="search" class="form-control form-control-sm" id="bsCatalogMfrName" name="manufacturer_name" ' +
            'value="' + escapeHtmlAttr(manufacturerName) + '" ' +
            'placeholder="' + escapeHtmlAttr(isEn ? 'Vendor name' : '輸入廠商名稱') + '">' +
            '</div>';
    }

    var tree = {};
    categories.forEach(function (c) {
        if (!c || !c.key) return;
        tree[c.key] = (c.subcategories || []).map(function (s) {
            return {
                key: s.key,
                name_zh: s.name || s.key,
                name_en: s.name_en || '',
                name: catLabel(s.name || s.key, s.name_en || '')
            };
        });
    });

    return (
        '<form class="bs-catalog-filters mb-3" method="get" action="' + escapeHtmlAttr(basePath) + '" id="bsCatalogFilterForm">' +
        '<div class="row g-2 align-items-end">' +
        '<div class="col-md-3">' +
        '<label class="form-label small mb-1" for="bsCatalogMain">' +
        escapeHtmlText(isEn ? 'Main category' : '主分類') + '</label>' +
        '<select class="form-select form-select-sm" id="bsCatalogMain" name="category_key">' +
        mainOpts.join('') + '</select></div>' +
        '<div class="col-md-3">' +
        '<label class="form-label small mb-1" for="bsCatalogSub">' +
        escapeHtmlText(isEn ? 'Subcategory' : '子分類') + '</label>' +
        '<select class="form-select form-select-sm" id="bsCatalogSub" name="subcategory_key">' +
        subOpts.join('') + '</select></div>' +
        kindBlock +
        mfrBlock +
        '<div class="col-md-3">' +
        '<label class="form-label small mb-1" for="bsCatalogQ">' +
        escapeHtmlText(isEn ? 'Search' : '搜尋') + '</label>' +
        '<input type="search" class="form-control form-control-sm" id="bsCatalogQ" name="q" ' +
        'value="' + escapeHtmlAttr(q) + '" ' +
        'placeholder="' + escapeHtmlAttr(isEn ? 'Style or keyword' : '款式關鍵字') + '">' +
        '</div>' +
        '<div class="col-md-2">' +
        '<button type="submit" class="btn btn-sm btn-primary w-100">' +
        escapeHtmlText(isEn ? 'Apply' : '套用篩選') + '</button></div>' +
        '</div></form>\n' +
        '<script type="application/json" id="bsCatalogSubTree">' +
        JSON.stringify(tree).replace(/</g, '\\u003c') +
        '</script>\n' +
        '<script>(function(){\n' +
        'var main=document.getElementById("bsCatalogMain");\n' +
        'var sub=document.getElementById("bsCatalogSub");\n' +
        'var treeEl=document.getElementById("bsCatalogSubTree");\n' +
        'if(!main||!sub||!treeEl)return;\n' +
        'var tree={};try{tree=JSON.parse(treeEl.textContent||"{}")||{};}catch(e){}\n' +
        'function allLabel(){\n' +
        'var lang=(document.documentElement.lang||"").toLowerCase();\n' +
        'return (lang.indexOf("en")===0)?"All subcategories":"全部子分類";\n' +
        '}\n' +
        'function refill(){\n' +
        'var key=String(main.value||"").trim();\n' +
        'var cur=String(sub.value||"").trim();\n' +
        'var rows=tree[key]||[];\n' +
        'var lang=(document.documentElement.lang||"").toLowerCase();\n' +
        'var en=lang.indexOf("en")===0;\n' +
        'sub.innerHTML="";\n' +
        'var o0=document.createElement("option");o0.value="";o0.textContent=allLabel();\n' +
        'o0.setAttribute("data-name-zh","全部子分類");o0.setAttribute("data-name-en","All subcategories");\n' +
        'sub.appendChild(o0);\n' +
        'rows.forEach(function(r){\n' +
        'var o=document.createElement("option");o.value=r.key;\n' +
        'var zh=r.name_zh||r.name||r.key;var enn=r.name_en||"";\n' +
        'o.setAttribute("data-name-zh",zh);if(enn)o.setAttribute("data-name-en",enn);\n' +
        'o.textContent=en&&enn?enn:zh;\n' +
        'if(cur&&cur===r.key)o.selected=true;sub.appendChild(o);\n' +
        '});\n' +
        'if(cur&&!rows.some(function(r){return r.key===cur;}))sub.value="";\n' +
        '}\n' +
        'main.addEventListener("change",function(){sub.value="";refill();});\n' +
        '})();<\/script>\n'
    );
}

function buildBrowseFiltersBlockHtml(basePath, categories, categoryKey, lang) {
    lang = publicLang.normalizePublicLang(lang);
    var label = getCategoryFilterLabel(categories, categoryKey, lang);
    var labelAttrs = categoryKey
        ? (' data-filter-key="' + escapeHtmlAttr(categoryKey) + '"')
        : ' data-filter-key=""';
    return (
        '<div class="dw-browse-filters-block">' +
        '<button type="button" class="dw-browse-filters-toggle" aria-expanded="false">' +
        '<span class="dw-browse-filters-toggle-text">' +
        '<span class="dw-browse-filters-toggle-prefix" data-i18n="browseStyles.filterCategory">分類</span>' +
        '<span class="dw-browse-filters-toggle-label"' + labelAttrs + '>' + escapeHtmlText(label) + '</span>' +
        '</span>' +
        '<i class="bi bi-chevron-down dw-browse-filters-toggle-icon" aria-hidden="true"></i>' +
        '</button>' +
        '<div class="dw-browse-filters">' +
        categoryFilterLinks(basePath, categories, categoryKey, lang) +
        '</div></div>'
    );
}

module.exports = {
    escapeHtmlAttr,
    escapeHtmlText,
    prototypeLinkCount,
    browseItemImageItems,
    designPath,
    matchGuidePath,
    buildBrowseStyleCardHtml,
    categoryFilterLinks,
    getCategoryFilterLabel,
    getSubcategoryFilterLabel,
    buildBrowseCatalogFiltersHtml,
    buildBrowseFiltersBlockHtml
};
