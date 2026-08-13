/**
 * 廠商版型列表 SSR
 * 過濾：主／子分類下拉 + 廠商名稱 + 搜尋（對齊設計頁，禁止大分類 chip 牆；此頁僅數位原型）
 */
'use strict';

const cards = require('./browse-style-card-ssr');
const browsePage = require('./design-workspace-browse-page');
const publicLang = require('./public-lang');

function inspirationPath(item) {
    const kind = String((item && item.asset_kind) || 'prototype').toLowerCase();
    const k = (kind === 'material' || kind === 'part') ? kind : 'prototype';
    return '/inspiration/' + k + '/' + encodeURIComponent(item.id);
}

function buildVendorStylesHtml(opts) {
    const base = String((opts && opts.base) || 'https://matchdo.cc').replace(/\/$/, '');
    const items = (opts && opts.items) || [];
    const categories = (opts && opts.categories) || [];
    const categoryKey = String((opts && opts.categoryKey) || '').trim();
    const subcategoryKey = String((opts && opts.subcategoryKey) || '').trim();
    const q = String((opts && opts.q) || '').trim();
    const manufacturerName = String((opts && opts.manufacturerName) || '').trim();
    const total = opts && opts.total != null ? Number(opts.total) : items.length;
    const lang = publicLang.normalizePublicLang(opts && opts.lang);
    const proxyImage = typeof opts.proxyImage === 'function' ? opts.proxyImage : function (u) { return u; };

    const qs = new URLSearchParams();
    if (categoryKey) qs.set('category_key', categoryKey);
    if (subcategoryKey) qs.set('subcategory_key', subcategoryKey);
    if (manufacturerName) qs.set('manufacturer_name', manufacturerName);
    if (q) qs.set('q', q);
    const pagePath = '/vendor-styles/' + (qs.toString() ? ('?' + qs.toString()) : '');
    const pageUrl = base + pagePath;
    const catObj = categoryKey
        ? categories.find(function (c) { return c.key === categoryKey; })
        : null;
    const catDisplayName = catObj
        ? publicLang.pickLocalizedName(catObj.name, catObj.name_en, lang)
        : '';
    const docTitle = catDisplayName
        ? (lang === 'en'
            ? ('Vendor styles · ' + catDisplayName + ' - MATCHDO')
            : ('廠商版型｜' + catDisplayName + ' - MATCHDO 合做'))
        : (lang === 'en' ? 'Vendor styles - MATCHDO' : '廠商版型 - MATCHDO 合做');
    const metaDesc = lang === 'en'
        ? 'Browse public vendor prototypes. Use a style for design or see product-tree matches.'
        : '瀏覽公開廠商數位原型。點「用此款進行設計」帶入設計稿；有關聯材料／配件時可「看可搭配」（產品樹）。';

    const cardHtml = items.map(function (item) {
        return cards.buildBrowseStyleCardHtml(item, {
            official: false,
            returnPage: '/custom-product.html?tab=product-design',
            proxyImage: proxyImage,
            base: base
        });
    }).filter(Boolean).join('');

    const emptyHtml = items.length
        ? ''
        : ('<p class="text-muted py-4">' +
            '<span data-i18n="vendorStylesBrowse.emptyPrefix">此條件下尚無已公開的廠商版型。請改分類，或至</span> ' +
            '<a href="/official-templates/" data-i18n="vendorStylesBrowse.alsoLink">官方版型</a>' +
            '<span data-i18n="vendorStylesBrowse.emptySuffix">瀏覽。</span></p>');

    const filterBits = [];
    if (categoryKey) filterBits.push(lang === 'en' ? 'category' : '分類');
    if (manufacturerName) filterBits.push(lang === 'en' ? 'vendor' : '廠商');
    if (q) filterBits.push(lang === 'en' ? 'search' : '搜尋');
    const countText = lang === 'en'
        ? (String(total) + ' items' + (filterBits.length ? (' (' + filterBits.join(', ') + ')') : ''))
        : ('共 ' + cards.escapeHtmlText(String(total)) + ' 項' +
            (filterBits.length ? ('（' + filterBits.join('・') + '）') : ''));

    const bodyHtml =
        '<p class="dw-browse-also"><span data-i18n="vendorStylesBrowse.alsoPrefix">也可瀏覽</span> ' +
        '<a href="/official-templates/" data-i18n="vendorStylesBrowse.alsoLink">官方版型</a>。</p>\n' +
        cards.buildBrowseCatalogFiltersHtml({
            basePath: '/vendor-styles/',
            mode: 'vendor',
            lang: lang,
            categories: categories,
            categoryKey: categoryKey,
            subcategoryKey: subcategoryKey,
            manufacturerName: manufacturerName,
            q: q
        }) +
        '<p class="design-workspace-meta" data-browse-count="' + cards.escapeHtmlAttr(String(total)) + '"' +
        (categoryKey || manufacturerName || q ? ' data-browse-filtered="1"' : '') +
        '>' + countText + '</p>\n' +
        (items.length ? ('<div class="bs-grid">' + cardHtml + '</div>\n') : emptyHtml);

    const listJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: docTitle,
        url: pageUrl,
        description: metaDesc,
        isPartOf: { '@type': 'WebSite', name: 'MATCHDO 合做', url: base },
        mainEntity: {
            '@type': 'ItemList',
            numberOfItems: total,
            itemListElement: items.slice(0, 50).map(function (item, i) {
                return {
                    '@type': 'ListItem',
                    position: i + 1,
                    url: base + inspirationPath(item),
                    name: item.title || '廠商版型'
                };
            })
        }
    };

    return browsePage.buildDesignWorkspaceBrowsePageHtml({
        docTitle: docTitle,
        metaDesc: metaDesc,
        pageUrl: pageUrl,
        h1: lang === 'en' ? 'Vendor styles' : '廠商版型',
        sub: lang === 'en'
            ? 'Public vendor prototypes. Use a style for design or see product-tree matches.'
            : '公開廠商數位原型庫。點「用此款進行設計」帶入參考圖；有關聯材料／配件時可「看可搭配」（產品樹）。',
        activeTool: 'vendor-styles',
        bodyHtml: bodyHtml,
        jsonLd: listJsonLd,
        lang: lang,
        headI18n: {
            h1Key: 'vendorStylesBrowse.pageTitle',
            subKey: 'vendorStylesBrowse.pageSub',
            metaDescKey: 'vendorStylesBrowse.metaDesc',
            docTitleKey: catDisplayName
                ? 'vendorStylesBrowse.docTitleCat'
                : 'vendorStylesBrowse.docTitle',
            catNameZh: catObj ? (catObj.name || catObj.key) : '',
            catNameEn: catObj ? (catObj.name_en || '') : ''
        },
        extraHeadStyle:
            '.dw-browse-also{font-size:.875rem;margin:0 0 1rem;color:#8A96A3}\n' +
            '.dw-browse-also a{color:#7A8FA3}'
    });
}

module.exports = {
    buildVendorStylesHtml,
    inspirationPath,
    designPath: cards.designPath,
    matchGuidePath: cards.matchGuidePath,
    vendorProfilePath: function (item) {
        if (!item || !item.manufacturer_id) return '/vendors.html';
        return '/vendor-profile.html?id=' + encodeURIComponent(item.manufacturer_id);
    }
};
