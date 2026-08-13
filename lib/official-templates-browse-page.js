/**
 * 官方版型列表 SSR
 * 過濾：主／子分類下拉 + 素材類型（原型／零件／材料）+ 搜尋（對齊設計頁，禁止大分類 chip 牆）
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

function buildOfficialTemplatesHtml(opts) {
    const base = String((opts && opts.base) || 'https://matchdo.cc').replace(/\/$/, '');
    const items = (opts && opts.items) || [];
    const categories = (opts && opts.categories) || [];
    const categoryKey = String((opts && opts.categoryKey) || '').trim();
    const subcategoryKey = String((opts && opts.subcategoryKey) || '').trim();
    const assetKind = opts && opts.assetKind != null ? String(opts.assetKind).trim() : 'prototype';
    const assetKindExplicitAll = !!(opts && opts.assetKindExplicitAll);
    const q = String((opts && opts.q) || '').trim();
    const total = opts && opts.total != null ? Number(opts.total) : items.length;
    const lang = publicLang.normalizePublicLang(opts && opts.lang);
    const proxyImage = typeof opts.proxyImage === 'function' ? opts.proxyImage : function (u) { return u; };

    const qs = new URLSearchParams();
    if (categoryKey) qs.set('category_key', categoryKey);
    if (subcategoryKey) qs.set('subcategory_key', subcategoryKey);
    if (assetKindExplicitAll) qs.set('asset_kind', '');
    else if (assetKind && assetKind !== 'prototype') qs.set('asset_kind', assetKind);
    if (q) qs.set('q', q);
    const pagePath = '/official-templates/' + (qs.toString() ? ('?' + qs.toString()) : '');
    const pageUrl = base + pagePath;
    const catObj = categoryKey
        ? categories.find(function (c) { return c.key === categoryKey; })
        : null;
    const catDisplayName = catObj
        ? publicLang.pickLocalizedName(catObj.name, catObj.name_en, lang)
        : '';
    const docTitle = catDisplayName
        ? (lang === 'en'
            ? ('Official templates · ' + catDisplayName + ' - MATCHDO')
            : ('官方版型｜' + catDisplayName + ' - MATCHDO 合做'))
        : (lang === 'en' ? 'Official templates - MATCHDO' : '官方版型 - MATCHDO 合做');
    const metaDesc = lang === 'en'
        ? 'Browse MATCHDO official templates. Design or add as reference; see matches when linked.'
        : '瀏覽 MATCHDO 官方版型庫。「用此款進行設計／加入參考圖」帶入設計稿；有關聯時可「看可搭配」（產品樹）。';

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
        : ('<p class="text-muted py-4" data-i18n="officialTemplatesBrowse.empty">' +
            '此條件下尚無已上架的官方版型。請改分類，或請管理員至官方版型庫上傳。</p>');

    const filterBits = [];
    if (categoryKey) filterBits.push(lang === 'en' ? 'category' : '分類');
    if (assetKindExplicitAll) filterBits.push(lang === 'en' ? 'all types' : '全部類型');
    else if (assetKind === 'part') filterBits.push(lang === 'en' ? 'parts' : '配件');
    else if (assetKind === 'material') filterBits.push(lang === 'en' ? 'materials' : '材料');
    else filterBits.push(lang === 'en' ? 'prototypes' : '數位原型');
    if (q) filterBits.push(lang === 'en' ? 'search' : '搜尋');
    const countText = lang === 'en'
        ? (String(total) + ' items' + (filterBits.length ? (' (' + filterBits.join(', ') + ')') : ''))
        : ('共 ' + cards.escapeHtmlText(String(total)) + ' 項' +
            (filterBits.length ? ('（' + filterBits.join('・') + '）') : ''));

    const bodyHtml =
        cards.buildBrowseCatalogFiltersHtml({
            basePath: '/official-templates/',
            mode: 'official',
            lang: lang,
            categories: categories,
            categoryKey: categoryKey,
            subcategoryKey: subcategoryKey,
            assetKind: assetKind,
            assetKindExplicitAll: assetKindExplicitAll,
            q: q
        }) +
        '<p class="design-workspace-meta" data-browse-count="' + cards.escapeHtmlAttr(String(total)) + '"' +
        (categoryKey || q || assetKindExplicitAll || (assetKind && assetKind !== 'prototype') ? ' data-browse-filtered="1"' : '') +
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
                    name: item.title || '官方版型'
                };
            })
        }
    };

    return browsePage.buildDesignWorkspaceBrowsePageHtml({
        docTitle: docTitle,
        metaDesc: metaDesc,
        pageUrl: pageUrl,
        h1: lang === 'en' ? 'Official templates' : '官方版型',
        sub: lang === 'en'
            ? 'Platform templates for design or reference; see matches when linked.'
            : '平台共用官方版型庫。「用此款進行設計／加入參考圖」帶入設計稿；有關聯材料／配件的原型可「看可搭配」（產品樹）。',
        activeTool: 'official-templates',
        bodyHtml: bodyHtml,
        jsonLd: listJsonLd,
        lang: lang,
        headI18n: {
            h1Key: 'officialTemplatesBrowse.pageTitle',
            subKey: 'officialTemplatesBrowse.pageSub',
            metaDescKey: 'officialTemplatesBrowse.metaDesc',
            docTitleKey: catDisplayName
                ? 'officialTemplatesBrowse.docTitleCat'
                : 'officialTemplatesBrowse.docTitle',
            catNameZh: catObj ? (catObj.name || catObj.key) : '',
            catNameEn: catObj ? (catObj.name_en || '') : ''
        }
    });
}

module.exports = {
    buildOfficialTemplatesHtml,
    inspirationPath,
    designPath: cards.designPath,
    matchGuidePath: cards.matchGuidePath
};
