'use strict';

const visualSemantics = require('./visual-semantics');

let supabase;

function init(deps) {
    supabase = deps.supabase;
}

/** 合併手動 tags、ai_tags、image_semantics_json.tags（靈感牆／SEO／搜尋用） */
function displayTagsForRow(row) {
    if (!row) return [];
    const manual = Array.isArray(row.tags) ? row.tags : [];
    const ai = Array.isArray(row.ai_tags) ? row.ai_tags : [];
    let semTags = [];
    const sem = row.image_semantics_json;
    if (sem && typeof sem === 'object' && Array.isArray(sem.tags)) semTags = sem.tags;
    else if (typeof sem === 'string' && sem.trim()) {
        try {
            const o = JSON.parse(sem);
            if (o && Array.isArray(o.tags)) semTags = o.tags;
        } catch (_) {}
    }
    return visualSemantics.mergeTags(manual, ai, semTags);
}

function attachDisplayTags(item) {
    if (!item || typeof item !== 'object') return item;
    item.display_tags = displayTagsForRow(item);
    return item;
}

function mediaWallItemSearchHaystack(item) {
    if (!item) return '';
    const tags = item.display_tags || displayTagsForRow(item);
    return [
        item.title,
        item.description,
        item.generation_prompt,
        item.design_highlight,
        item.category_key,
        item.subcategory_key,
        item.owner_display,
        ...(tags || [])
    ].filter(Boolean).join(' ').toLowerCase();
}

function parseMediaWallTagFilters(raw) {
    if (raw == null || raw === '') return [];
    const s = String(raw).trim();
    if (!s) return [];
    return [...new Set(s.split(',').map((t) => t.trim()).filter(Boolean))];
}

/** 多個 tag 參數須全部符合（AND），可與 q／category／layout_type 疊加 */
function mediaWallItemMatchesTagFilters(item, tagFilters) {
    if (!tagFilters || !tagFilters.length) return true;
    attachDisplayTags(item);
    const tags = (item.display_tags || displayTagsForRow(item) || []).map((t) => String(t).trim().toLowerCase());
    return tagFilters.every((tf) => {
        const needle = String(tf).trim().toLowerCase();
        if (!needle) return true;
        return tags.some((t) => t === needle || t.includes(needle) || needle.includes(t));
    });
}

function escapeForIlike(q) {
    return String(q || '').replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function applyMediaWallCategoryFilters(query, { categoryKeysToMatch, filterCategoryKey, filterSubcategoryKey }) {
    if (categoryKeysToMatch && categoryKeysToMatch.length) query = query.in('category_key', categoryKeysToMatch);
    else if (filterCategoryKey) query = query.eq('category_key', filterCategoryKey);
    if (filterSubcategoryKey) query = query.eq('subcategory_key', filterSubcategoryKey);
    return query;
}

function applyCustomProductCategoryFilters(query, { categoryKeysToMatch, filterCategoryKey, filterSubcategoryKey }) {
    if (categoryKeysToMatch && categoryKeysToMatch.length) query = query.in('category', categoryKeysToMatch);
    else if (filterCategoryKey) query = query.eq('category', filterCategoryKey);
    if (filterSubcategoryKey) query = query.eq('subcategory_key', filterSubcategoryKey);
    return query;
}

async function fetchOwnerDisplayMap(ownerIds) {
    const ownerDisplayMap = {};
    if (!ownerIds || !ownerIds.length) return ownerDisplayMap;
    try {
        const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', ownerIds);
        (profs || []).forEach((pr) => { ownerDisplayMap[pr.id] = (pr.full_name && pr.full_name.trim()) || pr.email || ''; });
    } catch (_) {}
    return ownerDisplayMap;
}

function mapUserRowToMediaWallItem(p, ownerDisplayMap) {
    let aj = p.analysis_json;
    if (typeof aj === 'string') try { aj = JSON.parse(aj); } catch (_) { aj = null; }
    const seed = p.generation_seed ?? (aj && (aj.generation_seed ?? aj.seed));
    const id = p.id;
    return attachDisplayTags({
        ...p,
        analysis_json: aj || null,
        generation_seed: seed != null && seed !== '' ? seed : null,
        type: 'user_design',
        size: '1x1',
        title: p.title || '未命名',
        image_url: p.ai_generated_image_url || p.reference_image_url,
        link: '/custom/gallery.html',
        inspiration_url: id ? `/inspiration/user_design/${id}` : null,
        owner_display: ownerDisplayMap[p.owner_id] || null,
        category_key: p.category || null,
        subcategory_key: p.subcategory_key || null
    });
}

function mapPortfolioRowToMediaWallItem(p, compMfrMap) {
    const nowIso = new Date().toISOString();
    const seriesExpired = p.series_image_valid_until && p.series_image_valid_until < nowIso;
    const imageUrl = seriesExpired ? null : (p.image_url || null);
    const imageUrlBefore = p.image_url_before || null;
    const seriesUrls = (Array.isArray(p.series_image_urls) && p.series_image_urls.length)
        ? (seriesExpired ? [] : p.series_image_urls)
        : (imageUrl ? [imageUrl] : []);
    const itemType = imageUrlBefore ? 'comparison' : 'series';
    const mfrUserId = compMfrMap[p.manufacturer_id] || null;
    const item = attachDisplayTags({
        type: itemType,
        size: '1x1',
        id: p.id,
        manufacturer_id: p.manufacturer_id,
        manufacturer_user_id: mfrUserId,
        title: p.title || '廠商作品',
        image_url: imageUrl,
        design_highlight: p.design_highlight || null,
        tags: Array.isArray(p.tags) ? p.tags : [],
        ai_tags: Array.isArray(p.ai_tags) ? p.ai_tags : [],
        image_semantics_json: p.image_semantics_json || null,
        description: p.description || null,
        category_key: p.category_key || null,
        subcategory_key: p.subcategory_key || null,
        link: p.manufacturer_id ? '/vendor-profile.html?id=' + encodeURIComponent(p.manufacturer_id) : '/custom/gallery.html',
        inspiration_url: p.id ? `/inspiration/${itemType}/${p.id}` : null,
        created_at: p.created_at
    });
    if (itemType === 'comparison') item.image_url_before = imageUrlBefore;
    if (itemType === 'series' && seriesUrls.length) item.series_image_urls = seriesUrls;
    return item;
}

/** 站內搜尋：查已公開作品池（非僅首頁最新一頁），含標題／提示詞／AI 標籤 */
async function loadMediaWallSearchResults(searchQ, opts) {
    const {
        page, perPage, offset, layoutOnly,
        categoryKeysToMatch, filterCategoryKey, filterSubcategoryKey
    } = opts;
    const qLower = searchQ.toLowerCase();
    const pattern = `%${escapeForIlike(searchQ)}%`;
    const pool = Math.min(500, Math.max(perPage * 10, 150));
    const merged = [];
    const userSelect = 'id, title, category, subcategory_key, ai_generated_image_url, reference_image_url, created_at, owner_id, analysis_json, generation_prompt, generation_seed, show_on_homepage, ai_tags, image_semantics_json';
    const portfolioSelect = 'id, manufacturer_id, title, image_url, image_url_before, design_highlight, tags, ai_tags, image_semantics_json, description, show_on_media_wall, category_key, subcategory_key, series_image_valid_until, series_image_urls, created_at';

    const pushIfMatch = (item, createdAt) => {
        if (!item || !mediaWallItemSearchHaystack(item).includes(qLower)) return;
        if (layoutOnly === 'user_design' && (item.type !== 'user_design' || item.manufacturer_id)) return;
        if (layoutOnly === 'comparison' && item.type !== 'comparison') return;
        if (layoutOnly === 'series' && item.type !== 'series') return;
        if (layoutOnly === 'collection' && item.type !== 'collection') return;
        merged.push({ item, created_at: createdAt || item.created_at || '' });
    };

    if (!layoutOnly || layoutOnly === 'user_design') {
        const seen = new Set();
        const ingestUsers = async (rows) => {
            if (!rows || !rows.length) return;
            const ownerMap = await fetchOwnerDisplayMap([...new Set(rows.map((p) => p.owner_id).filter(Boolean))]);
            rows.forEach((p) => {
                if (!p || !p.id || seen.has(p.id)) return;
                const item = mapUserRowToMediaWallItem(p, ownerMap);
                if (!mediaWallItemSearchHaystack(item).includes(qLower)) return;
                seen.add(p.id);
                merged.push({ item, created_at: p.created_at || '' });
            });
        };
        let qText = supabase.from('custom_products').select(userSelect)
            .not('ai_generated_image_url', 'is', null)
            .or('show_on_homepage.eq.true,show_on_homepage.is.null')
            .or(`title.ilike.${pattern},generation_prompt.ilike.${pattern},description.ilike.${pattern}`);
        qText = applyCustomProductCategoryFilters(qText, { categoryKeysToMatch, filterCategoryKey, filterSubcategoryKey });
        const textRes = await qText.order('created_at', { ascending: false }).limit(pool);
        await ingestUsers(textRes.data);
        let qPool = supabase.from('custom_products').select(userSelect)
            .not('ai_generated_image_url', 'is', null)
            .or('show_on_homepage.eq.true,show_on_homepage.is.null');
        qPool = applyCustomProductCategoryFilters(qPool, { categoryKeysToMatch, filterCategoryKey, filterSubcategoryKey });
        const poolRes = await qPool.order('created_at', { ascending: false }).limit(pool);
        await ingestUsers(poolRes.data);
    }

    if (!layoutOnly || layoutOnly === 'comparison' || layoutOnly === 'series') {
        const seenP = new Set();
        const ingestPortfolio = async (rows) => {
            if (!rows || !rows.length) return;
            const mfrIds = [...new Set(rows.map((p) => p.manufacturer_id).filter(Boolean))];
            const mfrMap = {};
            if (mfrIds.length) {
                const { data: mfrs } = await supabase.from('manufacturers').select('id, user_id').in('id', mfrIds).eq('is_active', true);
                (mfrs || []).forEach((m) => { mfrMap[m.id] = m.user_id || null; });
            }
            rows.forEach((p) => {
                if (!p || !p.id || seenP.has(p.id)) return;
                const item = mapPortfolioRowToMediaWallItem(p, mfrMap);
                if (!mediaWallItemSearchHaystack(item).includes(qLower)) return;
                seenP.add(p.id);
                merged.push({ item, created_at: p.created_at || '' });
            });
        };
        let qText = supabase.from('manufacturer_portfolio').select(portfolioSelect)
            .eq('show_on_media_wall', true)
            .or(`title.ilike.${pattern},description.ilike.${pattern},design_highlight.ilike.${pattern}`);
        qText = applyMediaWallCategoryFilters(qText, { categoryKeysToMatch, filterCategoryKey, filterSubcategoryKey });
        if (layoutOnly === 'comparison') qText = qText.not('image_url_before', 'is', null);
        if (layoutOnly === 'series') qText = qText.is('image_url_before', null);
        const textRes = await qText.order('created_at', { ascending: false }).limit(pool);
        await ingestPortfolio(textRes.data);
        let qPool = supabase.from('manufacturer_portfolio').select(portfolioSelect).eq('show_on_media_wall', true);
        qPool = applyMediaWallCategoryFilters(qPool, { categoryKeysToMatch, filterCategoryKey, filterSubcategoryKey });
        if (layoutOnly === 'comparison') qPool = qPool.not('image_url_before', 'is', null);
        if (layoutOnly === 'series') qPool = qPool.is('image_url_before', null);
        const poolRes = await qPool.order('created_at', { ascending: false }).limit(pool);
        await ingestPortfolio(poolRes.data);
    }

    if (!layoutOnly || layoutOnly === 'collection') {
        let collQ = supabase.from('media_collections').select('id, title, slug, cover_image_url, image_urls, description, category_keys, manufacturer_id, created_at')
            .eq('is_active', true)
            .or(`title.ilike.${pattern},description.ilike.${pattern}`);
        const collRes = await collQ.order('created_at', { ascending: false }).limit(pool);
        (collRes.data || []).forEach((row) => {
            if (filterCategoryKey && row.category_keys && Array.isArray(row.category_keys) && row.category_keys.indexOf(filterCategoryKey) === -1) return;
            const cover = row.cover_image_url || null;
            const imageUrls = (row.image_urls && Array.isArray(row.image_urls) && row.image_urls.length) ? row.image_urls : (cover ? [cover] : []);
            const item = attachDisplayTags({
                type: 'collection',
                size: '1x2',
                id: row.id,
                title: row.title || '系列',
                slug: row.slug,
                cover_image_url: cover,
                series_image_urls: imageUrls,
                description: row.description || null,
                link: row.slug ? '/custom/collection.html?slug=' + encodeURIComponent(row.slug) : '/custom/gallery.html',
                inspiration_url: row.id ? `/inspiration/collection/${row.id}` : null,
                created_at: row.created_at
            });
            pushIfMatch(item, row.created_at);
        });
    }

    merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return merged.slice(offset, offset + perPage).map((x) => x.item);
}

function escapeHtmlAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function buildInspirationTagsBlockHtml(tags) {
    if (!tags || !tags.length) return '';
    const inner = tags.map((t) => '<span class="inspiration-tag">' + escapeHtmlAttr(t) + '</span>').join('');
    return '<details class="inspiration-tags-details"><summary><i class="bi bi-tags" aria-hidden="true"></i> 標籤（' + tags.length + '）</summary><div class="inspiration-tags-list">' + inner + '</div></details>';
}

module.exports = {
    init,
    displayTagsForRow,
    attachDisplayTags,
    mediaWallItemSearchHaystack,
    parseMediaWallTagFilters,
    mediaWallItemMatchesTagFilters,
    escapeForIlike,
    applyMediaWallCategoryFilters,
    applyCustomProductCategoryFilters,
    fetchOwnerDisplayMap,
    mapUserRowToMediaWallItem,
    mapPortfolioRowToMediaWallItem,
    loadMediaWallSearchResults,
    escapeHtmlAttr,
    buildInspirationTagsBlockHtml
};
