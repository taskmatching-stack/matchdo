/**
 * 首頁媒體牆首屏 SSR：把標題／說明／Tags／inspiration 連結寫進初始 HTML。
 * 不改前端 lightbox：JS 載入後仍會清空並重繪網格（使用者體驗不變）。
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

function clip(s, n) {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return t.length > n ? (t.slice(0, n - 1) + '…') : t;
}

/**
 * @param {object} opts
 * @param {import('@supabase/supabase-js').SupabaseClient} opts.supabase
 * @param {string} [opts.categoryKey]
 * @param {string} [opts.subcategoryKey]
 * @param {number} [opts.limit]
 * @param {function} [opts.log]
 */
async function fetchHomeMediaWallSsrItems(opts) {
    const supabase = opts.supabase;
    const categoryKey = String(opts.categoryKey || '').trim();
    const subcategoryKey = String(opts.subcategoryKey || '').trim();
    const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 24, 8), 48);
    const log = typeof opts.log === 'function' ? opts.log : function () {};
    const items = [];

    let categoryKeysToMatch = categoryKey ? [categoryKey] : null;
    if (categoryKey) {
        try {
            const { data: subRows } = await supabase
                .from('custom_product_subcategories')
                .select('key')
                .eq('category_key', categoryKey);
            if (subRows && subRows.length) {
                categoryKeysToMatch = [categoryKey].concat(subRows.map((r) => r.key).filter(Boolean));
            }
        } catch (e) {
            log('ssr-cat-subs', e && e.message);
        }
    }

    try {
        let q = supabase
            .from('custom_products')
            .select('id, title, generation_prompt, description, ai_tags, ai_generated_image_url, category, subcategory_key, created_at')
            .not('ai_generated_image_url', 'is', null)
            .or('show_on_homepage.eq.true,show_on_homepage.is.null')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (categoryKeysToMatch && categoryKeysToMatch.length) q = q.in('category', categoryKeysToMatch);
        if (subcategoryKey) q = q.eq('subcategory_key', subcategoryKey);
        const { data, error } = await q;
        if (error) log('ssr-user', error.message);
        (data || []).forEach((r) => {
            if (!r || !r.id || !r.ai_generated_image_url) return;
            const tags = Array.isArray(r.ai_tags) ? r.ai_tags.map((t) => String(t || '').trim()).filter(Boolean) : [];
            const desc = clip(r.description || r.generation_prompt || '', 200);
            let title = r.title || '設計稿';
            if (String(title).trim() === '產品設計圖') title = '產品設計稿';
            items.push({
                type: 'user_design',
                id: r.id,
                title: title,
                description: desc,
                tags: tags,
                image_url: r.ai_generated_image_url,
                created_at: r.created_at
            });
        });
    } catch (e) {
        log('ssr-user-ex', e && e.message);
    }

    if (items.length < limit) {
        try {
            let pq = supabase
                .from('manufacturer_portfolio')
                .select('id, title, description, ai_tags, image_url_after, image_url_before, show_on_media_wall, created_at')
                .eq('show_on_media_wall', true)
                .order('created_at', { ascending: false })
                .limit(Math.max(8, limit - items.length));
            const { data: ports, error } = await pq;
            if (error) log('ssr-port', error.message);
            (ports || []).forEach((r) => {
                if (!r || !r.id) return;
                const type = r.image_url_before ? 'comparison' : 'series';
                const img = r.image_url_after || r.image_url_before;
                if (!img) return;
                const tags = Array.isArray(r.ai_tags) ? r.ai_tags.map((t) => String(t || '').trim()).filter(Boolean) : [];
                items.push({
                    type: type,
                    id: r.id,
                    title: r.title || (type === 'comparison' ? '對照圖' : '系列圖'),
                    description: clip(r.description || '', 200),
                    tags: tags,
                    image_url: img,
                    created_at: r.created_at
                });
            });
        } catch (e) {
            log('ssr-port-ex', e && e.message);
        }
    }

    items.sort(function (a, b) {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
    });
    return items.slice(0, limit);
}

function buildHomeMediaWallSsrCardHtml(item, base, proxyImage) {
    if (!item || !item.id) return '';
    const type = String(item.type || 'user_design');
    const href = '/inspiration/' + encodeURIComponent(type) + '/' + encodeURIComponent(item.id);
    const title = escapeHtmlText(item.title || '作品');
    const desc = escapeHtmlText(item.description || '');
    const tags = (item.tags || []).slice(0, 12);
    const imgRaw = item.image_url || '';
    const img = typeof proxyImage === 'function' ? proxyImage(imgRaw, base) : imgRaw;
    const seoDesc = desc
        ? ('<span class="media-wall-seo-desc">描述：' + desc + '</span>')
        : '';
    const seoTags = tags.length
        ? ('<span class="media-wall-seo-desc">標籤：' + escapeHtmlText(tags.join(' ')) + '</span>')
        : '';
    const imgHtml = img
        ? ('<img src="' + escapeHtmlAttr(img) + '" alt="' + escapeHtmlAttr(item.title || '') + '" loading="lazy" width="260" height="260">')
        : '';
    // data-item：JS 就緒後左鍵仍開 lightbox；href 給爬蟲／新分頁直達獨立頁
    const dataItem = {
        id: String(item.id),
        type: type,
        title: item.title || '作品',
        image_url: imgRaw,
        inspiration_url: href,
        description: item.description || '',
        display_tags: tags,
        ai_tags: tags
    };
    const dataAttr = escapeHtmlAttr(JSON.stringify(dataItem));
    return (
        '<div class="media-wall-item" data-type="' + escapeHtmlAttr(type) + '" data-ssr="1" data-item="' + dataAttr + '">' +
        '<article class="card">' +
        '<a href="' + escapeHtmlAttr(href) + '" class="media-wall-card-link text-decoration-none text-dark">' +
        '<div class="card-img-wrap">' + imgHtml +
        '<div class="card-title-overlay"><h2>' + title + '</h2></div>' +
        seoDesc + seoTags +
        '</div></a></article></div>'
    );
}

function buildHomeMediaWallSsrGridHtml(items, base, proxyImage) {
    return (items || []).map(function (it) {
        return buildHomeMediaWallSsrCardHtml(it, base, proxyImage);
    }).join('');
}

function buildHomeMediaWallItemListJsonLd(items, base) {
    const list = (items || []).slice(0, 40).map(function (item, i) {
        const type = String(item.type || 'user_design');
        const url = String(base).replace(/\/$/, '') + '/inspiration/' + encodeURIComponent(type) + '/' + encodeURIComponent(item.id);
        return {
            '@type': 'ListItem',
            position: i + 1,
            url: url,
            name: item.title || '作品',
            description: item.description || undefined
        };
    });
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'MATCHDO 靈感牆',
        numberOfItems: list.length,
        itemListElement: list
    };
}

/**
 * 依分類強化首頁 meta（query landing，不改版面）
 */
async function resolveHomeCategoryMeta(supabase, categoryKey) {
    const key = String(categoryKey || '').trim();
    if (!key) return null;
    try {
        const { data } = await supabase
            .from('custom_product_categories')
            .select('key, name')
            .eq('key', key)
            .maybeSingle();
        if (data && data.name) {
            return {
                key: data.key,
                name: data.name,
                title: data.name + '｜MATCHDO 合做靈感牆',
                description: '瀏覽「' + data.name + '」相關設計稿與作品。每張圖皆有獨立作品頁，可搜尋標題、說明與標籤。'
            };
        }
    } catch (_) {}
    return {
        key: key,
        name: key,
        title: key + '｜MATCHDO 合做靈感牆',
        description: '瀏覽「' + key + '」相關設計稿與作品。每張圖皆有獨立作品頁。'
    };
}

function applyHomeSsrToHtml(html, opts) {
    opts = opts || {};
    let out = String(html || '');
    const gridHtml = opts.gridHtml || '';
    if (gridHtml) {
        const next = out.replace(
            /<div id="media-wall-grid">[\s\S]*?<\/div>(\s*<div id="media-wall-sentinel")/,
            '<div id="media-wall-grid">' + gridHtml + '</div>$1'
        );
        if (next !== out) out = next;
        else if (out.indexOf('id="media-wall-grid"') >= 0 && out.indexOf('data-ssr="1"') < 0) {
            out = out.replace(/<div id="media-wall-grid">/, '<div id="media-wall-grid">' + gridHtml);
        }
    }
    if (opts.itemListJson) {
        const script = '<script type="application/ld+json" id="media-wall-ssr-itemlist-ld">' +
            JSON.stringify(opts.itemListJson).replace(/</g, '\\u003c') + '</script>';
        if (out.indexOf('media-wall-ssr-itemlist-ld') < 0 && out.indexOf('</head>') >= 0) {
            out = out.replace('</head>', script + '\n</head>');
        }
    }
    if (opts.metaTitle) {
        out = out.replace(/<title>[^<]*<\/title>/, '<title>' + escapeHtmlText(opts.metaTitle) + '</title>');
        out = out.replace(/property="og:title" content="[^"]*"/, 'property="og:title" content="' + escapeHtmlAttr(opts.metaTitle) + '"');
    }
    if (opts.metaDescription) {
        out = out.replace(
            /name="description" content="[^"]*"/,
            'name="description" content="' + escapeHtmlAttr(opts.metaDescription) + '"'
        );
        out = out.replace(
            /property="og:description" content="[^"]*"/,
            'property="og:description" content="' + escapeHtmlAttr(opts.metaDescription) + '"'
        );
    }
    if (opts.canonicalUrl) {
        out = out.replace(
            /(<link rel="canonical" href=")[^"]*(" id="mw-canonical")/,
            '$1' + escapeHtmlAttr(opts.canonicalUrl) + '$2'
        );
        out = out.replace(
            /property="og:url" content="[^"]*"/,
            'property="og:url" content="' + escapeHtmlAttr(opts.canonicalUrl) + '"'
        );
    }
    if (opts.crawlNavHtml && out.indexOf('mw-inspiration-crawl-links') < 0 && out.indexOf('</body>') >= 0) {
        out = out.replace('</body>', opts.crawlNavHtml + '\n</body>');
    }
    return out;
}

module.exports = {
    fetchHomeMediaWallSsrItems,
    buildHomeMediaWallSsrGridHtml,
    buildHomeMediaWallItemListJsonLd,
    resolveHomeCategoryMeta,
    applyHomeSsrToHtml
};
