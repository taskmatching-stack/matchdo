/**
 * 官方版型公開列表頁 HTML（/official-templates/）
 * 獨立 SEO 落地；設計頁 UI／功能不在此改動。
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

function inspirationPath(item) {
    const kind = String((item && item.asset_kind) || 'prototype').toLowerCase();
    const k = (kind === 'material' || kind === 'part') ? kind : 'prototype';
    return '/inspiration/' + k + '/' + encodeURIComponent(item.id);
}

function designPath(item) {
    if (!item || !item.id) return '/custom-product.html';
    let url = '/custom-product.html?prototype_asset_id=' + encodeURIComponent(item.id) + '&official=1';
    if (item.category_key) url += '&category_key=' + encodeURIComponent(item.category_key);
    if (item.subcategory_key) url += '&subcategory_key=' + encodeURIComponent(item.subcategory_key);
    const kind = String((item && item.asset_kind) || 'prototype').toLowerCase();
    if (kind === 'material' || kind === 'part') {
        url = '/custom-product.html?vendor_asset_id=' + encodeURIComponent(item.id) + '&official=1';
        if (item.category_key) url += '&category_key=' + encodeURIComponent(item.category_key);
        if (item.subcategory_key) url += '&subcategory_key=' + encodeURIComponent(item.subcategory_key);
    }
    return url;
}

function matchGuidePath(item) {
    if (!item || !item.id) return '/product-tree.html';
    const returnTo = encodeURIComponent('/official-templates/');
    if (item.match_guide_url) {
        const u = String(item.match_guide_url);
        return u.indexOf('return_to=') >= 0 ? u : (u + (u.indexOf('?') >= 0 ? '&' : '?') + 'return_to=' + returnTo);
    }
    return '/product-tree.html?prototype_asset_id=' + encodeURIComponent(item.id) + '&return_to=' + returnTo;
}

function selectLabel(item) {
    const kind = String((item && item.asset_kind) || 'prototype').toLowerCase();
    if (kind === 'material' || kind === 'part') return '加入參考圖';
    return '用此款進行設計';
}

function kindBadge(item) {
    const kind = String((item && item.asset_kind) || 'prototype').toLowerCase();
    if (kind === 'material') return '材料';
    if (kind === 'part') return '配件';
    return '原型';
}

/**
 * @param {object} opts
 * @param {string} opts.base
 * @param {Array} opts.items
 * @param {Array} opts.categories - { key, name }[]
 * @param {string} [opts.categoryKey]
 * @param {string} [opts.subcategoryKey]
 * @param {number} [opts.total]
 * @param {function} [opts.proxyImage] - (url, base) => url
 */
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
    const desc = '瀏覽 MATCHDO 官方版型庫：數位原型、材料與配件。「用此款進行設計／加入參考圖」帶入設計稿；原型可「看可搭配」。';

    const catLinks = ['<a class="ot-filter' + (!categoryKey ? ' active' : '') + '" href="/official-templates/">全部</a>']
        .concat(categories.map(function (c) {
            if (!c || !c.key) return '';
            const href = '/official-templates/?category_key=' + encodeURIComponent(c.key);
            const active = categoryKey === c.key ? ' active' : '';
            return '<a class="ot-filter' + active + '" href="' + escapeHtmlAttr(href) + '">' + escapeHtmlText(c.name || c.key) + '</a>';
        }).filter(Boolean));

    const cards = items.map(function (item) {
        if (!item || !item.id) return '';
        const design = designPath(item);
        const kind = String((item.asset_kind) || 'prototype').toLowerCase();
        const img = proxyImage(item.image_url || '', base);
        const t = escapeHtmlText(item.title || '未命名');
        const badge = kindBadge(item);
        const cta = selectLabel(item);
        const isProto = kind !== 'material' && kind !== 'part';
        const guideBtn = isProto
            ? ('<a class="btn btn-sm btn-outline-secondary" href="' + escapeHtmlAttr(matchGuidePath(item)) + '">看可搭配</a>')
            : '';
        const imgHtml = img
            ? '<a href="' + escapeHtmlAttr(design) + '" class="ot-card-img-link"><img src="' + escapeHtmlAttr(img) + '" alt="' + escapeHtmlAttr(item.title || '') + '" loading="lazy" width="400" height="400"></a>'
            : '<div class="ot-card-img-ph"><i class="bi bi-image"></i></div>';
        return (
            '<article class="ot-card">' +
            imgHtml +
            '<div class="ot-card-body">' +
            '<span class="ot-badge">' + escapeHtmlText(badge) + '</span> ' +
            '<h2 class="ot-card-title">' + t + '</h2>' +
            '<div class="ot-card-actions">' +
            guideBtn +
            '<a class="btn btn-sm btn-primary" href="' + escapeHtmlAttr(design) + '">' + escapeHtmlText(cta) + '</a>' +
            '</div></div></article>'
        );
    }).join('');

    const emptyHtml = items.length
        ? ''
        : '<p class="ot-empty">此條件下尚無已上架的官方版型。請改分類，或請管理員至官方版型庫上傳。</p>';

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
        '<title>' + escapeHtmlText(title) + '</title>\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        '<meta name="robots" content="index, follow">\n' +
        '<meta name="description" content="' + escapeHtmlAttr(desc) + '">\n' +
        '<link rel="canonical" href="' + escapeHtmlAttr(pageUrl) + '">\n' +
        '<meta property="og:type" content="website">\n' +
        '<meta property="og:site_name" content="MATCHDO 合做">\n' +
        '<meta property="og:title" content="' + escapeHtmlAttr(title) + '">\n' +
        '<meta property="og:description" content="' + escapeHtmlAttr(desc) + '">\n' +
        '<meta property="og:url" content="' + escapeHtmlAttr(pageUrl) + '">\n' +
        '<meta property="og:locale" content="zh_TW">\n' +
        '<link href="/img/favicon.ico" rel="icon">\n' +
        '<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet">\n' +
        '<link href="/css/bootstrap.min.css" rel="stylesheet">\n' +
        '<link href="/css/style.css" rel="stylesheet">\n' +
        '<script type="application/ld+json">' + JSON.stringify(listJsonLd) + '</script>\n' +
        '<style>\n' +
        '.ot-wrap{max-width:1100px;margin:0 auto;padding:1.25rem 1rem 3rem}\n' +
        '.ot-h1{font-size:1.5rem;font-weight:700;margin:0 0 .35rem}\n' +
        '.ot-lead{color:#5C6670;font-size:.95rem;margin:0 0 1rem}\n' +
        '.ot-filters{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:1.25rem}\n' +
        '.ot-filter{display:inline-block;padding:.25rem .65rem;border:1px solid #7A8FA3;border-radius:6px;color:#7A8FA3;text-decoration:none;font-size:.82rem;background:#fff}\n' +
        '.ot-filter:hover{background:#f0f4f8;color:#3a5169}\n' +
        '.ot-filter.active{background:#7A8FA3;color:#fff}\n' +
        '.ot-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem}\n' +
        '.ot-card{border:1px solid rgba(88,100,112,.14);border-radius:10px;overflow:hidden;background:#fff;display:flex;flex-direction:column}\n' +
        '.ot-card-img-link{display:block;aspect-ratio:1;background:#EAEEF3}\n' +
        '.ot-card-img-link img{width:100%;height:100%;object-fit:cover;display:block}\n' +
        '.ot-card-img-ph{aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:#EAEEF3;color:#8A96A3;font-size:2rem}\n' +
        '.ot-card-body{padding:.65rem .75rem .85rem;flex:1;display:flex;flex-direction:column;gap:.35rem}\n' +
        '.ot-badge{font-size:.65rem;color:#5C6670;border:1px solid rgba(88,100,112,.2);border-radius:4px;padding:.1rem .35rem}\n' +
        '.ot-card-title{font-size:.9rem;font-weight:600;margin:0;line-height:1.3}\n' +
        '.ot-card-title a{color:inherit;text-decoration:none}\n' +
        '.ot-card-title a:hover{color:#7A8FA3}\n' +
        '.ot-card-actions{display:grid;gap:.35rem;margin-top:auto}\n' +
        '.ot-empty{color:#5C6670;padding:2rem 0}\n' +
        '.ot-meta{font-size:.8rem;color:#8A96A3;margin-bottom:1rem}\n' +
        '</style>\n</head>\n<body>\n' +
        '<div id="site-header"></div>\n' +
        '<div class="ot-wrap">\n' +
        '<h1 class="ot-h1">官方版型</h1>\n' +
        '<p class="ot-lead">平台共用官方版型庫。「用此款進行設計／加入參考圖」帶入設計稿；數位原型可「看可搭配」。</p>\n' +
        '<div class="ot-filters">' + catLinks.join('') + '</div>\n' +
        '<p class="ot-meta">共 ' + escapeHtmlText(String(total)) + ' 項' +
        (categoryKey ? '（已篩選分類）' : '') + '</p>\n' +
        (items.length ? ('<div class="ot-grid">' + cards + '</div>\n') : emptyHtml + '\n') +
        '</div>\n' +
        '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/js/bootstrap.bundle.min.js"><\/script>\n' +
        '<script src="/js/site-header.js"><\/script>\n' +
        '</body>\n</html>\n';
}

module.exports = {
    buildOfficialTemplatesHtml,
    inspirationPath,
    designPath,
    matchGuidePath
};
