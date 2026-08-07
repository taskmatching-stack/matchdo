/**
 * 【新版】廠商版型列表 SSR — 待驗收後取代 lib/vendor-styles-page.js
 * 共用殼：lib/design-workspace-browse-page.js（對齊 material-dual-color.html）
 */
'use strict';

const cards = require('./browse-style-card-ssr');
const browsePage = require('./design-workspace-browse-page');

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
    const total = opts && opts.total != null ? Number(opts.total) : items.length;
    const proxyImage = typeof opts.proxyImage === 'function' ? opts.proxyImage : function (u) { return u; };

    const pagePath = '/vendor-styles/' + (categoryKey
        ? ('?' + new URLSearchParams(Object.assign(
            { category_key: categoryKey },
            subcategoryKey ? { subcategory_key: subcategoryKey } : {}
        )).toString())
        : '');
    const pageUrl = base + pagePath;
    const catObj = categoryKey
        ? categories.find(function (c) { return c.key === categoryKey; })
        : null;
    const docTitle = catObj && catObj.name
        ? ('廠商版型｜' + catObj.name + ' - MATCHDO 合做')
        : '廠商版型 - MATCHDO 合做';
    const metaDesc = '瀏覽公開廠商數位原型。點「用此款進行設計」帶入設計稿；有關聯材料／配件時可「看可搭配」（產品樹）。';

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
        : '<p class="text-muted py-4">此條件下尚無已公開的廠商版型。請改分類，或至<a href="/official-templates/">官方版型</a>瀏覽。</p>';

    const bodyHtml =
        '<p class="dw-browse-also">也可瀏覽 <a href="/official-templates/">官方版型</a>。</p>\n' +
        cards.buildBrowseFiltersBlockHtml('/vendor-styles/', categories, categoryKey) + '\n' +
        '<p class="design-workspace-meta">共 ' + cards.escapeHtmlText(String(total)) + ' 項' +
        (categoryKey ? '（已篩選分類）' : '') + '</p>\n' +
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
        h1: '廠商版型',
        sub: '公開廠商數位原型庫。點「用此款進行設計」帶入參考圖；有關聯材料／配件時可「看可搭配」（產品樹）。',
        activeTool: 'vendor-styles',
        bodyHtml: bodyHtml,
        jsonLd: listJsonLd,
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
