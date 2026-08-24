'use strict';

/**
 * 靈感牆 DB 查詢（設計圖 custom_products、情境圖 product_promo_generations）
 *
 * 必守 invariant（不可在 fallback 中靜默移除）：
 * - 設計圖：ai_generated_image_url 非空；show_on_homepage 欄位存在時僅 true/null
 * - 情境圖：status=success、有 result_image_url；source_type 為表內合法值（含 upload／digital_asset）；show_on_homepage 欄位存在時僅 true
 * - 一律 created_at DESC
 *
 * 缺 SELECT 欄位：只重試 select 字串，WHERE 篩選保持不變。
 */

function isSupabaseMissingColumnError(err, colName) {
    if (!err) return false;
    const code = String(err.code || '');
    const msg = String(err.message || '');
    if (code === '42703' || code === 'PGRST204') {
        return colName ? msg.includes(colName) : true;
    }
    if (/schema cache|could not find the/i.test(msg)) {
        return colName ? msg.includes(colName) : /column/i.test(msg);
    }
    return false;
}

const CUSTOM_PRODUCT_MEDIA_WALL_SELECT = 'id, title, title_en, category, subcategory_key, ai_generated_image_url, reference_image_url, created_at, owner_id, analysis_json, generation_prompt, generation_seed, show_on_homepage, ai_tags, image_semantics_json, semantics_generated_at, reference_sources';
const CUSTOM_PRODUCT_MEDIA_WALL_SELECT_NO_TITLE_EN = 'id, title, category, subcategory_key, ai_generated_image_url, reference_image_url, created_at, owner_id, analysis_json, generation_prompt, generation_seed, show_on_homepage, ai_tags, image_semantics_json, semantics_generated_at, reference_sources';

const CUSTOM_PRODUCT_SOURCE_SELECT = 'id, title, title_en, category, subcategory_key, image_semantics_json';
const CUSTOM_PRODUCT_SOURCE_SELECT_NO_TITLE_EN = 'id, title, category, subcategory_key, image_semantics_json';

const VENDOR_ASSET_SOURCE_SELECT = 'id, title, title_en, category_key, subcategory_key, image_semantics_json';
const VENDOR_ASSET_SOURCE_SELECT_NO_TITLE_EN = 'id, title, category_key, subcategory_key, image_semantics_json';

const PROMO_SCENE_MEDIA_WALL_SELECT = 'id, user_id, source_type, source_id, source_image_url, aspect_ratio, width, height, megapixels, user_prompt, scene_template_key, scene_key, final_prompt, result_image_url, ai_tags, image_semantics_json, description, semantics_generated_at, created_at, show_on_homepage, generation_mode, generation_meta_json, camera_params';
const PROMO_SCENE_MEDIA_WALL_SELECT_NO_META = 'id, user_id, source_type, source_id, source_image_url, aspect_ratio, width, height, megapixels, user_prompt, scene_template_key, scene_key, final_prompt, result_image_url, ai_tags, image_semantics_json, description, semantics_generated_at, created_at, show_on_homepage, generation_mode, camera_params';
const PROMO_SCENE_MEDIA_WALL_SELECT_LEGACY = 'id, user_id, source_type, source_id, source_image_url, aspect_ratio, width, height, user_prompt, scene_template_key, final_prompt, result_image_url, created_at';

const CUSTOM_PRODUCT_LEGACY_SELECT = 'id, title, category, ai_generated_image_url, reference_image_url, created_at, owner_id, analysis_json, generation_prompt, generation_seed';

function filterOutPromoPortraitMoodDraftRows(rows) {
    return (rows || []).filter(function (row) {
        const raw = row && row.generation_meta_json;
        let meta = raw;
        if (typeof raw === 'string') {
            try { meta = JSON.parse(raw); } catch (_) { meta = {}; }
        }
        if (!meta || typeof meta !== 'object') return true;
        return String(meta.mood_stage || '').toLowerCase() !== 'draft';
    });
}

function buildCustomProductMediaWallQuery(supabase, selectCols, filters) {
    const { categoryKeysToMatch, filterCategoryKey, filterSubcategoryKey, withHomepageFilter, searchPattern } = filters || {};
    let q = supabase.from('custom_products').select(selectCols)
        .not('ai_generated_image_url', 'eq', null);
    if (withHomepageFilter !== false) {
        q = q.or('show_on_homepage.eq.true,show_on_homepage.is.null');
    }
    if (searchPattern) {
        q = q.or(`title.ilike.${searchPattern},generation_prompt.ilike.${searchPattern},description.ilike.${searchPattern}`);
    }
    if (categoryKeysToMatch && categoryKeysToMatch.length) q = q.in('category', categoryKeysToMatch);
    else if (filterCategoryKey) q = q.eq('category', filterCategoryKey);
    if (filterSubcategoryKey) q = q.eq('subcategory_key', filterSubcategoryKey);
    return q;
}

function buildPromoSceneMediaWallQuery(supabase, selectCols, opts) {
    const { withHomepageFilter } = opts || {};
    let q = supabase.from('product_promo_generations').select(selectCols)
        .eq('status', 'success')
        .in('source_type', ['custom_product', 'vendor_asset', 'upload', 'digital_asset'])
        .not('result_image_url', 'is', null);
    if (withHomepageFilter) q = q.eq('show_on_homepage', true);
    return q;
}

async function fetchCustomProductMediaWallRowsLegacy(supabase, filters, rangeFrom, rangeTo) {
    let q = supabase.from('custom_products').select(CUSTOM_PRODUCT_LEGACY_SELECT)
        .not('ai_generated_image_url', 'eq', null);
    if (filters && filters.categoryKeysToMatch && filters.categoryKeysToMatch.length) q = q.in('category', filters.categoryKeysToMatch);
    else if (filters && filters.filterCategoryKey) q = q.eq('category', filters.filterCategoryKey);
    const res = await q.order('created_at', { ascending: false }).range(rangeFrom, rangeTo);
    let rows = res.data || [];
    if (filters && filters.filterSubcategoryKey && rows.length) {
        rows = rows.filter((p) => (p.subcategory_key || '') === filters.filterSubcategoryKey);
    }
    return rows;
}

/**
 * @returns {Promise<object[]>}
 */
async function fetchCustomProductMediaWallRows(supabase, filters, rangeFrom, rangeTo, logFn) {
    const orderRange = (selectCols, homepageFilter) =>
        buildCustomProductMediaWallQuery(supabase, selectCols, { ...filters, withHomepageFilter: homepageFilter !== false })
            .order('created_at', { ascending: false })
            .range(rangeFrom, rangeTo);

    let res = await orderRange(CUSTOM_PRODUCT_MEDIA_WALL_SELECT, true);
    if (res.error && isSupabaseMissingColumnError(res.error, 'title_en')) {
        res = await orderRange(CUSTOM_PRODUCT_MEDIA_WALL_SELECT_NO_TITLE_EN, true);
    }
    if (res.error && isSupabaseMissingColumnError(res.error, 'semantics_generated_at')) {
        const noSem = CUSTOM_PRODUCT_MEDIA_WALL_SELECT.replace(', semantics_generated_at', '');
        const noSemNoEn = CUSTOM_PRODUCT_MEDIA_WALL_SELECT_NO_TITLE_EN.replace(', semantics_generated_at', '');
        res = await orderRange(noSem, true);
        if (res.error && isSupabaseMissingColumnError(res.error, 'title_en')) {
            res = await orderRange(noSemNoEn, true);
        }
    }
    if (!res.error) return res.data || [];

    if (isSupabaseMissingColumnError(res.error, 'show_on_homepage') || isSupabaseMissingColumnError(res.error, 'subcategory_key')) {
        return fetchCustomProductMediaWallRowsLegacy(supabase, filters, rangeFrom, rangeTo);
    }
    if (logFn) logFn('fetchCustomProductMediaWallRows:', res.error.message);
    return [];
}

/**
 * @returns {Promise<object[]>}
 */
async function fetchCustomProductMediaWallPool(supabase, filters, limit, logFn) {
    const orderLimit = (selectCols) =>
        buildCustomProductMediaWallQuery(supabase, selectCols, filters)
            .order('created_at', { ascending: false })
            .limit(limit);

    let res = await orderLimit(CUSTOM_PRODUCT_MEDIA_WALL_SELECT);
    if (res.error && isSupabaseMissingColumnError(res.error, 'title_en')) {
        res = await orderLimit(CUSTOM_PRODUCT_MEDIA_WALL_SELECT_NO_TITLE_EN);
    }
    if (res.error && isSupabaseMissingColumnError(res.error, 'semantics_generated_at')) {
        const noSem = CUSTOM_PRODUCT_MEDIA_WALL_SELECT.replace(', semantics_generated_at', '');
        const noSemNoEn = CUSTOM_PRODUCT_MEDIA_WALL_SELECT_NO_TITLE_EN.replace(', semantics_generated_at', '');
        res = await orderLimit(noSem);
        if (res.error && isSupabaseMissingColumnError(res.error, 'title_en')) {
            res = await orderLimit(noSemNoEn);
        }
    }
    if (!res.error) return res.data || [];
    if (isSupabaseMissingColumnError(res.error, 'show_on_homepage') || isSupabaseMissingColumnError(res.error, 'subcategory_key')) {
        let q = supabase.from('custom_products').select(CUSTOM_PRODUCT_LEGACY_SELECT)
            .not('ai_generated_image_url', 'eq', null);
        if (filters && filters.categoryKeysToMatch && filters.categoryKeysToMatch.length) q = q.in('category', filters.categoryKeysToMatch);
        else if (filters && filters.filterCategoryKey) q = q.eq('category', filters.filterCategoryKey);
        const legacy = await q.order('created_at', { ascending: false }).limit(limit);
        return legacy.data || [];
    }
    if (logFn) logFn('fetchCustomProductMediaWallPool:', res.error.message);
    return [];
}

/**
 * 情境圖：show_on_homepage 欄位不存在時才略過 eq（舊 schema）；select 缺欄只換 select。
 * @returns {Promise<object[]>}
 */
async function fetchPromoSceneMediaWallRows(supabase, rangeFrom, rangeTo, logFn) {
    const orderRange = (selectCols, withHomepageFilter) =>
        buildPromoSceneMediaWallQuery(supabase, selectCols, { withHomepageFilter })
            .order('created_at', { ascending: false })
            .range(rangeFrom, rangeTo);

    // 強制篩選 show_on_homepage = true（只顯示公開的新圖）
    let withHomepage = true;
    let res = await orderRange(PROMO_SCENE_MEDIA_WALL_SELECT, withHomepage);
    if (res.error && isSupabaseMissingColumnError(res.error, 'show_on_homepage')) {
        // 欄位不存在 = 舊 schema，不顯示任何圖（避免顯示舊圖）
        console.warn('⚠️ product_promo_generations 缺 show_on_homepage 欄位，情境圖無法顯示。請執行：docs/add-promo-show-on-homepage.sql');
        return [];
    }
    if (res.error && isSupabaseMissingColumnError(res.error, 'ai_tags')) {
        res = await orderRange(PROMO_SCENE_MEDIA_WALL_SELECT_LEGACY, withHomepage);
    }
    if (res.error && isSupabaseMissingColumnError(res.error, 'generation_meta_json')) {
        res = await orderRange(PROMO_SCENE_MEDIA_WALL_SELECT_NO_META, withHomepage);
    }
    if (res.error && isSupabaseMissingColumnError(res.error, 'camera_params')) {
        res = await orderRange(PROMO_SCENE_MEDIA_WALL_SELECT.replace(', camera_params', ''), withHomepage);
    }
    if (res.error && isSupabaseMissingColumnError(res.error, 'megapixels')) {
        res = await orderRange(PROMO_SCENE_MEDIA_WALL_SELECT.replace(', megapixels', ''), withHomepage);
    }
    if (res.error && isSupabaseMissingColumnError(res.error, 'generation_mode')) {
        res = await orderRange(PROMO_SCENE_MEDIA_WALL_SELECT_LEGACY, withHomepage);
    }
    if (res.error && isSupabaseMissingColumnError(res.error, 'scene_key')) {
        res = await orderRange(PROMO_SCENE_MEDIA_WALL_SELECT_LEGACY, withHomepage);
    }
    if (!res.error) return filterOutPromoPortraitMoodDraftRows(res.data || []);
    if (logFn) logFn('fetchPromoSceneMediaWallRows:', res.error.message);
    return [];
}

async function fetchPromoSceneMediaWallPool(supabase, limit, logFn) {
    const orderLimit = (selectCols, withHomepageFilter) =>
        buildPromoSceneMediaWallQuery(supabase, selectCols, { withHomepageFilter })
            .order('created_at', { ascending: false })
            .limit(limit);

    // 強制篩選 show_on_homepage = true（只顯示公開的新圖）
    let withHomepage = true;
    let res = await orderLimit(PROMO_SCENE_MEDIA_WALL_SELECT, withHomepage);
    if (res.error && isSupabaseMissingColumnError(res.error, 'show_on_homepage')) {
        // 欄位不存在 = 舊 schema，不顯示任何圖（避免顯示舊圖）
        console.warn('⚠️ product_promo_generations 缺 show_on_homepage 欄位，情境圖無法顯示。請執行：docs/add-promo-show-on-homepage.sql');
        return [];
    }
    if (res.error && isSupabaseMissingColumnError(res.error, 'ai_tags')) {
        res = await orderLimit(PROMO_SCENE_MEDIA_WALL_SELECT_LEGACY, withHomepage);
    }
    if (res.error && isSupabaseMissingColumnError(res.error, 'generation_meta_json')) {
        res = await orderLimit(PROMO_SCENE_MEDIA_WALL_SELECT_NO_META, withHomepage);
    }
    if (res.error && isSupabaseMissingColumnError(res.error, 'camera_params')) {
        res = await orderLimit(PROMO_SCENE_MEDIA_WALL_SELECT.replace(', camera_params', ''), withHomepage);
    }
    if (res.error && isSupabaseMissingColumnError(res.error, 'megapixels')) {
        res = await orderLimit(PROMO_SCENE_MEDIA_WALL_SELECT.replace(', megapixels', ''), withHomepage);
    }
    if (res.error && isSupabaseMissingColumnError(res.error, 'generation_mode')) {
        res = await orderLimit(PROMO_SCENE_MEDIA_WALL_SELECT_LEGACY, withHomepage);
    }
    if (res.error && isSupabaseMissingColumnError(res.error, 'scene_key')) {
        res = await orderLimit(PROMO_SCENE_MEDIA_WALL_SELECT_LEGACY, withHomepage);
    }
    if (!res.error) return filterOutPromoPortraitMoodDraftRows(res.data || []);
    if (logFn) logFn('fetchPromoSceneMediaWallPool:', res.error.message);
    return [];
}

/** @returns {Promise<object|null>} */
async function fetchCustomProductMediaWallRowById(supabase, id, logFn) {
    const pid = String(id || '').trim();
    if (!pid) return null;
    async function one(selectCols) {
        return supabase.from('custom_products').select(selectCols).eq('id', pid).maybeSingle();
    }
    let { data, error } = await one(CUSTOM_PRODUCT_MEDIA_WALL_SELECT);
    if (error && isSupabaseMissingColumnError(error, 'title_en')) {
        ({ data, error } = await one(CUSTOM_PRODUCT_MEDIA_WALL_SELECT_NO_TITLE_EN));
    }
    if (error && logFn) logFn('fetchCustomProductMediaWallRowById:', error.message);
    return data || null;
}

/** @returns {Promise<object|null>} */
async function fetchPromoSceneMediaWallRowById(supabase, id, logFn) {
    const promoId = String(id || '').trim();
    if (!promoId) return null;
    async function one(selectCols, withHomepageFilter) {
        let q = buildPromoSceneMediaWallQuery(supabase, selectCols, { withHomepageFilter })
            .eq('id', promoId)
            .eq('status', 'success')
            .not('result_image_url', 'is', null);
        return q.maybeSingle();
    }
    let withHomepage = true;
    let { data, error } = await one(PROMO_SCENE_MEDIA_WALL_SELECT, withHomepage);
    if (error && isSupabaseMissingColumnError(error, 'show_on_homepage')) {
        withHomepage = false;
        ({ data, error } = await one(PROMO_SCENE_MEDIA_WALL_SELECT, false));
    }
    if (error && isSupabaseMissingColumnError(error, 'ai_tags')) {
        ({ data, error } = await one(PROMO_SCENE_MEDIA_WALL_SELECT_LEGACY, withHomepage));
    }
    if (data && withHomepage && Object.prototype.hasOwnProperty.call(data, 'show_on_homepage') && data.show_on_homepage === false) {
        return null;
    }
    if (error && logFn) logFn('fetchPromoSceneMediaWallRowById:', error.message);
    return data || null;
}

/** @returns {Promise<Record<string, object>>} id → row */
async function fetchCustomProductSourceMap(supabase, ids, logFn) {
    const uniq = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))];
    const map = {};
    if (!uniq.length) return map;
    let { data, error } = await supabase.from('custom_products').select(CUSTOM_PRODUCT_SOURCE_SELECT).in('id', uniq);
    if (error && isSupabaseMissingColumnError(error, 'title_en')) {
        ({ data, error } = await supabase.from('custom_products').select(CUSTOM_PRODUCT_SOURCE_SELECT_NO_TITLE_EN).in('id', uniq));
    }
    if (error && logFn) logFn('fetchCustomProductSourceMap:', error.message);
    (data || []).forEach((p) => { if (p && p.id) map[p.id] = p; });
    return map;
}

/** @returns {Promise<Record<string, object>>} id → row（category 對齊 custom_products 供分類篩選） */
async function fetchVendorAssetSourceMap(supabase, ids, logFn) {
    const uniq = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))];
    const map = {};
    if (!uniq.length) return map;
    let { data, error } = await supabase.from('vendor_assets').select(VENDOR_ASSET_SOURCE_SELECT).in('id', uniq);
    if (error && isSupabaseMissingColumnError(error, 'title_en')) {
        ({ data, error } = await supabase.from('vendor_assets').select(VENDOR_ASSET_SOURCE_SELECT_NO_TITLE_EN).in('id', uniq));
    }
    if (error && logFn) logFn('fetchVendorAssetSourceMap:', error.message);
    (data || []).forEach((p) => {
        if (!p || !p.id) return;
        map[p.id] = {
            id: p.id,
            title: p.title,
            title_en: p.title_en || null,
            category: p.category_key || null,
            subcategory_key: p.subcategory_key || null,
            image_semantics_json: p.image_semantics_json || null
        };
    });
    return map;
}

function sortMediaWallItemsByCreatedAtDesc(items) {
    return [...(items || [])].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

function filterPromoRowsBySourceCategory(promoRows, srcMap, categoryKeysToMatch, filterSubcategoryKey) {
    return (promoRows || []).filter((row) => {
        const prod = row.source_id ? srcMap[row.source_id] : null;
        if (!prod) return false;
        if (categoryKeysToMatch && categoryKeysToMatch.length && categoryKeysToMatch.indexOf(prod.category) === -1) return false;
        if (filterSubcategoryKey && (prod.subcategory_key || '') !== filterSubcategoryKey) return false;
        return true;
    });
}

module.exports = {
    isSupabaseMissingColumnError,
    CUSTOM_PRODUCT_MEDIA_WALL_SELECT,
    CUSTOM_PRODUCT_MEDIA_WALL_SELECT_NO_TITLE_EN,
    buildCustomProductMediaWallQuery,
    fetchCustomProductMediaWallRows,
    fetchCustomProductMediaWallPool,
    fetchCustomProductMediaWallRowById,
    fetchPromoSceneMediaWallRows,
    fetchPromoSceneMediaWallPool,
    fetchPromoSceneMediaWallRowById,
    fetchCustomProductSourceMap,
    fetchVendorAssetSourceMap,
    filterPromoRowsBySourceCategory,
    sortMediaWallItemsByCreatedAtDesc
};
