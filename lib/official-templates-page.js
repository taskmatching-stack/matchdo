/**
 * 官方版型公開列表頁 HTML（/official-templates/）
 * 卡片 UI／按鈕對齊設計頁 bs-card（browse-style-card-ssr）。
 */
'use strict';

const cards = require('./browse-style-card-ssr');
const designTabs = require('../public/js/design-workspace-tabs.js');

function inspirationPath(item) {
    const kind = String((item && item.asset_kind) || 'prototype').toLowerCase();
    const k = (kind === 'material' || kind === 'part') ? kind : 'prototype';
    return '/inspiration/' + k + '/' + encodeURIComponent(item.id);
}

function buildOfficialTemplatesHtml(opts) {
    const base = String((opts && opts.base) || 'https://matchdo.cc').replace(/\/$/, '');
    const items = (opts && opts.items) || [];
    const categories = (opts && opts.categories) || [];
    const categoryKey = String((opts && opts.categoryKey) || '').trim();
    const subcategoryKey = String((opts && opts.subcategoryKey) || '').trim();
    const total = opts && opts.total != null ? Number(opts.total) : items.length;
    const proxyImage = typeof opts.proxyImage === 'function' ? opts.proxyImage : function (u) { return u; };

    const pagePath = '/official-templates/' + (categoryKey
        ? ('?' + new URLSearchParams(Object.assign(
            { category_key: categoryKey },
            subcategoryKey ? { subcategory_key: subcategoryKey } : {}
        )).toString())
        : '');
    const pageUrl = base + pagePath;
    const catObj = categoryKey
        ? categories.find(function (c) { return c.key === categoryKey; })
        : null;
    const title = catObj && catObj.name
        ? ('官方版型｜' + catObj.name + ' - MATCHDO 合做')
        : '官方版型 - MATCHDO 合做';
    const desc = '瀏覽 MATCHDO 官方版型庫。「用此款進行設計／加入參考圖」帶入設計稿；有關聯時可「看可搭配」（產品樹）。';

    const cardHtml = items.map(function (item) {
        return cards.buildBrowseStyleCardHtml(item, {
            official: true,
            returnPage: '/custom-product.html?tab=product-design',
            proxyImage: proxyImage,
            base: base
        });
    }).filter(Boolean).join('');

    const emptyHtml = items.length
        ? ''
        : '<p class="text-muted py-4">此條件下尚無已上架的官方版型。請改分類，或請管理員至官方版型庫上傳。</p>';

    const listJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title,
        url: pageUrl,
        description: desc,
        isPartOf: { '@type': 'WebSite', name: 'MATCHDO 合做', url: base },
        mainEntity: {
            '@type': 'ItemList',
            numberOfItems: total,
            itemListElement: items.slice(0, 50).map(function (item, i) {
                return {
                    '@type': 'ListItem',
                    position: i + 1,
                    url: base + inspirationPath(item),
                    name: item.title || '官方版型'
                };
            })
        }
    };

    return '<!DOCTYPE html>\n' +
        '<html lang="zh-TW">\n<head>\n' +
        '<meta charset="utf-8">\n' +
        '<title>' + cards.escapeHtmlText(title) + '</title>\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        '<meta name="robots" content="index, follow">\n' +
        '<meta name="description" content="' + cards.escapeHtmlAttr(desc) + '">\n' +
        '<link rel="canonical" href="' + cards.escapeHtmlAttr(pageUrl) + '">\n' +
        '<meta property="og:type" content="website">\n' +
        '<meta property="og:site_name" content="MATCHDO 合做">\n' +
        '<meta property="og:title" content="' + cards.escapeHtmlAttr(title) + '">\n' +
        '<meta property="og:description" content="' + cards.escapeHtmlAttr(desc) + '">\n' +
        '<meta property="og:url" content="' + cards.escapeHtmlAttr(pageUrl) + '">\n' +
        '<meta property="og:locale" content="zh_TW">\n' +
        '<link href="/img/favicon.ico" rel="icon">\n' +
        '<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet">\n' +
        '<link href="/css/bootstrap.min.css" rel="stylesheet">\n' +
        '<link href="/css/style.css" rel="stylesheet">\n' +
        '<link href="/css/browse-styles.css?v=6" rel="stylesheet">\n' +
        '<link href="/css/morandi-global.css?v=9" rel="stylesheet">\n' +
        '<link href="/css/nav-cp-menu.css?v=1" rel="stylesheet">\n' +
        '<link href="/css/design-workspace-tabs.css?v=4" rel="stylesheet">\n' +
        '<script type="application/ld+json">' + JSON.stringify(listJsonLd) + '</script>\n' +
        '<style>\n' +
        '.ot-filters{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:1.25rem}\n' +
        '</style>\n</head>\n<body>\n' +
        '<div id="site-header"></div>\n' +
        '<div class="design-workspace-shell">\n' +
        '<div class="design-workspace-layout">\n' +
        '<div class="design-workspace-head">\n' +
        '<div class="design-workspace-head-main">\n' +
        '<h1 class="design-workspace-title">官方版型</h1>\n' +
        '<p class="design-workspace-sub">平台共用官方版型庫。「用此款進行設計／加入參考圖」帶入設計稿；有關聯材料／配件的原型可「看可搭配」（產品樹）。</p>\n' +
        '</div></div>\n' +
        '<div class="design-workspace-frame">\n' +
        designTabs.buildDesignWorkspaceTabsHtml('official-templates') + '\n' +
        '<div class="design-workspace-body">\n' +
        '<div class="ot-filters">' + cards.categoryFilterLinks('/official-templates/', categories, categoryKey) + '</div>\n' +
        '<p class="design-workspace-meta">共 ' + cards.escapeHtmlText(String(total)) + ' 項' +
        (categoryKey ? '（已篩選分類）' : '') + '</p>\n' +
        (items.length ? ('<div class="bs-grid">' + cardHtml + '</div>\n') : emptyHtml + '\n') +
        '</div></div></div></div>\n' +
        '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/js/bootstrap.bundle.min.js"><\/script>\n' +
        '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\/script>\n' +
        '<script src="/config/auth-config.js"><\/script>\n' +
        '<script src="/js/site-header.js?v=20260806-auth"><\/script>\n' +
        '</body>\n</html>\n';
}

module.exports = {
    buildOfficialTemplatesHtml,
    inspirationPath,
    designPath: cards.designPath,
    matchGuidePath: cards.matchGuidePath
};
