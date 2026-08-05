/**
 * 廠商版型公開列表頁 HTML（/vendor-styles/）
 * 獨立 SEO 落地；設計頁 tab 僅作工具內挑選，不在此改 UI。
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
    let url = '/custom-product.html?prototype_asset_id=' + encodeURIComponent(item.id);
    if (item.manufacturer_id) url += '&manufacturer_id=' + encodeURIComponent(item.manufacturer_id);
    if (item.category_key) url += '&category_key=' + encodeURIComponent(item.category_key);
    if (item.subcategory_key) url += '&subcategory_key=' + encodeURIComponent(item.subcategory_key);
    return url;
}

function matchGuidePath(item) {
    if (!item || !item.id) return '/product-tree.html';
    const returnTo = encodeURIComponent('/vendor-styles/');
    if (item.match_guide_url) {
        const u = String(item.match_guide_url);
        return u.indexOf('return_to=') >= 0 ? u : (u + (u.indexOf('?') >= 0 ? '&' : '?') + 'return_to=' + returnTo);
    }
    return '/product-tree.html?prototype_asset_id=' + encodeURIComponent(item.id) + '&return_to=' + returnTo;
}

function vendorProfilePath(item) {
    if (!item || !item.manufacturer_id) return '/vendors.html';
    return '/vendor-profile.html?id=' + encodeURIComponent(item.manufacturer_id);
}

/**
 * @param {object} opts
 * @param {string} opts.base
 * @param {Array} opts.items
 * @param {Array} opts.categories - { key, name }[]
 * @param {string} [opts.categoryKey]
 * @param {string} [opts.subcategoryKey]
 * @param {number} [opts.total]
 * @param {function} [opts.proxyImage]
 */
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
    const title = catObj && catObj.name
        ? ('廠商版型｜' + catObj.name + ' - MATCHDO 合做')
        : '廠商版型 - MATCHDO 合做';
    const desc = '瀏覽公開廠商數位原型。點「用此款進行設計」帶入設計稿；有關聯材料／配件時可「看可搭配」。';

    const catLinks = ['<a class="vs-filter' + (!categoryKey ? ' active' : '') + '" href="/vendor-styles/">全部</a>']
        .concat(categories.map(function (c) {
            if (!c || !c.key) return '';
            const href = '/vendor-styles/?category_key=' + encodeURIComponent(c.key);
            const active = categoryKey === c.key ? ' active' : '';
            return '<a class="vs-filter' + active + '" href="' + escapeHtmlAttr(href) + '">' + escapeHtmlText(c.name || c.key) + '</a>';
        }).filter(Boolean));

    const cards = items.map(function (item) {
        if (!item || !item.id) return '';
        const design = designPath(item);
        const linkCount = item.link_count != null
            ? Number(item.link_count)
            : (Number(item.material_count || 0) + Number(item.part_count || 0));
        const hasLinks = linkCount > 0;
        const profile = vendorProfilePath(item);
        const img = proxyImage(item.image_url || '', base);
        const t = escapeHtmlText(item.title || '未命名');
        const mfrName = escapeHtmlText(item.manufacturer_name || '廠商');
        // 對齊設計頁舊卡：僅 hasLinks 才顯示「看可搭配」；勿加「作品頁」等不存在入口
        const guideBtn = hasLinks
            ? ('<a class="btn btn-sm btn-outline-secondary" href="' + escapeHtmlAttr(matchGuidePath(item)) + '">看可搭配</a>')
            : '';
        const imgHtml = img
            ? ('<div class="vs-card-img-link"><img src="' + escapeHtmlAttr(img) + '" alt="' + escapeHtmlAttr(item.title || '') + '" loading="lazy" width="400" height="400"></div>')
            : '<div class="vs-card-img-ph"><i class="bi bi-image"></i></div>';
        return (
            '<article class="vs-card">' +
            imgHtml +
            '<div class="vs-card-body">' +
            '<p class="vs-mfr"><a href="' + escapeHtmlAttr(profile) + '">' + mfrName + '</a></p>' +
            '<h2 class="vs-card-title">' + t + '</h2>' +
            (hasLinks
                ? ('<span class="badge bg-light text-secondary border" style="font-size:.7rem;align-self:flex-start">可搭配 ' + escapeHtmlText(String(linkCount)) + ' 項</span>')
                : '') +
            '<div class="vs-card-actions">' +
            guideBtn +
            '<a class="btn btn-sm btn-primary" href="' + escapeHtmlAttr(design) + '">用此款進行設計</a>' +
            '</div></div></article>'
        );
    }).join('');

    const emptyHtml = items.length
        ? ''
        : '<p class="vs-empty">此條件下尚無已公開的廠商版型。請改分類，或至<a href="/official-templates/">官方版型</a>瀏覽。</p>';

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
                    name: item.title || '廠商版型'
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
        '.vs-wrap{max-width:1100px;margin:0 auto;padding:1.25rem 1rem 3rem}\n' +
        '.vs-h1{font-size:1.5rem;font-weight:700;margin:0 0 .35rem}\n' +
        '.vs-lead{color:#5C6670;font-size:.95rem;margin:0 0 1rem}\n' +
        '.vs-filters{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:1.25rem}\n' +
        '.vs-filter{display:inline-block;padding:.25rem .65rem;border:1px solid #7A8FA3;border-radius:6px;color:#7A8FA3;text-decoration:none;font-size:.82rem;background:#fff}\n' +
        '.vs-filter:hover{background:#f0f4f8;color:#3a5169}\n' +
        '.vs-filter.active{background:#7A8FA3;color:#fff}\n' +
        '.vs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem}\n' +
        '.vs-card{border:1px solid rgba(88,100,112,.14);border-radius:10px;overflow:hidden;background:#fff;display:flex;flex-direction:column}\n' +
        '.vs-card-img-link{display:block;aspect-ratio:1;background:#EAEEF3}\n' +
        '.vs-card-img-link img{width:100%;height:100%;object-fit:cover;display:block}\n' +
        '.vs-card-img-ph{aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:#EAEEF3;color:#8A96A3;font-size:2rem}\n' +
        '.vs-card-body{padding:.65rem .75rem .85rem;flex:1;display:flex;flex-direction:column;gap:.35rem}\n' +
        '.vs-mfr{font-size:.75rem;margin:0;color:#5C6670}\n' +
        '.vs-mfr a{color:#7A8FA3;text-decoration:none}\n' +
        '.vs-mfr a:hover{text-decoration:underline}\n' +
        '.vs-card-title{font-size:.9rem;font-weight:600;margin:0;line-height:1.3}\n' +
        '.vs-card-title a{color:inherit;text-decoration:none}\n' +
        '.vs-card-title a:hover{color:#7A8FA3}\n' +
        '.vs-card-actions{display:grid;gap:.35rem;margin-top:auto}\n' +
        '.vs-empty{color:#5C6670;padding:2rem 0}\n' +
        '.vs-meta{font-size:.8rem;color:#8A96A3;margin-bottom:1rem}\n' +
        '.vs-also{font-size:.85rem;margin:0 0 1rem}\n' +
        '.vs-also a{color:#7A8FA3}\n' +
        '</style>\n</head>\n<body>\n' +
        '<div id="site-header"></div>\n' +
        '<div class="vs-wrap">\n' +
        '<h1 class="vs-h1">廠商版型</h1>\n' +
        '<p class="vs-lead">公開廠商數位原型庫。點「用此款進行設計」帶入參考圖；有關聯材料／配件時可「看可搭配」。</p>\n' +
        '<p class="vs-also">也可瀏覽 <a href="/official-templates/">官方版型</a>。</p>\n' +
        '<div class="vs-filters">' + catLinks.join('') + '</div>\n' +
        '<p class="vs-meta">共 ' + escapeHtmlText(String(total)) + ' 項' +
        (categoryKey ? '（已篩選分類）' : '') + '</p>\n' +
        (items.length ? ('<div class="vs-grid">' + cards + '</div>\n') : emptyHtml + '\n') +
        '</div>\n' +
        '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/js/bootstrap.bundle.min.js"><\/script>\n' +
        '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\/script>\n' +
        '<script src="/config/auth-config.js"><\/script>\n' +
        '<script src="/js/site-header.js?v=20260806-auth"><\/script>\n' +
        '</body>\n</html>\n';
}

module.exports = {
    buildVendorStylesHtml,
    inspirationPath,
    designPath,
    matchGuidePath,
    vendorProfilePath
};
