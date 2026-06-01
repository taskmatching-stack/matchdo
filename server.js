// build: 2026-03-01
const path = require('path');
const fs = require('fs');

for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--stability-key' && process.argv[i + 1]) {
        process.env.STABILITY_API_KEY = process.argv[i + 1].trim();
        break;
    }
    if (arg.startsWith('--stability-key=')) {
        process.env.STABILITY_API_KEY = arg.slice(16).trim();
        break;
    }
}

const envPath = path.join(__dirname, '.env');
if (!process.env.STABILITY_API_KEY && !process.env.STABILITY_AI_API_KEY) {
    require('dotenv').config({ path: envPath });
    if (!process.env.STABILITY_API_KEY && !process.env.STABILITY_AI_API_KEY) require('dotenv').config();
}
if (!process.env.STABILITY_API_KEY && !process.env.STABILITY_AI_API_KEY && fs.existsSync(envPath)) {
    const stabilityKeys = ['STABILITY_API_KEY', 'STABILITY_AI_API_KEY', 'STABILITY_AI_KEY', 'STABILITY_KEY'];
    function tryParseEnv(buffer, encoding) {
        try {
            const raw = buffer.toString(encoding).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            for (const ln of raw.split('\n')) {
                const line = ln.trim();
                if (!line || line.startsWith('#')) continue;
                const idx = line.indexOf('=');
                if (idx <= 0) continue;
                const key = line.slice(0, idx).trim().replace(/^\uFEFF/, '');
                let val = line.slice(idx + 1).trim();
                const comment = val.indexOf('#');
                if (comment >= 0) val = val.slice(0, comment).trim();
                if (stabilityKeys.includes(key) && val) {
                    process.env.STABILITY_API_KEY = val;
                    return true;
                }
            }
        } catch (_) {}
        return false;
    }
    const buf = fs.readFileSync(envPath);
    if (!tryParseEnv(buf, 'utf8')) tryParseEnv(buf, 'utf16le');
}
if (!process.env.STABILITY_API_KEY && !process.env.STABILITY_AI_API_KEY) {
    const tryPaths = [path.join(__dirname, 'stability-key.txt'), path.join(process.cwd(), 'stability-key.txt')];
    for (const keyPath of tryPaths) {
        if (!fs.existsSync(keyPath)) continue;
        try {
            const buf = fs.readFileSync(keyPath);
            for (const enc of ['utf8', 'utf16le']) {
                const key = (buf.toString(enc).split(/\r?\n/)[0] || '').trim();
                if (key && key.startsWith('sk-') && key.length > 30) {
                    process.env.STABILITY_API_KEY = key;
                    break;
                }
            }
            if (process.env.STABILITY_API_KEY) break;
        } catch (_) {}
    }
}
function getStabilityApiKey() {
    return process.env.STABILITY_API_KEY || process.env.STABILITY_AI_API_KEY || process.env.STABILITY_AI_KEY || process.env.STABILITY_KEY || null;
}
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { Pool } = require('pg');
const { GoogleGenAI } = require('@google/genai');
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// 翻譯 prompt 用：可後台設定，見 getTranslationModelName。若報錯 404/模型不存在，請改為 gemini-2.0-flash 或 gemini-1.5-flash
const GEMINI_MODEL_TRANSLATION_DEFAULT = 'gemini-2.5-flash-lite';
// 讀圖／分析／估算等：可後台設定，見 getReadModelName（若 404 可改為 gemini-2.0-flash）
const GEMINI_MODEL_READ_DEFAULT = 'gemini-3-flash-preview';
const visualSemantics = require('./lib/visual-semantics');
const customProductLineage = require('./lib/custom-product-lineage');
const designerRegionFromIp = require('./lib/designer-region-from-ip');
const adminMigrations = require('./lib/admin-migrations');
const { normalizeVendorUploadFile } = require('./lib/resize-upload-image');
const { registerSitemapRoutes } = require('./routes/sitemap');

async function vendorAssetFileFromMulter(file) {
    if (!file) return null;
    return normalizeVendorUploadFile(file);
}

function mergeDesignerRegionIntoPayload(payload, req, uiLocale) {
    const region = designerRegionFromIp.resolveDesignerRegionFromRequest(req, { uiLocale });
    return Object.assign(payload, region);
}

/** migration 未執行時略過內部分析欄位後重試 insert */
function stripInternalCustomProductInsertColumns(payload) {
    const p = { ...payload };
    delete p.generator_manufacturer_id;
    delete p.has_self_vendor_reference;
    delete p.is_vendor_self_serve;
    delete p.data_lineage_json;
    designerRegionFromIp.DESIGNER_REGION_DB_KEYS.forEach((k) => { delete p[k]; });
    return p;
}
// Gemini API 排隊：多人同時用時依序送出
let _geminiQueueTail = Promise.resolve();
function runInGeminiQueue(fn) {
    const p = _geminiQueueTail.then(() => fn());
    _geminiQueueTail = p.catch(() => {});
    return p;
}
// 將 prompt 翻譯成英文（可關閉：.env 設 ENABLE_PROMPT_TRANSLATION=false 則不翻譯，直接送原文）
function looksLikeNonEnglish(str) {
    return /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(str);
}
// Gemini 僅用於讀圖產生描述（輔助），生圖僅用 FLUX
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.set('trust proxy', 1);
// 上傳目錄保留供靜態服務（向後相容舊 URL）；Multer 改為 memory 後改傳 Supabase Storage
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ storage: multer.memoryStorage() });
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(process.env.SUPABASE_URL, SUPABASE_KEY);

// Cloud Run：必須在時限內 listen，故在載入後續路由前先綁定 port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Server running on port', PORT);
});

async function getTranslationModelName() {
    try {
        const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'gemini_model').maybeSingle();
        const fromDb = row?.value?.trim?.();
        if (fromDb) return fromDb;
    } catch (_) {}
    return process.env.GEMINI_MODEL || GEMINI_MODEL_TRANSLATION_DEFAULT;
}

async function getReadModelName() {
    try {
        const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'gemini_model_read').maybeSingle();
        const fromDb = row?.value?.trim?.();
        if (fromDb) return fromDb;
    } catch (_) {}
    return process.env.GEMINI_MODEL_READ || GEMINI_MODEL_READ_DEFAULT;
}

async function getTaggingModelName() {
    return visualSemantics.getTaggingModelName(supabase);
}

function getVisualSemanticsDeps() {
    return {
        supabase,
        genAI,
        runInGeminiQueue,
        getTaggingModelName,
        fetch: globalThis.fetch
    };
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

function normalizeVendorAssetKind(raw) {
    const k = String(raw || '').trim().toLowerCase();
    if (k === 'material') return 'material';
    if (k === 'part') return 'part';
    return 'prototype';
}

/** 設計端／廠商端素材列表分頁（每頁 12 / 24 / 48，預設 12） */
function parseVendorAssetsListPageParams(query) {
    const allowed = [12, 24, 48];
    let limit = parseInt(query && query.limit, 10);
    if (!allowed.includes(limit)) limit = 12;
    let offset = parseInt(query && query.offset, 10);
    if (!Number.isFinite(offset) || offset < 0) offset = 0;
    return { limit, offset };
}

function paginateVendorAssetList(list, page) {
    const items = Array.isArray(list) ? list : [];
    const total = items.length;
    const limit = page.limit;
    const offset = Math.min(page.offset, Math.max(0, total));
    return {
        items: items.slice(offset, offset + limit),
        total,
        limit,
        offset
    };
}

/** 數位原型部位（選填、不強制枚舉）；材料參考一律 null */
function normalizeVendorPartKey(raw, assetKind) {
    const kind = normalizeVendorAssetKind(assetKind);
    if (kind === 'material') return null;
    const k = String(raw || '').trim().toLowerCase();
    if (!k) return null;
    return k.slice(0, 64);
}

const PROTOTYPE_GALLERY_MAX_EXTRA = 11; // 封面 image_url 以外最多再 11 張

function parseGalleryImages(raw) {
    if (raw == null || raw === '') return [];
    let arr = raw;
    if (typeof raw === 'string') {
        try { arr = JSON.parse(raw); } catch (_) { return []; }
    }
    if (!Array.isArray(arr)) return [];
    const out = [];
    arr.forEach(function (entry, idx) {
        let url = '';
        let sortOrder = idx;
        if (typeof entry === 'string') url = entry.trim();
        else if (entry && typeof entry === 'object') {
            url = String(entry.url || '').trim();
            if (entry.sort_order != null && !isNaN(entry.sort_order)) sortOrder = parseInt(entry.sort_order, 10);
        }
        if (url) out.push({ url: url, sort_order: sortOrder });
    });
    out.sort(function (a, b) { return a.sort_order - b.sort_order; });
    return out;
}

function getVendorAssetAllImageUrls(row) {
    if (!row) return [];
    const cover = String(row.image_url || '').trim();
    const urls = [];
    if (cover) urls.push(cover);
    parseGalleryImages(row.gallery_images).forEach(function (g) {
        if (g.url && urls.indexOf(g.url) < 0) urls.push(g.url);
    });
    return urls;
}

const VENDOR_CUSTOMIZATION_LEVEL_KEYS = new Set(['mono_graphic', 'color_graphic', 'color_material', 'size_part', 'form_structure']);
const VENDOR_CUSTOMIZATION_GRAPHIC_KEYS = ['mono_graphic', 'color_graphic'];
const VENDOR_CUSTOMIZATION_SCOPE_KEYS = ['color_material', 'size_part', 'form_structure'];

function normalizeCustomizationLevels(raw) {
    let arr = raw;
    if (raw == null || raw === '') return [];
    if (typeof raw === 'string') {
        const t = raw.trim();
        if (!t) return [];
        if (t.startsWith('{') && t.endsWith('}')) {
            const inner = t.slice(1, -1).trim();
            arr = inner ? inner.split(',').map((s) => s.trim().replace(/^"|"$/g, '')) : [];
        } else {
            try { arr = JSON.parse(t); } catch (_) { arr = t.split(/[,，]/); }
        }
    }
    if (!Array.isArray(arr)) return [];
    const out = [];
    arr.forEach(function (item) {
        const k = String(item || '').trim().toLowerCase();
        if (VENDOR_CUSTOMIZATION_LEVEL_KEYS.has(k) && out.indexOf(k) < 0) out.push(k);
    });
    const order = ['mono_graphic', 'color_graphic', 'color_material', 'size_part', 'form_structure'];
    out.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    return out;
}

/** 圖文能力階層：0=無、1=僅單色、2=含彩色（涵蓋單色） */
function graphicCustomizationTier(levels) {
    const set = new Set(normalizeCustomizationLevels(levels));
    if (set.has('color_graphic')) return 2;
    if (set.has('mono_graphic')) return 1;
    return 0;
}

/** 圖文：單色與彩色只能擇一（舊資料若兩者皆有則保留彩色） */
function sanitizeCustomizationLevelsForStorage(levels) {
    const out = normalizeCustomizationLevels(levels);
    const hasMono = out.indexOf('mono_graphic') >= 0;
    const hasColor = out.indexOf('color_graphic') >= 0;
    if (hasMono && hasColor) {
        return out.filter(function (k) { return k !== 'mono_graphic'; });
    }
    return out;
}

/** 多個參考原型：圖文能力取交集（最嚴） */
function intersectGraphicCustomizationTier(prototypeAssets) {
    const assets = Array.isArray(prototypeAssets) ? prototypeAssets : [];
    let minTier = 2;
    let any = false;
    assets.forEach(function (asset) {
        const t = graphicCustomizationTier(asset && asset.customization_levels);
        if (t < 1) return;
        any = true;
        if (t < minTier) minTier = t;
    });
    return any ? minTier : 0;
}

function assetSupportsCustomizationLevel(storedLevels, filterKey) {
    const levels = new Set(normalizeCustomizationLevels(storedLevels));
    const key = String(filterKey || '').trim().toLowerCase();
    if (!key || !levels.size) return false;
    if (levels.has(key)) return true;
    if (key === 'mono_graphic' && levels.has('color_graphic')) return true;
    return false;
}

function parseCustomizationLevelsFromBody(body) {
    if (!body || body.customization_levels === undefined) return null;
    return normalizeCustomizationLevels(body.customization_levels);
}

/** 原型訂製程度驗證（至少一項；圖文互斥由前端 UI 保證，後端僅正規化舊資料） */
function validatePrototypeCustomizationLevels(raw) {
    const levels = sanitizeCustomizationLevelsForStorage(raw);
    if (!levels.length) {
        return { error: '請至少選擇一項訂製程度' };
    }
    return { levels: levels };
}

/** @param {unknown} raw @param {{ required?: boolean }} [opts] */
function parseVendorAssetPrototypeMoq(raw, opts) {
    const required = opts && opts.required;
    const s = raw === undefined || raw === null ? '' : String(raw).trim();
    if (!s) {
        if (required) return { error: '請填寫最小訂購量（件）' };
        return { value: null };
    }
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 1) {
        return { error: '最小訂購量須為 1 以上的整數' };
    }
    return { value: n };
}

function vendorCustomizationLevelLabel(levelKey, lang) {
    const langStr = (lang != null && typeof lang === 'string') ? lang : '';
    const isEn = langStr && langStr.toLowerCase().indexOf('zh') !== 0;
    const map = {
        mono_graphic: isEn ? 'Mono surface graphics' : '單色表面圖文',
        color_graphic: isEn ? 'Multi-color surface graphics' : '彩色表面圖文',
        color_material: isEn ? 'Body color / material' : '主體顏色／材質',
        size_part: isEn ? 'Size / parts' : '尺寸／零件',
        form_structure: isEn ? 'Form / structure' : '造型／結構'
    };
    return map[levelKey] || levelKey || '';
}

function vendorAssetCustomizationLevelLabels(levels, lang) {
    return normalizeCustomizationLevels(levels).map(function (k) {
        return { key: k, label: vendorCustomizationLevelLabel(k, lang) };
    });
}

/** 未勾選或互斥未選：製造限制句（併入 FLUX 同一個 prompt，非獨立 negative_prompt） */
function vendorCustomizationLevelConstraintRule(levelKey, lang) {
    const isEn = lang && String(lang).toLowerCase().indexOf('zh') !== 0;
    const map = {
        color_material: isEn
            ? 'Do not change the product body color, fabric/material hue, texture, or surface finish from the reference.'
            : '勿變更產品主體顏色、布料／材質色相、質感或表面處理（維持參考原型）。',
        mono_graphic: isEn
            ? 'Do not add engraving, embroidery, print, or other applied surface graphics on the product.'
            : '勿在產品表面添加雕刻、刺繡、印花等圖文。',
        color_graphic: isEn
            ? 'Do not use full-color printing, multi-color stickers/decals, or multi-color surface graphics.'
            : '不要使用任何彩色印刷、多色貼紙或彩色圖形。',
        size_part: isEn
            ? 'Keep all physical dimensions, zippers, hardware, trims, and stitch positions exactly as in the reference—no scaling or part changes.'
            : '嚴格保持產品的所有物理尺寸、拉鍊、扣環、金屬零件與縫線位置完全不變。',
        form_structure: isEn
            ? 'Do not modify the product overall geometry, outer silhouette, or physical structure.'
            : '不允許修改產品的整體幾何形狀、輪廓外觀或物理結構。'
    };
    return map[levelKey] || '';
}

/** 未勾選（及圖文互斥未選）之製造限制句，供 append 至同一 fullPrompt */
function buildCustomizationPromptLinesForLevels(levelKeys, lang) {
    const levelSet = new Set(sanitizeCustomizationLevelsForStorage(levelKeys));
    const constraints = [];
    const hasMono = levelSet.has('mono_graphic');
    const hasColor = levelSet.has('color_graphic');

    VENDOR_CUSTOMIZATION_SCOPE_KEYS.forEach(function (k) {
        if (levelSet.has(k)) return;
        const line = vendorCustomizationLevelConstraintRule(k, lang);
        if (line) constraints.push('• ' + line);
    });

    if (!hasMono && !hasColor) {
        ['mono_graphic', 'color_graphic'].forEach(function (k) {
            const line = vendorCustomizationLevelConstraintRule(k, lang);
            if (line) constraints.push('• ' + line);
        });
    } else if (hasMono && !hasColor) {
        const line = vendorCustomizationLevelConstraintRule('color_graphic', lang);
        if (line) constraints.push('• ' + line);
    }

    return constraints;
}

/** 依參考原型組裝製造限制段落，append 至 fullPrompt（BFL 僅單一 prompt 欄位，無 negative_prompt） */
function buildPrototypeCustomizationPromptAppendix(prototypeAssets, lang) {
    const assets = Array.isArray(prototypeAssets) ? prototypeAssets : [];
    if (!assets.length) return '';
    const isEn = lang && String(lang).toLowerCase().indexOf('zh') !== 0;
    const header = isEn
        ? '\n\n[Manufacturing constraints — same single prompt as above; FLUX has no separate negative prompt field]\n'
        + 'Follow the user product description first. Include these constraint sentences in this same prompt. They describe what this prototype cannot manufacture (unchecked capabilities):\n'
        : '\n\n【製造限制 — 與上文同一組提示詞；FLUX 無獨立負向提示詞欄位】\n'
        + '請優先依前文使用者產品描述創作。以下限制句皆寫在同一組 prompt 內，說明此原型未支援的訂製程度：\n';
    const lines = [];
    assets.forEach(function (asset, idx) {
        const title = (asset.title || '').trim();
        const levelKeys = sanitizeCustomizationLevelsForStorage(asset.customization_levels);
        if (!levelKeys.length) return;
        const label = title || (isEn ? ('Prototype ' + (idx + 1)) : ('參考原型 ' + (idx + 1)));
        const levelNames = levelKeys.map(function (k) { return vendorCustomizationLevelLabel(k, lang); }).join(isEn ? ', ' : '、');
        lines.push(isEn ? ('Reference: ' + label + ' (supports: ' + levelNames + ')') : ('參考原型「' + label + '」支援：' + levelNames));
        buildCustomizationPromptLinesForLevels(levelKeys, lang).forEach(function (line) { lines.push(line); });
        if (asset.min_order_quantity != null && Number(asset.min_order_quantity) >= 1) {
            const moqLine = isEn
                ? ('Minimum order quantity for this prototype: ' + asset.min_order_quantity + ' units (for manufacturing context; do not depict MOQ in the image).')
                : ('此原型最小訂購量：' + asset.min_order_quantity + ' 件（製造背景資訊，勿在圖中標示 MOQ）。');
            lines.push('• ' + moqLine);
        }
    });
    if (!lines.length) return '';
    if (assets.length > 1) {
        const crossGraphicTier = intersectGraphicCustomizationTier(assets);
        const hasColorCapable = assets.some(function (a) {
            return graphicCustomizationTier(a.customization_levels) >= 2;
        });
        if (crossGraphicTier === 1 && hasColorCapable) {
            lines.push(isEn
                ? '• Multiple prototypes: do not use multi-color surface graphics (strictest reference is monochrome-only).'
                : '• 多原型並用：不得使用全彩表面圖文（以最嚴之單色原型為準）。');
        }
    }
    const footer = isEn
        ? 'Obey all restrictions above while fulfilling the user design. When prototypes conflict, use the strictest limit.'
        : '在實現使用者設計的前提下遵守以上限制；多原型衝突時採最嚴限制。';
    return header + lines.join('\n') + '\n' + footer;
}

/** 從 reference_sources 解析數位原型訂製程度（以 DB 為準補齊） */
async function resolvePrototypeAssetsForPrompt(referenceSourcesRaw) {
    const list = Array.isArray(referenceSourcesRaw) ? referenceSourcesRaw : [];
    const byAssetId = new Map();
    list.forEach(function (s) {
        if (!s || !s.vendor_asset_id) return;
        const kind = normalizeVendorAssetKind(s.asset_kind || 'prototype');
        if (kind !== 'prototype') return;
        const id = String(s.vendor_asset_id).trim();
        if (!id) return;
        if (!byAssetId.has(id)) {
            byAssetId.set(id, {
                id: id,
                title: (s.title || '').trim() || null,
                customization_levels: [],
                min_order_quantity: null
            });
        }
        const entry = byAssetId.get(id);
        if (s.title && String(s.title).trim()) entry.title = String(s.title).trim();
        const fromClient = normalizeCustomizationLevels(s.customization_levels);
        if (fromClient.length) entry.customization_levels = fromClient;
        if (s.min_order_quantity != null && Number.isFinite(Number(s.min_order_quantity)) && Number(s.min_order_quantity) >= 1) {
            entry.min_order_quantity = Number(s.min_order_quantity);
        }
    });
    const ids = [...byAssetId.keys()];
    if (!ids.length) return [];
    const needDb = ids.filter(function (id) {
        const e = byAssetId.get(id);
        return !e.customization_levels || !e.customization_levels.length;
    });
    if (needDb.length) {
        const { data: rows, error } = await supabase
            .from('vendor_assets')
            .select('id, title, asset_kind, customization_levels, min_order_quantity')
            .in('id', needDb);
        if (!error && rows) {
            rows.forEach(function (row) {
                if (!row || !row.id || normalizeVendorAssetKind(row.asset_kind) !== 'prototype') return;
                const e = byAssetId.get(row.id);
                if (!e) return;
                if (!e.title && row.title) e.title = row.title;
                e.customization_levels = sanitizeCustomizationLevelsForStorage(row.customization_levels);
                if (e.min_order_quantity == null && row.min_order_quantity != null && Number(row.min_order_quantity) >= 1) {
                    e.min_order_quantity = Number(row.min_order_quantity);
                }
            });
        }
    }
    return ids.map(function (id) { return byAssetId.get(id); }).filter(function (e) {
        return e && e.customization_levels && e.customization_levels.length;
    });
}

/** 從圖片 URL 取出檔名（不含副檔名），供可選語意線索；不作為唯一判斷依據 */
function extractImageUrlBasename(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
        const u = new URL(raw, 'https://placeholder.local');
        const seg = decodeURIComponent((u.pathname || '').split('/').filter(Boolean).pop() || '');
        return seg.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').trim();
    } catch (_) {
        const fallback = raw.split('?')[0].split('/').filter(Boolean).pop() || '';
        return fallback.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').trim();
    }
}

/** 依檔名／標題／material_key 推斷可選材質線索（軟提示，非強制） */
function inferOptionalMaterialContextHints(basename, title, materialKey, lang) {
    const isEn = lang && String(lang).toLowerCase().indexOf('zh') !== 0;
    const combined = [basename, title, materialKey].filter(Boolean).join(' ').toLowerCase();
    if (!combined.trim()) return [];
    const hints = [];
    const push = function (line) { if (line && hints.indexOf(line) < 0) hints.push(line); };

    if (/macro|close[\s-]?up|closeup|微距|特寫|細部/.test(combined)) {
        push(isEn
            ? 'Optional hint (filename/title, not authoritative): swatch may be macro close-up—use finer grain on the product, avoid oversized repeating texture.'
            : '可選線索（檔名／標題，非唯一依據）：樣板可能為微距特寫，成品紋路宜較細、勿放大成粗大重複紋。');
    }
    if (/swatch|sample|tile|樣板|色卡|布樣/.test(combined)) {
        push(isEn
            ? 'Optional hint: flat material swatch—borrow color and surface character only; do not paste the swatch rectangle into the scene.'
            : '可選線索：平面材質樣板—僅參考色彩與表面質感，勿將樣板矩形貼入畫面。');
    }
    const mk = normalizeVendorMaterialKey(materialKey);
    if (mk) return hints;
    if (/wood|oak|walnut|teak|birch|木纹|木紋|胡桃|橡木|木材|實木/.test(combined)) {
        push(isEn
            ? 'Optional hint (filename/title): possible wood—grain scale should suit the product size.'
            : '可選線索（檔名／標題）：可能為木材—紋路粗細宜符合成品尺寸。');
    }
    if (/metal|brass|steel|aluminum|copper|chrome|金屬|銅|不鏽|鋁|黃銅/.test(combined)) {
        push(isEn
            ? 'Optional hint (filename/title): possible metal—keep brush/patina scale realistic for object size.'
            : '可選線索（檔名／標題）：可能為金屬—拉絲／氧化紋理尺度宜符合物件。');
    }
    if (/leather|suede|nubuck|皮革|牛皮|羊皮/.test(combined)) {
        push(isEn
            ? 'Optional hint (filename/title): possible leather—pore/crease scale should match the product.'
            : '可選線索（檔名／標題）：可能為皮革—毛孔／皺褶尺度宜符合產品。');
    }
    if (/fabric|linen|cotton|denim|silk|wool|tweed|布|丹寧|棉|麻|織/.test(combined)) {
        push(isEn
            ? 'Optional hint (filename/title): possible fabric—weave repeat should suit garment or bag scale.'
            : '可選線索（檔名／標題）：可能為布料—織紋重複尺度宜符合服飾或包袋。');
    }
    return hints;
}

function materialTextureScaleRuleForKey(materialKey, lang) {
    const isEn = lang && String(lang).toLowerCase().indexOf('zh') !== 0;
    const mk = normalizeVendorMaterialKey(materialKey);
    const map = {
        wood: isEn ? 'Apply wood tone and grain direction with product-appropriate grain density.' : '套用木色與紋理方向，紋路密度須符合成品大小。',
        metal: isEn ? 'Apply metal color, reflectivity, and micro-texture at object-appropriate scale.' : '套用金屬色、反光與微紋理，尺度須符合物件。',
        leather: isEn ? 'Apply leather color and natural pore/crease texture at object-appropriate scale.' : '套用皮革色與自然毛孔／皺褶，尺度須符合物件。',
        fabric: isEn ? 'Apply fabric color and weave/knit at garment- or product-appropriate repeat scale.' : '套用布料色與織紋／針織，重複尺度須符合服飾或產品。',
        plastic: isEn ? 'Apply plastic hue and subtle surface texture suitable for the part size.' : '套用塑料色與適當細部表面紋理。',
        ceramic: isEn ? 'Apply ceramic color and glaze character at realistic object scale.' : '套用陶瓷色與釉面質感，尺度須符合物件。',
        other: isEn ? 'Apply surface color and texture character with realistic scale for the depicted product.' : '套用表面色彩與質感特徵，尺度須符合畫中產品。'
    };
    return map[mk] || map.other;
}

/** 依 reference_sources 順序對齊參考圖，解析材料參考（含 refIndex = 第幾張 input_image） */
async function resolveMaterialRefsForPrompt(referenceSourcesRaw) {
    const list = Array.isArray(referenceSourcesRaw) ? referenceSourcesRaw : [];
    const refs = [];
    const byAssetId = new Map();
    list.forEach(function (s, idx) {
        if (!s) return;
        const kind = normalizeVendorAssetKind(s.asset_kind || 'prototype');
        if (kind !== 'material') return;
        const refIndex = idx + 1;
        const id = s.vendor_asset_id ? String(s.vendor_asset_id).trim() : '';
        const imageUrl = (s.image_url || '').trim() || null;
        const basename = extractImageUrlBasename(imageUrl);
        const entry = {
            refIndex: refIndex,
            vendor_asset_id: id || null,
            title: (s.title || '').trim() || null,
            catalog_group_names: Array.isArray(s.catalog_group_names)
                ? s.catalog_group_names.map((n) => String(n).trim()).filter(Boolean)
                : [],
            image_url: imageUrl,
            filename_hint: basename || null
        };
        refs.push(entry);
        if (id && !byAssetId.has(id)) byAssetId.set(id, entry);
    });
    if (!refs.length) return [];
    const needDb = [...byAssetId.keys()].filter(function (id) {
        const e = byAssetId.get(id);
        return e && (!e.title || !e.catalog_group_names.length);
    });
    if (needDb.length) {
        const { data: rows, error } = await supabase
            .from('vendor_assets')
            .select('id, title, asset_kind, image_url')
            .in('id', needDb);
        if (!error && rows) {
            const enriched = await attachCatalogGroupIdsToAssets(rows);
            enriched.forEach(function (row) {
                if (!row || !row.id || normalizeVendorAssetKind(row.asset_kind) !== 'material') return;
                const e = byAssetId.get(row.id);
                if (!e) return;
                if (!e.title && row.title) e.title = String(row.title).trim();
                if (!e.catalog_group_names.length && row.catalog_groups && row.catalog_groups.length) {
                    e.catalog_group_names = row.catalog_groups.map((g) => String(g.name || '').trim()).filter(Boolean);
                }
                if (!e.filename_hint && row.image_url) {
                    e.filename_hint = extractImageUrlBasename(row.image_url) || e.filename_hint;
                }
            });
        }
    }
    refs.forEach(function (e) {
        if (!e.filename_hint && e.image_url) e.filename_hint = extractImageUrlBasename(e.image_url);
    });
    return refs;
}

/** 材料參考附錄：紋理尺度與用途（併入同一 fullPrompt） */
function buildMaterialTexturePromptAppendix(materialRefs, lang) {
    const refs = Array.isArray(materialRefs) ? materialRefs : [];
    if (!refs.length) return '';
    const isEn = lang && String(lang).toLowerCase().indexOf('zh') !== 0;
    const header = isEn
        ? '\n\n[Material texture references — same single prompt as above]\n'
        + 'Some reference images are material swatches (not product prototypes). Follow the user description first. Rules:\n'
        + '• Material images are for surface color, texture, weave, grain, and finish only—not for product shape or silhouette.\n'
        + '• Do not paste or tile the swatch as a flat overlay preserving the swatch aspect ratio; integrate texture onto the product with realistic scale.\n'
        + '• Prototype references (if any) define geometry; material references define body/fabric/metal/wood surface only.\n'
        : '\n\n【材質紋理參考 — 與上文同一組提示詞】\n'
        + '部分參考圖為材質樣板（非數位原型）。請優先依前文使用者描述創作。規則：\n'
        + '• 材質圖僅供表面色彩、紋理、織法、木紋／金屬質感與塗層參考，不得決定產品造型或輪廓。\n'
        + '• 勿將樣板整張依其長寬比平鋪貼上；應以符合成品大小的合理紋路尺度整合到產品表面。\n'
        + '• 若有原型參考，造型以原型為準；材質圖僅影響本體／布料／金屬／木材等表面。\n';
    const lines = [];
    refs.forEach(function (ref, idx) {
        const n = ref.refIndex != null ? ref.refIndex : (idx + 1);
        const title = (ref.title || '').trim();
        const label = title || (isEn ? ('Material swatch ' + (idx + 1)) : ('材質樣板 ' + (idx + 1)));
        const catNames = (ref.catalog_group_names || []).filter(Boolean).join(isEn ? ', ' : '、');
        const matLabel = catNames || null;
        const head = isEn
            ? ('Reference image #' + n + ': "' + label + '"' + (matLabel ? (' (vendor category: ' + matLabel + ')') : '') + ' — texture/color reference only.')
            : ('參考圖第 ' + n + ' 張：「' + label + '」' + (matLabel ? ('（自訂分類：' + matLabel + '）') : '') + ' — 僅作表面紋理／色彩參考。');
        lines.push('• ' + head);
        const rule = materialTextureScaleRuleForKey(null, lang);
        if (rule) lines.push('  ◦ ' + rule);
        const optionalHints = inferOptionalMaterialContextHints(
            ref.filename_hint || '',
            ref.title || '',
            catNames,
            lang
        );
        optionalHints.forEach(function (h) { lines.push('  ◦ ' + h); });
    });
    const footer = isEn
        ? 'Filename/title hints above are optional context only—not mandatory rules. Fulfill the user design with believable material scale on the final product.'
        : '以上檔名／標題線索僅供參考，非強制規則。請在成品上呈現合理、可信的材質紋路尺度。';
    return header + lines.join('\n') + '\n' + footer;
}

/** 參考圖順序：數位原型（造型）→ 材料樣板 → 其他；確保 input_image 為主體造型 */
function reorderFluxReferenceInputs(referenceImages, referenceSources) {
    const imgs = Array.isArray(referenceImages) ? referenceImages : [];
    const srcs = Array.isArray(referenceSources) ? referenceSources : [];
    const pairs = imgs.map(function (img, i) {
        return { img: img, src: srcs[i] || null };
    });
    const rank = function (src) {
        const kind = normalizeVendorAssetKind(src && src.asset_kind);
        if (kind === 'prototype') return 0;
        if (kind === 'part') return 1;
        if (kind === 'material') return 2;
        return 3;
    };
    pairs.sort(function (a, b) { return rank(a.src) - rank(b.src); });
    return {
        images: pairs.map(function (p) { return p.img; }),
        sources: pairs.map(function (p) { return p.src; })
    };
}

function vendorAssetMatchesMoqFilter(row, moqN) {
    if (!moqN) return true;
    if (normalizeVendorAssetKind(row.asset_kind) !== 'prototype') return false;
    const moq = row.min_order_quantity;
    if (moq == null || !Number.isFinite(Number(moq))) return false;
    return Number(moq) === moqN;
}

function vendorAssetMatchesCustomizationFilter(row, filterKeys) {
    if (!filterKeys || !filterKeys.length) return true;
    if (normalizeVendorAssetKind(row.asset_kind) !== 'prototype') return false;
    const levels = normalizeCustomizationLevels(row.customization_levels);
    if (!levels.length) return false;
    return filterKeys.some(function (k) { return assetSupportsCustomizationLevel(levels, k); });
}

function enrichVendorAssetPrototypeFields(row, lang) {
    const kind = normalizeVendorAssetKind(row.asset_kind);
    const moq = (kind === 'prototype' && row.min_order_quantity != null && Number.isFinite(Number(row.min_order_quantity)))
        ? Number(row.min_order_quantity) : null;
    const levels = kind === 'prototype' ? sanitizeCustomizationLevelsForStorage(row.customization_levels) : [];
    const levelLabels = vendorAssetCustomizationLevelLabels(levels, lang);
    return {
        min_order_quantity: moq,
        customization_levels: levels,
        customization_level_labels: levelLabels.map(function (x) { return x.label; })
    };
}

function resolveVendorAssetApiLang(req) {
    const q = (req && req.query && req.query.lang) ? String(req.query.lang).trim() : '';
    if (q) return q;
    const accept = (req.headers['accept-language'] || '').split(',')[0].trim();
    return accept || 'zh-TW';
}

function resolveUiLocaleFromRequest(req) {
    const body = (req && req.body) || {};
    const fromBody = (body.ui_locale || body.lang || '').trim();
    if (fromBody) return fromBody;
    return resolveVendorAssetApiLang(req);
}

async function lookupAiSubcategoryName(categoryKey, subcategoryKey) {
    if (!categoryKey || !subcategoryKey) return null;
    try {
        const { data } = await supabase
            .from('ai_subcategories')
            .select('name')
            .eq('category_key', categoryKey)
            .eq('key', subcategoryKey)
            .maybeSingle();
        return (data && data.name) ? String(data.name).trim() : null;
    } catch (_) {
        return null;
    }
}

function autoVendorAssetTitleFromSemantics(semanticsJson, assetKind, locale, hints) {
    if (!semanticsJson) return null;
    const kind = normalizeVendorAssetKind(assetKind);
    if (kind !== 'material' && kind !== 'prototype') return null;
    return visualSemantics.buildVendorAssetTitleFromSemantics(semanticsJson, kind, {
        locale: locale || 'zh-TW',
        subcategoryName: hints && hints.subcategoryName,
        materialCatalogHint: hints && hints.materialCatalogHint
    });
}

function mapVendorAssetForApi(row, lang) {
    if (!row) return row;
    const kind = normalizeVendorAssetKind(row.asset_kind);
    const gallery = kind === 'prototype' ? parseGalleryImages(row.gallery_images) : [];
    const imageUrls = kind === 'prototype' ? getVendorAssetAllImageUrls({ ...row, gallery_images: gallery }) : (row.image_url ? [row.image_url] : []);
    return {
        ...row,
        asset_kind: kind,
        gallery_images: gallery,
        image_urls: imageUrls,
        image_count: imageUrls.length,
        ...enrichVendorAssetPrototypeFields(row, lang)
    };
}

async function uploadVendorAssetGalleryFiles(manufacturerId, files, startSortOrder) {
    const entries = [];
    const list = Array.isArray(files) ? files : [];
    for (let i = 0; i < list.length; i++) {
        const normalized = await vendorAssetFileFromMulter(list[i]);
        if (!normalized) continue;
        const { publicUrl } = await uploadToSupabaseStorage('custom-products', `vendor-assets/${manufacturerId}`, normalized);
        entries.push({ url: publicUrl, sort_order: startSortOrder + i });
    }
    return entries;
}

function vendorAssetMatchesSearch(row, mfr, searchQ) {
    if (!searchQ) return true;
    const q = String(searchQ).trim().toLowerCase();
    if (!q) return true;
    const title = (row.title || '').toLowerCase();
    const desc = (row.description || '').toLowerCase();
    const tags = Array.isArray(row.ai_tags) ? row.ai_tags.join(' ').toLowerCase() : '';
    const mfrName = (mfr && mfr.name) ? String(mfr.name).toLowerCase() : '';
    const sem = row.image_semantics_json;
    let semText = '';
    if (sem && typeof sem === 'object') {
        const parts = []
            .concat(sem.tags || [], sem.style_keywords || [], sem.materials || [], sem.colors || [], sem.structure || [])
            .map(String);
        semText = parts.join(' ').toLowerCase();
    }
    return title.includes(q) || desc.includes(q) || tags.includes(q) || mfrName.includes(q) || semText.includes(q);
}

const VENDOR_STYLE_KEYS = new Set(['silhouette', 'accessories', 'furniture', 'bags', 'shoes', 'other']);
const VENDOR_MATERIAL_KEYS = new Set(['fabric', 'leather', 'metal', 'wood', 'plastic', 'ceramic', 'other']);
const VENDOR_COLOR_KEYS = new Set([
    'white', 'black', 'gray', 'red', 'blue', 'green', 'brown', 'beige',
    'yellow', 'orange', 'purple', 'pink', 'gold', 'silver', 'multi', 'other'
]);

const VENDOR_COLOR_ALIASES = {
    white: ['白', 'white', 'off-white', '米白', '象牙', '乳白'],
    black: ['黑', 'black'],
    gray: ['灰', 'gray', 'grey', '銀灰'],
    red: ['紅', 'red', '酒紅', '玫紅'],
    blue: ['藍', 'blue', 'navy', '藏青'],
    green: ['綠', 'green', '墨綠'],
    brown: ['棕', '褐', 'brown', '咖啡', '焦糖'],
    beige: ['米', 'beige', '杏', '駝'],
    yellow: ['黃', 'yellow'],
    orange: ['橙', '橘', 'orange'],
    purple: ['紫', 'purple'],
    pink: ['粉', 'pink', '玫瑰'],
    gold: ['金', 'gold'],
    silver: ['銀', 'silver'],
    multi: ['多色', '撞色', 'multi', 'color block', 'colorblock']
};

function normalizeVendorStyleKey(raw) {
    const k = String(raw || '').trim().toLowerCase();
    return VENDOR_STYLE_KEYS.has(k) ? k : null;
}

function normalizeVendorMaterialKey(raw) {
    const k = String(raw || '').trim().toLowerCase();
    return VENDOR_MATERIAL_KEYS.has(k) ? k : null;
}

/** 廠商自訂分類：prototype | material | part（NULL 視同 prototype） */
function vendorCatalogGroupRowAssetKind(row) {
    if (!row || row.asset_kind == null || String(row.asset_kind).trim() === '') return 'prototype';
    return normalizeVendorAssetKind(row.asset_kind);
}

function matchColorKeyFromText(text) {
    const t = String(text || '').trim().toLowerCase();
    if (!t) return null;
    for (const [key, aliases] of Object.entries(VENDOR_COLOR_ALIASES)) {
        if (aliases.some((a) => t.includes(String(a).toLowerCase()))) return key;
    }
    if (VENDOR_COLOR_KEYS.has(t)) return t;
    return null;
}

function normalizeVendorColorKey(raw, semanticsJson) {
    const k = String(raw || '').trim().toLowerCase();
    if (VENDOR_COLOR_KEYS.has(k)) return k;
    return deriveColorKeyFromSemantics(semanticsJson);
}

function deriveColorKeyFromSemantics(semanticsJson) {
    const sem = semanticsJson && typeof semanticsJson === 'object' ? semanticsJson : null;
    const colors = sem && Array.isArray(sem.colors) ? sem.colors : [];
    for (const c of colors) {
        const key = matchColorKeyFromText(c);
        if (key) return key;
    }
    return null;
}

function vendorStyleKeyLabel(styleKey, lang) {
    const isEn = lang && String(lang).toLowerCase().indexOf('zh') !== 0;
    const map = {
        silhouette: isEn ? 'Apparel silhouette' : '服裝輪廓',
        accessories: isEn ? 'Accessories' : '配件',
        furniture: isEn ? 'Furniture' : '家具',
        bags: isEn ? 'Bags' : '包袋',
        shoes: isEn ? 'Footwear' : '鞋類',
        other: isEn ? 'Other style' : '其他造型'
    };
    return map[styleKey] || styleKey || '';
}

function vendorMaterialKeyLabel(materialKey, lang) {
    const isEn = lang && String(lang).toLowerCase().indexOf('zh') !== 0;
    const map = {
        fabric: isEn ? 'Fabric' : '布料',
        leather: isEn ? 'Leather' : '皮革',
        metal: isEn ? 'Metal' : '金屬',
        wood: isEn ? 'Wood' : '木材',
        plastic: isEn ? 'Plastic' : '塑料',
        ceramic: isEn ? 'Ceramic' : '陶瓷',
        other: isEn ? 'Other material' : '其他材質'
    };
    return map[materialKey] || materialKey || '';
}

function vendorColorKeyLabel(colorKey, lang) {
    const isEn = lang && String(lang).toLowerCase().indexOf('zh') !== 0;
    const map = {
        white: isEn ? 'White' : '白',
        black: isEn ? 'Black' : '黑',
        gray: isEn ? 'Gray' : '灰',
        red: isEn ? 'Red' : '紅',
        blue: isEn ? 'Blue' : '藍',
        green: isEn ? 'Green' : '綠',
        brown: isEn ? 'Brown' : '棕',
        beige: isEn ? 'Beige' : '米／杏',
        yellow: isEn ? 'Yellow' : '黃',
        orange: isEn ? 'Orange' : '橙',
        purple: isEn ? 'Purple' : '紫',
        pink: isEn ? 'Pink' : '粉',
        gold: isEn ? 'Gold' : '金',
        silver: isEn ? 'Silver' : '銀',
        multi: isEn ? 'Multi-color' : '多色',
        other: isEn ? 'Other color' : '其他色'
    };
    return map[colorKey] || colorKey || '';
}

function vendorAssetMatchesColor(row, colorQ) {
    if (!colorQ) return true;
    const q = String(colorQ).trim().toLowerCase();
    if (!q) return true;
    const ck = row.color_key ? String(row.color_key).toLowerCase() : '';
    if (ck && (ck === q || ck.includes(q))) return true;
    const sem = row.image_semantics_json;
    if (sem && Array.isArray(sem.colors)) {
        if (sem.colors.some((c) => String(c).toLowerCase().includes(q))) return true;
        if (sem.colors.some((c) => matchColorKeyFromText(c) === q)) return true;
    }
    if (Array.isArray(row.ai_tags)) {
        if (row.ai_tags.some((t) => String(t).toLowerCase().includes(q))) return true;
    }
    return false;
}

function manufacturerNameMatches(mfr, nameQ) {
    if (!nameQ || !mfr) return !nameQ;
    const n = String(mfr.name || '').toLowerCase();
    return n.includes(String(nameQ).trim().toLowerCase());
}

function manufacturerMatchesServiceArea(mfr, areaCode) {
    if (!areaCode || !mfr) return !areaCode;
    const code = String(areaCode).trim().toLowerCase();
    const contact = mfr.contact_json && typeof mfr.contact_json === 'object' ? mfr.contact_json : {};
    let areas = contact.service_area;
    if (!areas && mfr.location) areas = [mfr.location];
    if (!areas) return false;
    if (typeof areas === 'string') {
        areas = areas.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(areas)) return false;
    return areas.some((a) => {
        const s = String(a).trim().toLowerCase();
        return s === code || s.includes(code) || code.includes(s);
    });
}

const VENDOR_ASSET_SELECT_ME = 'id, manufacturer_id, category_key, subcategory_key, title, description, image_url, gallery_images, usage_type, is_public, sort_order, style_key, material_key, color_key, asset_kind, part_key, source_catalog_item_id, ai_tags, image_semantics_json, tags_source, min_order_quantity, customization_levels, created_at, updated_at';
const VENDOR_ASSET_SELECT_ME_LEGACY = 'id, manufacturer_id, category_key, subcategory_key, title, description, image_url, usage_type, is_public, sort_order, style_key, material_key, ai_tags, image_semantics_json, tags_source, created_at, updated_at';

/** 依廠商 id + 素材 id 查一筆；缺欄位時自動降級（與 GET 列表一致，避免 DELETE 誤判 404） */
async function fetchVendorAssetOwnedByManufacturer(assetId, manufacturerId, selectCols) {
    const id = String(assetId || '').trim();
    if (!id || !manufacturerId) return { data: null, error: null };
    let cols = selectCols || 'id, manufacturer_id, source_catalog_item_id';
    async function query(columns) {
        return supabase.from('vendor_assets').select(columns).eq('id', id).eq('manufacturer_id', manufacturerId).maybeSingle();
    }
    let result = await query(cols);
    if (result.error && result.error.code === '42703') {
        const legacyCols = cols.split(',').map((c) => c.trim()).filter((c) => c && c !== 'source_catalog_item_id').join(', ');
        cols = legacyCols || 'id, manufacturer_id';
        result = await query(cols);
        if (result.data && result.data.source_catalog_item_id === undefined) result.data.source_catalog_item_id = null;
    }
    if (result.error) return result;
    return result;
}

let _supplierCatalogReadyCache = { at: 0, value: false };

async function supplierCatalogTablesReady() {
    const now = Date.now();
    if (now - _supplierCatalogReadyCache.at < 120000) return _supplierCatalogReadyCache.value;
    const { error } = await supabase.from('supplier_catalog_items').select('id').limit(1);
    const ready = !error || error.code !== '42P01';
    _supplierCatalogReadyCache = { at: now, value: ready };
    return ready;
}

function portfolioRowIsEnabled(p, nowIso) {
    if (p.show_on_media_wall === false) return false;
    const seriesExpired = p.series_image_valid_until && p.series_image_valid_until < nowIso;
    const hasSeries = !seriesExpired && Array.isArray(p.series_image_urls) && p.series_image_urls.length > 0;
    return !!(p.image_url || p.image_url_before || hasSeries);
}

/** 廠商資格：至少 1 件「啟用中」作品（公開且仍有可顯示圖，未過期）。 */
async function countEnabledPortfolioWorks(manufacturerId) {
    if (!manufacturerId) return 0;
    const nowIso = new Date().toISOString();
    const { data: items, error } = await supabase
        .from('manufacturer_portfolio')
        .select('id, image_url, image_url_before, series_image_urls, series_image_valid_until, show_on_media_wall')
        .eq('manufacturer_id', manufacturerId)
        .or('show_on_media_wall.is.null,show_on_media_wall.eq.true')
        .limit(40);
    if (error) {
        if (error.code !== '42P01') console.error('countEnabledPortfolioWorks:', error);
        return 0;
    }
    let n = 0;
    for (const p of items || []) {
        if (portfolioRowIsEnabled(p, nowIso)) {
            n += 1;
            if (n >= 1) return n;
        }
    }
    return n;
}

async function hasEnabledPortfolioWork(manufacturerId) {
    return (await countEnabledPortfolioWorks(manufacturerId)) > 0;
}

async function getMeManufacturerB2BAccess(req, res, { requirePortfolio = true } = {}) {
    const user = await getCurrentUser(req, res);
    if (!user) return null;
    const { data: mfr, error: mfrErr } = await supabase
        .from('manufacturers')
        .select('id, vendor_source, is_active')
        .eq('user_id', user.id)
        .maybeSingle();
    if (mfrErr) {
        console.error('getMeManufacturerB2BAccess:', mfrErr);
        res.status(500).json({ error: '查詢失敗' });
        return null;
    }
    if (!mfr) {
        res.status(404).json({ error: '尚未建立廠商資料', code: 'NO_MANUFACTURER' });
        return null;
    }
    if (mfr.is_active === false) {
        res.status(403).json({ error: '廠商資料已停用', code: 'MANUFACTURER_INACTIVE' });
        return null;
    }
    if (requirePortfolio) {
        const staffBypass = await isStaffProfileUserId(user.id);
        if (!staffBypass) {
            const hasWork = await hasEnabledPortfolioWork(mfr.id);
            if (!hasWork) {
                res.status(403).json({
                    error: '請先上傳至少 1 件啟用中（公開）的作品後，才可瀏覽並導入產業供應商材料',
                    code: 'PORTFOLIO_REQUIRED',
                    active_portfolio_count: 0,
                    portfolio_count: 0
                });
                return null;
            }
        }
    }
    return mfr.id;
}

async function getMeIndustrySupplier(req, res, opts = {}) {
    const allowMissing = !!(opts && opts.allowMissing);
    const user = await getCurrentUser(req, res);
    if (!user) return null;
    const { data: supplier, error } = await supabase
        .from('industry_suppliers')
        .select('id, name, description, contact_json, is_active')
        .eq('user_id', user.id)
        .maybeSingle();
    if (error) {
        if (error.code === '42703') {
            res.status(503).json({ error: '請先執行 docs/add-membership-catalog-visibility.sql（industry_suppliers.user_id）' });
            return null;
        }
        console.error('getMeIndustrySupplier:', error);
        res.status(500).json({ error: '查詢失敗' });
        return null;
    }
    if (!supplier) {
        if (!allowMissing) {
            res.status(404).json({
                error: '尚未建立產業供應商公司資料。請至「上架數位產品庫」填寫公司名稱並建立。',
                code: 'NO_SUPPLIER_PROFILE'
            });
        }
        return null;
    }
    if (!supplier.is_active) {
        res.status(403).json({ error: '此產業供應商已停用', code: 'SUPPLIER_INACTIVE' });
        return null;
    }
    return { user, supplier };
}

async function enrichVendorAssetsWithSupplierMeta(manufacturerId, items) {
    if (!items || !items.length) return items || [];
    const ready = await supplierCatalogTablesReady();
    if (!ready) return items;
    const assetIds = items.map((r) => r.id).filter(Boolean);
    const { data: imports } = await supabase
        .from('manufacturer_supplier_imports')
        .select('id, vendor_asset_id, catalog_item_id, snapshot_json')
        .eq('manufacturer_id', manufacturerId)
        .in('vendor_asset_id', assetIds);
    const byAsset = {};
    (imports || []).forEach((row) => {
        if (row.vendor_asset_id) byAsset[row.vendor_asset_id] = row;
    });
    return items.map((row) => {
        const imp = byAsset[row.id];
        if (!imp) return row;
        const snap = imp.snapshot_json && typeof imp.snapshot_json === 'object' ? imp.snapshot_json : {};
        return {
            ...row,
            supplier_import_id: imp.id,
            supplier_name: snap.supplier_name || null,
            from_supplier_catalog: true
        };
    });
}

function parseAiTagsFromBody(body) {
    const raw = body && body.ai_tags;
    if (raw == null || raw === '') return null;
    try {
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(arr)) return null;
        const tags = arr.map((t) => String(t).trim()).filter(Boolean);
        return tags.length ? tags : null;
    } catch (_) {
        return null;
    }
}

function parseTruthyBody(val) {
    if (val === true || val === 1) return true;
    const s = String(val || '').trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

const VENDOR_OPTIMIZE_BACKGROUND_PROMPTS = {
    white: 'clean pure white seamless studio background',
    light_gray: 'clean light gray seamless studio background',
    gray: 'neutral medium gray seamless studio background',
    black: 'deep black seamless studio background with subtle rim lighting on the product edges'
};

/** 廠商 AI 重繪底色：white|light_gray|gray|black 或 #RRGGBB */
function normalizeVendorOptimizeBackground(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s || s === 'white') return { key: 'white', prompt: VENDOR_OPTIMIZE_BACKGROUND_PROMPTS.white };
    if (VENDOR_OPTIMIZE_BACKGROUND_PROMPTS[s]) return { key: s, prompt: VENDOR_OPTIMIZE_BACKGROUND_PROMPTS[s] };
    const hex = s.match(/^#?([0-9a-f]{6})$/i);
    if (hex) {
        const color = `#${hex[1].toLowerCase()}`;
        return {
            key: 'custom',
            prompt: `seamless solid studio background in exact color ${color}, evenly lit, no gradient or texture`
        };
    }
    return { key: 'white', prompt: VENDOR_OPTIMIZE_BACKGROUND_PROMPTS.white };
}

/** 數位原型「產品圖 AI 重繪」：單張商品圖（與設計頁自傳參考圖同類，供 img2img 使用，非四格型錄） */
function buildVendorAssetProductOptimizePrompt(title, backgroundColor) {
    const product = (title || '').trim() || 'product';
    const bg = normalizeVendorOptimizeBackground(backgroundColor);
    return [
        `Professional e-commerce product photo of a single ${product},`,
        'the product is the only subject in frame, centered, full product visible,',
        `${bg.prompt}, soft even studio lighting, no harsh shadows,`,
        'no props, no hands, no people, no packaging clutter, no scene decoration,',
        'no text, no watermark, no logo unless already part of the product design,',
        'photorealistic, sharp focus, accurate colors and proportions, 8k resolution'
    ].join(' ');
}

function vendorAssetOptimizeErrorResponse(optErr, assetKind) {
    const failLabel = normalizeVendorAssetKind(assetKind) === 'material' ? '材質圖 AI 優化失敗' : '產品圖 AI 重繪失敗';
    return { status: 503, body: { error: (optErr && optErr.message) || `${failLabel}，請稍後重試` } };
}

/** 材料 AI 優化：依 material_key 強調該材質應呈現的質感（送 FLUX img2img） */
function materialOptimizeTextureDirective(materialKey) {
    const mk = normalizeVendorMaterialKey(materialKey);
    const map = {
        fabric: [
            'Fabric / textile swatch: weave, knit, or thread structure must read clearly;',
            'show natural fiber texture, yarn direction, and true color;',
            'soft even lighting; flat lay or gentle fold only—no garment shape implied.'
        ].join(' '),
        leather: [
            'Leather swatch: natural grain, pores, and subtle sheen;',
            'accurate tan or dye color; supple surface with realistic crease scale;',
            'macro-friendly detail without plastic-looking smoothness.'
        ].join(' '),
        metal: [
            'Metal surface: brush direction, reflections, and micro-scratches at believable scale;',
            'realistic metallic sheen without blown highlights;',
            'show true alloy tone (brass, steel, aluminum, etc.) from the reference.'
        ].join(' '),
        wood: [
            'Wood swatch: grain lines and ring patterns at product-appropriate macro scale;',
            'warm organic tone and matte or satin finish;',
            'directional grain must stay consistent across the swatch.'
        ].join(' '),
        plastic: [
            'Plastic / polymer swatch: smooth or lightly textured surface;',
            'even color, subtle mold texture or matte/satin finish as in reference;',
            'no fake wood or metal look unless the reference shows it.'
        ].join(' '),
        ceramic: [
            'Ceramic / glaze swatch: glaze depth, subtle surface variation, and body color;',
            'clean matte or gloss ceramic finish; no metallic sparkle unless glazed that way.'
        ].join(' '),
        other: [
            'Material swatch: authentic surface texture and true color clearly readable;',
            'believable macro scale for designers selecting materials.'
        ].join(' ')
    };
    return map[mk] || map.other;
}

/**
 * 材料參考「材質圖 AI 優化」— 色卡／滿版圖樣導向，與產品重繪分線（不用棚拍底色）。
 * 規劃：docs/vendor-asset-material-swatch-plan.md
 */
/** @param {string} catalogHint — 廠商材料自訂分類名稱（逗號串），取代 material_key */
function buildVendorAssetMaterialOptimizePrompt(title, catalogHint) {
    const label = (title || '').trim() || (catalogHint || '').trim() || 'material sample';
    const typeLabel = (catalogHint || '').trim() || 'material';
    const textureLine = materialOptimizeTextureDirective(null);
    return [
        `Enhance this image as a full-frame material swatch / color-card texture (like a Pantone or fabric swatch scan): "${label}" (${typeLabel}).`,
        'The entire frame should read as continuous material surface—preserve the apparent weave, grain, or pore scale from the reference; do not enlarge texture into oversized repeating blocks.',
        'Keep the same color family, pattern orientation, and overall crop; only improve clarity, even lighting, and true color.',
        textureLine,
        'No finished products, no 3D spheres, no props, no hands, no rulers, no text, no watermark, no logo.',
        'If non-material edges exist in the source, trim or fade them minimally—do not replace the swatch with a product photo on white seamless backdrop.',
        'Flat lay or gentle fold only; photorealistic material detail, 8k resolution'
    ].join(' ');
}

async function recordVisualSemanticsEvent(row) {
    try {
        const { error } = await supabase.from('visual_semantics_events').insert(row);
        if (error && error.code !== '42P01') console.warn('recordVisualSemanticsEvent:', error.message);
    } catch (e) {
        console.warn('recordVisualSemanticsEvent:', e.message);
    }
}

/** 設計頁生成圖（custom_products.ai_generated_image_url）→ ai_tags／語意欄位；失敗不拋出 */
async function enrichCustomProductSemantics(productId, ownerId, ctx = {}) {
    const imageUrl = (ctx.imageUrl || '').trim();
    if (!productId || !imageUrl || !process.env.GEMINI_API_KEY) return null;
    try {
        const deps = getVisualSemanticsDeps();
        const imagePart = await visualSemantics.fetchUrlToImagePart(deps.fetch, imageUrl);
        const imgResult = await visualSemantics.analyzeGeneratedImageSemantics(deps, imagePart, {
            generation_prompt: ctx.generationPrompt || null,
            title: ctx.title || null,
            category_key: ctx.categoryKey || null
        });
        let mergedTags = imgResult.tags || [];
        let promptSemantics = null;
        const genPrompt = (ctx.generationPrompt || '').trim();
        if (genPrompt) {
            try {
                const pResult = await visualSemantics.analyzePromptSemantics(deps, genPrompt, {
                    title: ctx.title,
                    category_key: ctx.categoryKey
                });
                promptSemantics = pResult.semantics;
                mergedTags = visualSemantics.mergeTags(mergedTags, pResult.tags);
            } catch (pe) {
                console.warn('enrichCustomProductSemantics prompt:', pe.message);
            }
        }
        const tagsByDim = visualSemantics.buildTagsByDimension(imgResult.semantics);
        const updates = {
            ai_tags: mergedTags,
            image_semantics_json: imgResult.semantics,
            ai_tags_by_dimension: tagsByDim,
            semantics_generated_at: new Date().toISOString()
        };
        if (promptSemantics) updates.prompt_semantics_json = promptSemantics;
        const { error: updErr } = await supabase.from('custom_products').update(updates).eq('id', productId);
        if (updErr) {
            if (updErr.code === '42703') {
                console.warn('enrichCustomProductSemantics: 請執行 docs/add-custom-products-semantics.sql 與 add-custom-products-semantics-taxonomy.sql');
            } else {
                console.warn('enrichCustomProductSemantics update:', updErr.message);
            }
            return null;
        }
        let lineageMeta = null;
        try {
            const { data: prodRow } = await supabase
                .from('custom_products')
                .select('is_vendor_self_serve, has_self_vendor_reference')
                .eq('id', productId)
                .maybeSingle();
            if (prodRow) lineageMeta = { lineage: prodRow };
        } catch (_) {}
        const semanticsForEvent = {
            ...imgResult.semantics,
            ai_tags_by_dimension: tagsByDim,
            ...(lineageMeta || {})
        };
        await recordVisualSemanticsEvent({
            source_type: 'custom_product',
            source_id: productId,
            image_url: imageUrl,
            text_input: genPrompt || null,
            semantics_kind: 'generated_image',
            ai_tags: imgResult.tags,
            semantics_json: semanticsForEvent,
            model: imgResult.model,
            prompt_version: imgResult.prompt_version,
            owner_id: ownerId || null,
            category_key: ctx.categoryKey || null
        });
        if (promptSemantics && genPrompt) {
            await recordVisualSemanticsEvent({
                source_type: 'custom_product',
                source_id: productId,
                image_url: null,
                text_input: genPrompt,
                semantics_kind: 'prompt',
                ai_tags: mergedTags,
                semantics_json: promptSemantics,
                model: imgResult.model,
                prompt_version: visualSemantics.PROMPT_VERSION,
                owner_id: ownerId || null,
                category_key: ctx.categoryKey || null
            });
        }
        console.log('custom_products 語意標籤完成 id=%s tags=%d', productId, mergedTags.length);
        return { ai_tags: mergedTags };
    } catch (e) {
        console.error('enrichCustomProductSemantics:', e.message);
        return null;
    }
}

function finalizeVendorAssetSemantics(semanticsJson, tags, assetKind) {
    if (normalizeVendorAssetKind(assetKind) !== 'material' || !semanticsJson) {
        return { semantics: semanticsJson, tags };
    }
    const semantics = visualSemantics.sanitizeMaterialSemantics(semanticsJson);
    return { semantics, tags: (semantics && semantics.tags) || tags || [] };
}

async function runVendorAssetImageSemantics(file, context, ownerId) {
    const deps = getVisualSemanticsDeps();
    const imagePart = visualSemantics.bufferToImagePart(file.buffer || file, file.mimetype);
    const result = await visualSemantics.analyzeImageSemantics(deps, imagePart, context);
    await recordVisualSemanticsEvent({
        source_type: 'vendor_asset',
        source_id: null,
        image_url: context.image_url || null,
        text_input: null,
        semantics_kind: 'image',
        ai_tags: result.tags,
        semantics_json: result.semantics,
        model: result.model,
        prompt_version: result.prompt_version,
        owner_id: ownerId || null,
        category_key: context.category_key || null
    });
    const description = visualSemantics.buildVendorAssetDescriptionFromSemantics(result.semantics);
    return { ...result, description };
}

function vendorAssetDescriptionFromSemantics(semanticsJson) {
    return visualSemantics.buildVendorAssetDescriptionFromSemantics(semanticsJson) || null;
}

// === 翻譯：送什麼 / 回什麼（就一件事）===
// 送：POST generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=API_KEY
//     body: { contents: [ { parts: [ { text: "把這段翻成英文..." } ] } ] }
// 回：{ candidates: [ { content: { parts: [ { text: "英文結果" } ] } } ] } 或 { error: { code, message } }
// 我們只從回傳裡取出 candidates[0].content.parts[0].text 當翻譯結果。

/** @param {string} instruction @param {string} text */
async function geminiTranslateWithInstruction(instruction, text) {
    const raw = String(text);
    if (!raw.trim()) return '';
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return raw.trim();
    return runInGeminiQueue(async () => {
        const promptText = `${instruction}\n\n${raw}`;
        let model = await getTranslationModelName();
        const modelsToTry = model === 'gemini-2.5-flash-lite' ? ['gemini-2.5-flash-lite', 'gemini-2.5-flash'] : [model];
        for (const m of modelsToTry) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`;
                const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }) });
                const data = await res.json();
                if (data.error) {
                    if (data.error.code === 429 && m === 'gemini-2.5-flash-lite' && modelsToTry.length > 1) {
                        console.warn('Gemini 翻譯 429（gemini-2.5-flash-lite），改用 gemini-2.5-flash 重試');
                        continue;
                    }
                    console.error('Gemini 翻譯錯誤', data.error.code || res.status, data.error.message, 'model=', m);
                    return raw.trim();
                }
                const out = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (out != null && String(out).trim()) return String(out).trim();
                const finishReason = data.candidates?.[0]?.finishReason;
                if (finishReason && finishReason !== 'STOP') console.warn('geminiTranslateWithInstruction 未完成:', finishReason);
            } catch (e) {
                console.error('geminiTranslateWithInstruction:', e.message);
                return raw.trim();
            }
        }
        return raw.trim();
    });
}

async function translatePromptToEnglish(text) {
    if (!text || !String(text).trim()) return '';
    const t = String(text).trim();
    if (process.env.ENABLE_PROMPT_TRANSLATION === 'false' || process.env.ENABLE_PROMPT_TRANSLATION === '0') return t;
    if (!looksLikeNonEnglish(t)) return t;
    return geminiTranslateWithInstruction('Translate to English only, one line, no explanation:', t);
}

/** 送 BFL／FLUX 前：含多段／條列的完整 prompt，保留換行與結構 */
async function translatePromptToEnglishForFlux(text) {
    if (!text || !String(text).trim()) return '';
    const t = String(text);
    if (process.env.ENABLE_PROMPT_TRANSLATION === 'false' || process.env.ENABLE_PROMPT_TRANSLATION === '0') return t.trim();
    if (!looksLikeNonEnglish(t)) return t.trim();
    return geminiTranslateWithInstruction(
        'Translate the following to English for an image generation API. Preserve all line breaks, bullet points, brackets, and section structure. '
        + 'Any text inside straight ASCII double quotes "..." must appear unchanged in the output—do not translate, transliterate, or paraphrase quoted text (e.g. Chinese characters to print on the product). '
        + 'Output only the translation, no explanation:',
        t
    );
}

/** 有 prompt + negativePrompt 時一次送、一次回，只打 1 次 API */
async function translatePromptAndNegativeToEnglish(prompt, negativePrompt) {
    const p = (prompt && String(prompt).trim()) || '';
    const n = (negativePrompt && String(negativePrompt).trim()) || '';
    if (process.env.ENABLE_PROMPT_TRANSLATION === 'false' || process.env.ENABLE_PROMPT_TRANSLATION === '0' || !process.env.GEMINI_API_KEY) return [p, n];
    const needP = p && looksLikeNonEnglish(p);
    const needN = n && looksLikeNonEnglish(n);
    if (!needP && !needN) return [p, n];
    if (!needP) return [p, await translatePromptToEnglish(n)];
    if (!needN) return [await translatePromptToEnglish(p), n];
    return runInGeminiQueue(async () => {
        const promptText = `Translate to English. Output exactly two lines: line1=first, line2=second. No other text.\n\nLine1:\n${p}\n\nLine2:\n${n}`;
        let model = await getTranslationModelName();
        const modelsToTry = model === 'gemini-2.5-flash-lite' ? ['gemini-2.5-flash-lite', 'gemini-2.5-flash'] : [model];
        for (const m of modelsToTry) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
                const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }) });
                const data = await res.json();
                if (data.error) {
                    if (data.error.code === 429 && m === 'gemini-2.5-flash-lite' && modelsToTry.length > 1) {
                        console.warn('Gemini 翻譯 429（gemini-2.5-flash-lite），改用 gemini-2.5-flash 重試');
                        continue;
                    }
                    console.error('Gemini 翻譯錯誤', data.error.code, data.error.message, 'model=', m);
                    return [p, n];
                }
                const out = data.candidates?.[0]?.content?.parts?.[0]?.text;
                const lines = (out != null ? String(out) : '').split(/\n/).map(s => s.trim()).filter(Boolean);
                return [lines[0] || p, lines[1] || n];
            } catch (e) {
                console.error('translatePromptAndNegative:', e.message);
                return [p, n];
            }
        }
        return [p, n];
    });
}

let ecpayConfig;
try { ecpayConfig = require('./config/ecpay-config.js'); } catch (_) { ecpayConfig = null; }

const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:' + (process.env.PORT || 3000));
const ECPAY_TEST_STAGE = 'https://vendor-stage.ecpay.com.tw';
const PAYPAL_DEV_DOC = 'https://developer.paypal.com';

/** 從 DB payment_config 讀取金流設定，與 env 合併（DB 優先） */
async function getPaymentConfig() {
    const out = {
        ecpay: {
            merchantID: process.env.ECPAY_MERCHANT_ID || (ecpayConfig && ecpayConfig.merchantID) || '2000132',
            hashKey: process.env.ECPAY_HASH_KEY || (ecpayConfig && ecpayConfig.hashKey) || '',
            hashIV: process.env.ECPAY_HASH_IV || (ecpayConfig && ecpayConfig.hashIV) || '',
            useProduction: process.env.ECPAY_USE_PRODUCTION === 'true',
            apiURL: (ecpayConfig && ecpayConfig.apiURL) || 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
            notifyURL: (ecpayConfig && ecpayConfig.notifyURL) || `${BASE_URL.replace(/\/$/, '')}/api/payment/notify`
        },
        paypal: {
            clientId: process.env.PAYPAL_CLIENT_ID || '',
            clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
            sandbox: process.env.PAYPAL_SANDBOX !== 'false'
        }
    };
    try {
        const { data: rows } = await supabase.from('payment_config').select('key, value');
        if (rows && rows.length) {
            const m = {};
            rows.forEach(r => { m[r.key] = r.value; });
            if (m.ecpay_merchant_id != null && m.ecpay_merchant_id !== '') out.ecpay.merchantID = m.ecpay_merchant_id;
            if (m.ecpay_hash_key != null && m.ecpay_hash_key !== '') out.ecpay.hashKey = m.ecpay_hash_key;
            if (m.ecpay_hash_iv != null && m.ecpay_hash_iv !== '') out.ecpay.hashIV = m.ecpay_hash_iv;
            if (m.ecpay_use_production != null && m.ecpay_use_production !== '' && m.ecpay_use_production !== '0') out.ecpay.useProduction = true;
            if (out.ecpay.useProduction) {
                out.ecpay.apiURL = 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';
            }
            if (m.paypal_client_id != null && m.paypal_client_id !== '') out.paypal.clientId = m.paypal_client_id;
            if (m.paypal_client_secret != null && m.paypal_client_secret !== '') out.paypal.clientSecret = m.paypal_client_secret;
            if (m.paypal_sandbox != null && m.paypal_sandbox !== '' && m.paypal_sandbox !== '0' && m.paypal_sandbox !== 'false') out.paypal.sandbox = true;
            else if (m.paypal_sandbox === '0' || m.paypal_sandbox === 'false') out.paypal.sandbox = false;
        }
    } catch (e) {
        console.error('getPaymentConfig:', e.message);
    }
    return out;
}

/** Phase 1.6: 上傳單檔至 Supabase Storage，回傳 { path, publicUrl } */
async function uploadToSupabaseStorage(bucket, pathPrefix, file, options = {}) {
    const ext = (options.ext || path.extname(file.originalname || '') || '.jpg').replace(/^\./, '') || 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    const objectPath = pathPrefix ? `${pathPrefix}/${filename}` : filename;
    const buffer = file.buffer || (file instanceof Buffer ? file : Buffer.from(file.data || ''));
    const contentType = options.contentType || file.mimetype || 'image/jpeg';
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(objectPath, buffer, { contentType, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return { path: data.path, publicUrl };
}
const DB_URL = process.env.SUPABASE_DB_URL;
const LOCAL_CATEGORIES_PATH = path.join(__dirname, 'public', 'config', 'ai-categories.local.json');

/** subscription_plans 後台只查／寫這些欄位（多數環境表結構一致，不依賴直連 DB） */
const SUBSCRIPTION_PLANS_SELECT_COLUMNS = 'id, name, price, duration_months, credits_monthly, sort_order, is_active, plan_key';

async function ensureAiCategoriesTableAndSeed() {
    if (!DB_URL) return; // 無 DB 直連就跳過
    const pool = new Pool({ connectionString: DB_URL });
    const client = await pool.connect();
    try {
        await client.query(`
            create table if not exists public.ai_categories (
                key text primary key,
                name text not null,
                prompt text not null default '',
                subcategories jsonb not null default '[]'::jsonb,
                updated_at timestamptz not null default now()
            );
        `);
        const { rows } = await client.query('select count(*)::int as cnt from public.ai_categories;');
        if (rows[0].cnt === 0) {
            const defPath = path.join(__dirname, 'public', 'config', 'default-categories.json');
            if (fs.existsSync(defPath)) {
                const raw = fs.readFileSync(defPath, 'utf-8');
                const json = JSON.parse(raw);
                const list = Array.isArray(json.categories) ? json.categories : [];
                for (const c of list) {
                    await client.query(
                        'insert into public.ai_categories(key, name, prompt, subcategories) values($1, $2, $3, $4) on conflict (key) do update set name=excluded.name, prompt=excluded.prompt, subcategories=excluded.subcategories',
                        [c.key, c.name, c.prompt || '', JSON.stringify(Array.isArray(c.sub) ? c.sub : [])]
                    );
                }
                console.log(`預設分類已匯入 ${list.length} 筆`);
            }
        }
    } catch (e) {
        console.error('初始化 ai_categories 失敗：', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

/**
 * 依客戶數量解析承包商的單價區間（支援階梯定價 price_tiers）
 * @param {object} listing - 含 price_min, price_max, price_tiers
 * @param {number} quantity - 客戶的數量
 * @returns {{ unit_price_min: number, unit_price_max: number }}
 */
function resolveUnitPriceForQuantity(listing, quantity) {
    const q = Number(quantity) || 1;
    const tiers = listing.price_tiers;
    if (tiers && Array.isArray(tiers) && tiers.length > 0) {
        const sorted = [...tiers].sort((a, b) => (Number(a.quantity_min) || 0) - (Number(b.quantity_min) || 0));
        for (const t of sorted) {
            const qMin = Number(t.quantity_min) ?? 0;
            const qMax = t.quantity_max != null ? Number(t.quantity_max) : null;
            if (q >= qMin && (qMax === null || q <= qMax)) {
                return {
                    unit_price_min: Number(t.unit_price_min) || 0,
                    unit_price_max: Number(t.unit_price_max) || 0
                };
            }
        }
        const last = sorted[sorted.length - 1];
        if (last && last.quantity_max == null)
            return { unit_price_min: Number(last.unit_price_min) || 0, unit_price_max: Number(last.unit_price_max) || 0 };
        const first = sorted[0];
        if (first)
            return { unit_price_min: Number(first.unit_price_min) || 0, unit_price_max: Number(first.unit_price_max) || 0 };
    }
    return {
        unit_price_min: listing.price_min != null ? Number(listing.price_min) : 0,
        unit_price_max: listing.price_max != null ? Number(listing.price_max) : 0
    };
}

// ==================== 通用單位對齊邏輯（所有分類共用，不硬編碼：比對僅做 trim + 小寫） ====================
/** 正規化單位字串（供比對用），傳入 null/undefined 回傳 '' */
function normalizeUnit(unit) {
    if (unit == null) return '';
    return String(unit).trim().toLowerCase();
}
/** 兩單位是否視為相同（發包項 vs 專家報價） */
function unitsMatch(unitA, unitB) {
    const a = normalizeUnit(unitA);
    const b = normalizeUnit(unitB);
    if (!a || !b) return false;
    return a === b;
}

// 標籤比對：刪除「通用尾字」後兩邊相同即算相符；清單由後台 /admin/tag-strip.html 管理
const TAG_STRIP_SUFFIXES_DEFAULT = ['工程', '課程', '服務', '設計', '製作', '施工', '安裝', '維修', '經營', '諮詢', '顧問', '行銷', '教學', '規劃', '整合'];
const tagStripSuffixesPath = path.join(__dirname, 'config', 'tag-strip-suffixes.json');
let _tagStripSuffixesCache = null;
function getTagStripSuffixes() {
    if (_tagStripSuffixesCache) return _tagStripSuffixesCache;
    try {
        if (fs.existsSync(tagStripSuffixesPath)) {
            const raw = fs.readFileSync(tagStripSuffixesPath, 'utf8');
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
                _tagStripSuffixesCache = arr.filter(w => typeof w === 'string' && w.trim());
                return _tagStripSuffixesCache;
            }
        }
    } catch (e) {
        console.warn('讀取 tag-strip-suffixes 失敗，使用預設:', e.message);
    }
    _tagStripSuffixesCache = [...TAG_STRIP_SUFFIXES_DEFAULT];
    return _tagStripSuffixesCache;
}
function normalizeTagForMatch(tag) {
    let s = (tag || '').toString().trim().toLowerCase();
    for (const w of getTagStripSuffixes()) {
        if (s.endsWith(w)) s = s.slice(0, -w.length).trim();
    }
    return s;
}
function tagsOverlapNormalized(itemTags, listingTags) {
    if (!Array.isArray(itemTags) || itemTags.length === 0 || !Array.isArray(listingTags) || listingTags.length === 0) return false;
    const set = new Set(itemTags.map(t => normalizeTagForMatch(t)).filter(Boolean));
    return listingTags.some(lt => set.has(normalizeTagForMatch(lt)));
}

// 中間件設置（JSON 放寬以接受客製產品儲存時可能帶的 base64 圖）
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// 允許本地開發時從其他 port（如 Live Server 5500）呼叫 API
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});
// 首頁：僅 / 送 iStudio 內容；/index.html 301 到 /（與 canonical 一致，避免 GSC「替代頁面」重複網址）
const indexPath = path.join(__dirname, 'public', 'iStudio-1.0.0', 'index.html');
app.get('/index.html', (req, res) => {
    const q = (req.url && req.url.indexOf('?') >= 0) ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(301, '/' + q);
});
app.get('/', (req, res) => {
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('首頁 sendFile 失敗:', err.message, 'path:', indexPath);
            res.status(err.status || 500).send(err.status === 404 ? 'File not found' : 'Server error');
        }
        // 成功時 sendFile 已送完，不需再 res.send
    });
});
// 【不准修改】首頁網址 /iStudio-1.0.0/ 必須導向 / ；使用者已多次被改壞，勿刪勿改此段
app.get(['/iStudio-1.0.0', '/iStudio-1.0.0/', '/iStudio-1.0.0/index.html'], (req, res) => {
    res.redirect(302, '/');
});

// 靈感牆單一作品獨立 URL：穩定落地頁（SEO／分享）；?open=1 可選導向首頁 lightbox
app.get('/inspiration/:type/:id', async (req, res) => {
    const type = (req.params.type || '').trim();
    const id = (req.params.id || '').trim();
    if (!['user_design', 'comparison', 'series', 'collection'].includes(type) || !id) {
        res.status(400).send('Invalid type or id');
        return;
    }
    try {
        const origin = (req.get('x-forwarded-proto') && req.get('host')) ? `${req.get('x-forwarded-proto')}://${req.get('host')}` : null;
        const base = origin || BASE_URL;
        const apiRes = await fetch(`${base}/api/media-wall-item/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } });
        if (!apiRes.ok) {
            res.status(apiRes.status === 404 ? 404 : 500).send(apiRes.status === 404 ? '找不到該作品' : '暫時無法載入');
            return;
        }
        const { item } = await apiRes.json();
        if (!item) {
            res.status(404).send('找不到該作品');
            return;
        }
        attachDisplayTags(item);
        const displayTags = item.display_tags || [];
        const tagsKeywords = displayTags.slice(0, 24).join(', ');
        const title = (item.title || '作品').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        let descRaw = (item.description || item.generation_prompt || item.title || 'MATCHDO 靈感牆作品').toString();
        if (tagsKeywords) descRaw = (descRaw + ' — ' + tagsKeywords).slice(0, 300);
        const desc = descRaw.slice(0, 160).replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const metaKeywords = tagsKeywords.replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const img = item.image_url || item.cover_image_url || '';
        let imgUrl = '';
        if (img) {
            const supabaseOrigin = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
            if (img.startsWith('http')) {
                imgUrl = (supabaseOrigin && img.startsWith(supabaseOrigin + '/'))
                    ? (base + '/api/proxy-image?url=' + encodeURIComponent(img))
                    : img;
            } else {
                imgUrl = base + (img.startsWith('/') ? '' : '/') + img;
            }
        }
        const pageUrl = `${base}/inspiration/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
        const itemParam = `${encodeURIComponent(type)}-${encodeURIComponent(id)}`;
        const lightboxUrl = `${base}/?item=${itemParam}`;
        const openLightbox = req.query.open === '1' || req.query.open === 'true';
        const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} - MATCHDO 靈感牆</title>
<meta name="description" content="${desc}">
${metaKeywords ? `<meta name="keywords" content="${metaKeywords}">` : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="MATCHDO 合做">
<meta property="og:title" content="${title} - MATCHDO 靈感牆">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${pageUrl}">
<link rel="canonical" href="${pageUrl.replace(/"/g, '&quot;')}">
${imgUrl ? `<meta property="og:image" content="${imgUrl.replace(/"/g, '&quot;')}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title} - MATCHDO 靈感牆">
<meta name="twitter:description" content="${desc}">
${imgUrl ? `<meta name="twitter:image" content="${imgUrl.replace(/"/g, '&quot;')}">` : ''}
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: item.title || '作品',
    description: descRaw.slice(0, 200),
    ...(imgUrl ? { image: imgUrl } : {}),
    url: pageUrl,
    ...(displayTags.length ? { keywords: displayTags.slice(0, 30).join(', ') } : {})
}).replace(/</g, '\\u003c')}</script>
<style>
.inspiration-page{max-width:720px;margin:1.5rem auto;padding:0 1rem;font-family:system-ui,sans-serif}
.inspiration-page h1{font-size:1.25rem;margin:0 0 .75rem}
.inspiration-page .inspiration-img{max-width:100%;height:auto;border-radius:8px}
.inspiration-tags-details{margin:1rem 0;font-size:.875rem}
.inspiration-tags-details summary{cursor:pointer;color:#445D7E;font-weight:600;list-style:none;display:inline-flex;align-items:center;gap:.35rem}
.inspiration-tags-details summary::-webkit-details-marker{display:none}
.inspiration-tags-list{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.5rem}
.inspiration-tag{display:inline-block;padding:.2rem .5rem;background:#f0f4f8;border-radius:4px;font-size:.75rem;color:#333}
.inspiration-open-btn{display:inline-block;margin-top:1rem;padding:.5rem 1rem;background:#445D7E;color:#fff!important;text-decoration:none;border-radius:6px;font-size:.9rem}
</style>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
</head>
<body>
<article class="inspiration-page">
<h1>${title}</h1>
${imgUrl ? `<img class="inspiration-img" src="${imgUrl.replace(/"/g, '&quot;')}" alt="${title}">` : ''}
${buildInspirationTagsBlockHtml(displayTags)}
<p class="inspiration-url-hint"><small>永久連結：</small> <a href="${pageUrl.replace(/"/g, '&quot;')}">${pageUrl.replace(/</g, '&lt;')}</a></p>
<p><a class="inspiration-open-btn" href="${lightboxUrl.replace(/"/g, '&quot;')}">在首頁靈感牆中開啟</a></p>
</article>
${openLightbox ? `<script>setTimeout(function(){window.location.replace(${JSON.stringify(lightboxUrl)});},800);</script>` : ''}
<noscript><p><a href="${lightboxUrl.replace(/"/g, '&quot;')}">前往靈感牆</a></p></noscript>
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=120');
        res.send(html);
    } catch (e) {
        console.error('GET /inspiration/:type/:id 異常:', e);
        if (!res.headersSent) res.status(500).send('暫時無法載入');
    }
});
// 單一入口：產品設計表單與客戶端頁面（只維護 public/custom-product.html、client/*，舊網址導向正式路徑）
app.get('/iStudio-1.0.0/custom-product.html', (req, res) => res.redirect(302, '/custom-product.html'));
app.get('/iStudio-1.0.0/client/my-custom-products.html', (req, res) => res.redirect(302, '/client/my-custom-products.html'));
app.get('/iStudio-1.0.0/client/custom-product-detail.html', (req, res) => {
    const raw = req.originalUrl || req.url || '';
    const q = raw.indexOf('?') >= 0 ? raw.slice(raw.indexOf('?')) : '';
    res.redirect(302, '/client/custom-product-detail.html' + q);
});
// 廠商後台：舊書籤／誤輸入缺 client 前綴時導向正式路徑
function redirectWithQuery(req, res, targetPath) {
    const raw = req.originalUrl || req.url || '';
    const q = raw.indexOf('?') >= 0 ? raw.slice(raw.indexOf('?')) : '';
    res.redirect(302, targetPath + q);
}
app.get('/manufacturer-dashboard.html', (req, res) => redirectWithQuery(req, res, '/client/manufacturer-dashboard.html'));
app.get('/manufacturer-materials.html', (req, res) => redirectWithQuery(req, res, '/client/manufacturer-materials.html'));
app.get('/manufacturer-portfolio.html', (req, res) => redirectWithQuery(req, res, '/client/manufacturer-portfolio.html'));
app.get('/manufacturer-inquiries.html', (req, res) => redirectWithQuery(req, res, '/client/manufacturer-inquiries.html'));

// 圖庫找廠商：由伺服器注入資料，避免前端 fetch 失敗導致永遠沒顯示
async function getGalleryComparisonItems() {
    try {
        const { data: compRows } = await supabase
            .from('manufacturer_portfolio')
            .select('id, manufacturer_id, title, image_url, image_url_before, design_highlight, tags, description, category_key')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false })
            .limit(100);

        const rows = compRows || [];
        // Batch-fetch manufacturer info for joined display
        const mfrIds = [...new Set(rows.map(r => r.manufacturer_id).filter(Boolean))];
        let mfrMap = {};
        if (mfrIds.length) {
            const { data: mfrs } = await supabase
                .from('manufacturers')
                .select('id, name, location, contact_json, categories, user_id')
                .in('id', mfrIds)
                .eq('is_active', true);
            (mfrs || []).forEach(m => { mfrMap[m.id] = m; });
        }

        const out = rows.map(p => {
            const mfr = mfrMap[p.manufacturer_id] || {};
            const contact = mfr.contact_json || {};
            return {
                id: p.id,
                manufacturer_id: p.manufacturer_id || null,
                title: p.title || '廠商作品',
                image_url: p.image_url || null,
                image_url_before: p.image_url_before || null,
                design_highlight: p.design_highlight || null,
                description: p.description || null,
                tags: p.tags || [],
                category_key: p.category_key || null,
                manufacturer_name: mfr.name || '廠商作品',
                manufacturer_location: mfr.location || '',
                manufacturer_categories: mfr.categories || [],
                manufacturer_contact: Object.keys(contact).length ? contact : null,
                manufacturer_user_id: mfr.user_id || null
            };
        });

        if (out.length === 0) {
            out.push({
                id: 'demo-comparison',
                manufacturer_id: null,
                title: '對比範例',
                image_url: 'https://placehold.co/400x300/555/aaa?text=%E5%AF%A6%E5%93%81',
                image_url_before: 'https://placehold.co/400x300/888/ccc?text=%E6%A6%82%E5%BF%B5',
                design_highlight: null,
                description: null,
                tags: [],
                category_key: null,
                manufacturer_name: '廠商作品',
                manufacturer_location: '',
                manufacturer_categories: [],
                manufacturer_contact: null
            });
        }
        return out;
    } catch (e) {
        console.error('getGalleryComparisonItems:', e);
        return [{
            id: 'demo-comparison',
            title: '對比範例',
            image_url: 'https://placehold.co/400x300/555/aaa?text=%E5%AF%A6%E5%93%81',
            image_url_before: 'https://placehold.co/400x300/888/ccc?text=%E6%A6%82%E5%BF%B5',
            manufacturer_name: '廠商作品',
            manufacturer_location: '',
            manufacturer_categories: [],
            manufacturer_contact: null,
            tags: [],
            description: null
        }];
    }
}

app.get('/custom/gallery.html', async (req, res) => {
    try {
        const items = await getGalleryComparisonItems();
        const filePath = path.join(__dirname, 'public', 'custom', 'gallery.html');
        let html = await fs.promises.readFile(filePath, 'utf8');
        const inject = '<script>window.__GALLERY_ITEMS__=' + JSON.stringify(items).replace(/<\/script>/gi, '<\\/script>') + ';</script>';
        if (!html.includes('__GALLERY_ITEMS__')) {
            html = html.replace('</head>', inject + '\n</head>');
        }
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'private, max-age=60');
        res.send(html);
    } catch (e) {
        console.error('GET /custom/gallery.html:', e);
        res.status(500).send('伺服器錯誤');
    }
});

registerSitemapRoutes(app, { supabase, BASE_URL });

// 圖庫找廠商專用 API（與首頁同源資料），避免圖庫頁永遠空白
app.get('/api/gallery-items', async (req, res) => {
    try {
        const items = await getGalleryComparisonItems();
        res.set('Cache-Control', 'private, max-age=60');
        res.json({ items });
    } catch (e) {
        console.error('GET /api/gallery-items:', e);
        res.status(500).json({ error: '載入失敗' });
    }
});

// GET /api/collections/:slug — 資料夾詳情（collection.html 用）
app.get('/api/collections/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { data: col, error } = await supabase
            .from('media_collections')
            .select('id, title, slug, cover_image_url, image_urls, description, manufacturer_id, category_keys')
            .eq('slug', slug)
            .eq('is_active', true)
            .maybeSingle();
        if (error || !col) return res.status(404).json({ error: '找不到此資料夾' });

        // 補充廠商資訊
        let manufacturer = null;
        if (col.manufacturer_id) {
            const { data: mfr } = await supabase
                .from('manufacturers')
                .select('id, name, location, user_id, contact_json')
                .eq('id', col.manufacturer_id)
                .maybeSingle();
            if (mfr) manufacturer = { id: mfr.id, name: mfr.name, location: mfr.location, user_id: mfr.user_id || null, contact: mfr.contact_json || {} };
        }

        // 取資料夾內的作品圖（從 manufacturer_portfolio）
        let portfolioItems = [];
        if (col.manufacturer_id) {
            const { data: items } = await supabase
                .from('manufacturer_portfolio')
                .select('id, title, image_url, description, tags, design_highlight')
                .eq('manufacturer_id', col.manufacturer_id)
                .order('sort_order', { ascending: true })
                .limit(50);
            portfolioItems = items || [];
        }

        // 資料夾自身的 image_urls
        const imageUrls = Array.isArray(col.image_urls) && col.image_urls.length > 0
            ? col.image_urls
            : (col.cover_image_url ? [col.cover_image_url] : []);

        res.json({ collection: { ...col, image_urls: imageUrls }, manufacturer, portfolioItems });
    } catch (e) {
        console.error('GET /api/collections/:slug:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// 後台：管理員驗證（供 /api/admin/users 等使用）
async function requireAdmin(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: '未授權' });
        return null;
    }
    const token = authHeader.replace(/^\s*Bearer\s+/i, '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        res.status(401).json({ error: 'token 無效' });
        return null;
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
        res.status(403).json({ error: '僅管理員可操作' });
        return null;
    }
    return user;
}

// 檢查使用者是否為管理員（不送 res，供權限判斷用）
async function isAdminUserId(userId) {
    if (!userId) return false;
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
    return data?.role === 'admin';
}

// 取得當前請求者是否為管理員（不送 401/403，供 GET 篩選用）
async function getRequestAdminFlag(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    const token = authHeader.replace(/^\s*Bearer\s+/i, '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return false;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    return profile?.role === 'admin';
}

async function getRequestUserFromAuthHeader(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.replace(/^\s*Bearer\s+/i, '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

/** 管理員或測試員（含 ALLOWED_TESTER_EMAILS）：可預覽尚未同意公開的種子廠商與下架素材 */
async function getRequestInternalPreviewFlag(req) {
    const user = await getRequestUserFromAuthHeader(req);
    if (!user) return false;
    const email = (user.email || '').trim().toLowerCase();
    const allowedEmails = (process.env.ALLOWED_TESTER_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (allowedEmails.length > 0 && allowedEmails.includes(email)) return true;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    return profile?.role === 'admin' || profile?.role === 'tester';
}

function manufacturerIsSeedVendor(mfr) {
    return !!(mfr && mfr.vendor_source === 'seed');
}

/** 種子期間由平台用綁定帳號維護，不擋編輯；轉正式廠商後才交付帳密。付費／免費上傳仍走 hasActivePaidSubscription。 */
async function rejectSeedVendorSelfServiceWrite(_userId, _mfrOrManufacturerId, _res) {
    return false;
}

function manufacturerSeedPublicReleased(mfr) {
    if (!manufacturerIsSeedVendor(mfr)) return true;
    return !!(mfr.seed_public_released_at);
}

/** 種子廠商是否可出現在一般使用者的廠商列表／詳情（不含素材 is_public） */
function manufacturerVisibleToPublicAudience(mfr) {
    if (!mfr || mfr.is_active === false) return false;
    if (!manufacturerIsSeedVendor(mfr)) return true;
    if (!manufacturerSeedPublicReleased(mfr)) return false;
    if (mfr.expires_at && new Date(mfr.expires_at) <= new Date()) return false;
    return true;
}

function vendorAssetVisibleToPublicAudience(mfr, assetRow) {
    if (!assetRow || assetRow.is_public === false) return false;
    return manufacturerVisibleToPublicAudience(mfr);
}

function parseSeedPublicReleasedAtBody(raw) {
    if (raw === undefined) return undefined;
    if (raw === null || raw === '' || raw === false) return null;
    if (raw === true) return new Date().toISOString();
    const s = String(raw).trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// 廠商公開曝光條件：is_active 且 (expires_at 為空 或 expires_at > 現在)。種子廠商 90 天後不曝光
function manufacturerVisibleExpiresFilter() {
    return 'expires_at.is.null,expires_at.gt.' + new Date().toISOString();
}

// 後台：管理員或測試員（僅 Playground / AI 工具頁用）
async function requireAdminOrTester(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: '未授權' });
        return null;
    }
    const token = authHeader.replace(/^\s*Bearer\s+/i, '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        res.status(401).json({ error: 'token 無效' });
        return null;
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'tester') {
        res.status(403).json({ error: '僅管理員或測試員可操作' });
        return null;
    }
    return user;
}

// GET /api/admin/can-access — 供前端 /admin/* 權限閘使用：僅管理員或測試員回 200，未登入 401，其餘 403
// 若 .env 設 ALLOWED_TESTER_EMAILS=信箱1,信箱2 則該信箱可直接通過（繞過 profiles.role）
app.get('/api/admin/can-access', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: '未授權' });
        return;
    }
    const token = authHeader.replace(/^\s*Bearer\s+/i, '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        res.status(401).json({ error: 'token 無效' });
        return;
    }
    const email = (user.email || '').trim().toLowerCase();
    const allowedEmails = (process.env.ALLOWED_TESTER_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (allowedEmails.length > 0 && allowedEmails.includes(email)) {
        return res.json({ ok: true });
    }
    const { data: profile, error: profErr } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profErr) {
        console.error('GET /api/admin/can-access profiles:', profErr);
        res.status(500).json({ error: '查詢角色失敗', debug: profErr.message });
        return;
    }
    const role = profile?.role !== undefined && profile?.role !== null ? profile.role : null;
    if (role !== 'admin' && role !== 'tester') {
        const hint = profile == null
            ? "INSERT INTO public.profiles (id, email, role) VALUES ('" + user.id + "', '" + (user.email || '').replace(/'/g, "''") + "', 'admin') ON CONFLICT (id) DO UPDATE SET role = 'admin';"
            : "UPDATE public.profiles SET role = 'admin' WHERE id = '" + user.id + "';";
        res.status(403).json({ error: '僅管理員或測試員可進入後台', role: role, hint: hint });
        return;
    }
    res.json({ ok: true });
});

/** 管理員檢視用：平台角色 + ①②③ 工作區身分（與前台 capabilities 對照，唯讀） */
function buildAdminUserIdentities(profileRole, manufacturer, industrySupplier, subscription, memberLevel) {
    const identities = [];
    const pr = profileRole || 'user';
    if (pr === 'admin') identities.push({ kind: 'platform', label: '管理員', badge: 'danger' });
    else if (pr === 'tester') identities.push({ kind: 'platform', label: '測試員', badge: 'info' });
    else identities.push({ kind: 'platform', label: '一般用戶', badge: 'secondary' });
    identities.push({ kind: 'zone', label: '① 訂製／設計', badge: 'light text-dark' });
    if (manufacturer) {
        const vs = manufacturer.vendor_source || null;
        let mfrKind = '一般／付費廠商';
        if (vs === 'seed') mfrKind = '種子廠商';
        else if (vs === 'platform') mfrKind = '官方範例';
        identities.push({
            kind: 'manufacturer',
            label: '② ' + mfrKind,
            badge: vs === 'seed' ? 'primary' : (vs === 'platform' ? 'info text-dark' : 'success'),
            detail: manufacturer.name || null,
            inactive: manufacturer.is_active === false
        });
    }
    if (industrySupplier) {
        identities.push({
            kind: 'supplier',
            label: '③ 產業供應商',
            badge: 'warning text-dark',
            detail: industrySupplier.name || null,
            inactive: industrySupplier.is_active === false
        });
    }
    const isStaff = pr === 'admin' || pr === 'tester';
    const subPrice = subscription && subscription.price != null ? parseInt(subscription.price, 10) : 0;
    const level = (memberLevel != null ? String(memberLevel).trim() : '') || FREE_MEMBER_LEVEL_LABEL;
    const paidByLevel = isPaidMemberLevel(level);
    const paidBySub = !!(subscription && subPrice > 0);
    if (!isStaff && (paidByLevel || paidBySub)) {
        const label = paidByLevel ? ('付費會員·' + level) : '付費訂閱';
        const detail = paidBySub
            ? ((subscription.plan_name || '') + (subscription.end_date ? ' 至 ' + String(subscription.end_date).slice(0, 10) : ''))
            : '（依會員等級，無訂閱紀錄）';
        identities.push({ kind: 'billing', label, badge: 'dark', detail });
    } else if (!isStaff) {
        identities.push({ kind: 'billing', label: '免費會員（一般）', badge: 'outline-secondary' });
    }
    return identities;
}

/** 一般會員列表：附加廠商／供應商／有效訂閱摘要（不改 role／capabilities） */
async function attachAdminUserSummaries(users) {
    const userIds = users.map((u) => u.id).filter(Boolean);
    if (!userIds.length) return users;
    const now = new Date().toISOString();
    const mfrByUser = {};
    const supByUser = {};
    const subByUser = {};
    try {
        const { data: mfrs } = await supabase.from('manufacturers').select('id, name, user_id, vendor_source, is_active').in('user_id', userIds);
        (mfrs || []).forEach((m) => { if (m.user_id) mfrByUser[m.user_id] = m; });
    } catch (_) { /* ignore */ }
    try {
        const { data: sups } = await supabase.from('industry_suppliers').select('id, name, user_id, is_active').in('user_id', userIds);
        (sups || []).forEach((s) => { if (s.user_id) supByUser[s.user_id] = s; });
    } catch (_) { /* 表未建 */ }
    try {
        const { data: subs } = await supabase
            .from('user_subscriptions')
            .select('id, user_id, end_date, status, plan_id, subscription_plans(name, price, plan_key)')
            .in('user_id', userIds)
            .eq('status', 'active')
            .gt('end_date', now)
            .order('end_date', { ascending: false });
        (subs || []).forEach((s) => {
            if (!subByUser[s.user_id]) {
                const plan = s.subscription_plans || {};
                subByUser[s.user_id] = {
                    id: s.id,
                    plan_id: s.plan_id,
                    plan_name: plan.name,
                    price: plan.price,
                    plan_key: plan.plan_key,
                    end_date: s.end_date,
                    status: s.status
                };
            }
        });
    } catch (_) { /* ignore */ }
    return users.map((u) => {
        const manufacturer = mfrByUser[u.id] ? {
            id: mfrByUser[u.id].id,
            name: mfrByUser[u.id].name,
            vendor_source: mfrByUser[u.id].vendor_source || null,
            is_active: mfrByUser[u.id].is_active !== false
        } : null;
        const industry_supplier = supByUser[u.id] ? {
            id: supByUser[u.id].id,
            name: supByUser[u.id].name,
            is_active: supByUser[u.id].is_active !== false
        } : null;
        const subscription = subByUser[u.id] || null;
        return {
            ...u,
            manufacturer,
            industry_supplier,
            subscription,
            identities: buildAdminUserIdentities(u.role, manufacturer, industry_supplier, subscription, u.member_level)
        };
    });
}

// GET /api/admin/users — 用戶管理：列出所有用戶（含會員等級、點數），僅管理員（註冊於 static 前以確保不被靜態攔截）
app.get('/api/admin/users', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        let list = [];
        const { data: profiles, error: profErr } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, member_level, can_delete_media_wall')
            .order('email', { ascending: true });
        if (profErr) {
            if (profErr.code === '42703') {
                const { data: prof2, error: e2 } = await supabase
                    .from('profiles')
                    .select('id, email, full_name, role, member_level')
                    .order('email', { ascending: true });
                if (e2) {
                    const { data: prof3, error: e3 } = await supabase
                        .from('profiles')
                        .select('id, email, full_name, role')
                        .order('email', { ascending: true });
                    if (e3) {
                        console.error('GET /api/admin/users profiles:', e3);
                        return res.status(500).json({ error: '查詢用戶失敗' });
                    }
                    list = (prof3 || []).map(p => ({ ...p, member_level: '一般', can_delete_media_wall: false }));
                } else {
                    list = (prof2 || []).map(p => ({ ...p, member_level: p.member_level || '一般', can_delete_media_wall: false }));
                }
            } else {
                console.error('GET /api/admin/users profiles:', profErr);
                return res.status(500).json({ error: '查詢用戶失敗' });
            }
        } else {
            list = profiles || [];
        }
        const userIds = list.map(p => p.id).filter(Boolean);
        let creditsMap = {};
        if (userIds.length > 0) {
            try {
                const { data: credits } = await supabase
                    .from('user_credits')
                    .select('user_id, balance, total_earned, total_spent')
                    .in('user_id', userIds);
                (credits || []).forEach(c => { creditsMap[c.user_id] = c; });
            } catch (_) { /* user_credits 表可能尚未建立 */ }
        }
        let users = list.map(p => ({
            id: p.id,
            email: p.email || '',
            full_name: p.full_name || '',
            role: p.role || 'user',
            member_level: p.member_level || '一般',
            can_delete_media_wall: p.can_delete_media_wall === true,
            points: creditsMap[p.id] ? creditsMap[p.id].balance : 0,
            total_earned: creditsMap[p.id] ? creditsMap[p.id].total_earned : 0,
            total_spent: creditsMap[p.id] ? creditsMap[p.id].total_spent : 0
        }));
        const wantEnriched = req.query.enriched === '1' || req.query.enriched === 'true';
        if (wantEnriched && users.length > 0) {
            users = await attachAdminUserSummaries(users);
        }
        res.json({ users });
    } catch (e) {
        console.error('GET /api/admin/users 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/admin/users — 管理員手動建立帳號（email + 密碼，可設姓名、角色、會員等級）
app.post('/api/admin/users', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const body = req.body || {};
        const email = (body.email != null && String(body.email).trim()) ? String(body.email).trim() : '';
        const password = String(body.password || '').trim();
        if (!email) return res.status(400).json({ error: '請填寫 Email' });
        if (password.length < 6) return res.status(400).json({ error: '密碼至少 6 個字元' });
        const fullName = body.full_name != null ? String(body.full_name).trim() : '';
        const role = (body.role === 'admin' || body.role === 'tester') ? body.role : 'user';
        const memberLevel = (body.member_level && ['一般', '進階', '尊榮', 'VIP'].includes(body.member_level)) ? body.member_level : '一般';

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });
        if (authError) {
            const msg = authError.message || '';
            if (msg.includes('already') || authError.status === 422) return res.status(400).json({ error: '此 Email 已被註冊' });
            console.error('POST /api/admin/users createUser:', authError);
            return res.status(400).json({ error: msg || '建立帳號失敗' });
        }
        const userId = authData.user?.id;
        if (!userId) return res.status(500).json({ error: '建立帳號後未取得用戶 ID' });

        const { error: profileErr } = await supabase.from('profiles')
            .upsert({
                id: userId,
                email,
                full_name: fullName || null,
                role
            }, { onConflict: 'id' });
        if (profileErr) {
            console.error('POST /api/admin/users profiles upsert:', profileErr);
            return res.status(500).json({ error: '更新用戶資料失敗' });
        }
        if (memberLevel && memberLevel !== '一般') {
            const { error: levelErr } = await supabase.from('profiles')
                .update({ member_level: memberLevel }).eq('id', userId);
            if (levelErr) { /* 若 profiles 尚無 member_level 欄位，忽略；請執行 docs/admin-user-management-profiles-migration.sql */ }
        }

        res.status(201).json({ success: true, id: userId, email });
    } catch (e) {
        console.error('POST /api/admin/users 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/admin/seed-manufacturer — 管理員建立種子廠商（綁定指定 user_id，vendor_source=seed）
// 還原點：見 docs/還原點-種子廠商實作前.md；操作手冊：docs/種子廠商入駐操作手冊.md
app.post('/api/admin/seed-manufacturer', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const body = req.body || {};
        const userId = (body.user_id || '').trim();
        if (!userId) return res.status(400).json({ error: '請傳入 user_id（欲綁定之登入帳號 UUID）' });
        const name = (body.name || '').trim();
        if (!name) return res.status(400).json({ error: '請填寫廠商名稱' });
        const { data: existing } = await supabase.from('manufacturers').select('id').eq('user_id', userId).maybeSingle();
        if (existing) return res.status(400).json({ error: '該使用者已綁定廠商，一帳號僅能綁定一間廠商' });
        const daysRaw = parseInt(body.public_days, 10);
        const publicDays = (Number.isFinite(daysRaw) && daysRaw >= 1) ? daysRaw : 90;
        const expiresAt = new Date(Date.now() + publicDays * 24 * 60 * 60 * 1000).toISOString();
        const payload = {
            user_id: userId,
            name,
            description: (body.description || '').trim() || null,
            location: (body.location || '').trim() || null,
            contact_json: body.contact_json && typeof body.contact_json === 'object' ? body.contact_json : {},
            categories: Array.isArray(body.categories) ? body.categories : [],
            is_active: true,
            verified: !!body.verified,
            vendor_source: 'seed',
            expires_at: expiresAt
        };
        const { data: inserted, error } = await supabase.from('manufacturers').insert(payload).select('id, name, user_id, vendor_source, expires_at').single();
        if (error) {
            if (error.code === '42703') return res.status(500).json({ error: '請先執行 docs/add-manufacturers-vendor-source.sql 與 docs/add-manufacturers-expires-at.sql 新增欄位' });
            console.error('POST /api/admin/seed-manufacturer:', error);
            return res.status(500).json({ error: error.message || '建立失敗' });
        }
        res.status(201).json(inserted);
    } catch (e) {
        console.error('POST /api/admin/seed-manufacturer 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

const MFR_ADMIN_ROW_SELECT = 'id, name, description, location, contact_json, categories, is_active, verified, expires_at, vendor_source, seed_public_released_at';

function isMissingManufacturerColumnError(err, colName) {
    const msg = String((err && err.message) || '');
    return err && err.code === '42703' && (!colName || msg.includes(colName));
}

async function updateManufacturerAdminRow(manufacturerId, updates) {
    let payload = { ...updates };
    let selectCols = MFR_ADMIN_ROW_SELECT;
    if (payload.logo_url !== undefined) selectCols = MFR_ADMIN_ROW_SELECT.replace('categories,', 'categories, logo_url,');
    let { data, error } = await supabase.from('manufacturers').update(payload).eq('id', manufacturerId).select(selectCols).single();
    if (error && isMissingManufacturerColumnError(error, 'logo_url')) {
        delete payload.logo_url;
        ({ data, error } = await supabase.from('manufacturers').update(payload).eq('id', manufacturerId).select(MFR_ADMIN_ROW_SELECT).single());
    }
    if (error && isMissingManufacturerColumnError(error, 'seed_public_released_at')) {
        delete payload.seed_public_released_at;
        ({ data, error } = await supabase.from('manufacturers').update(payload).eq('id', manufacturerId).select(MFR_ADMIN_ROW_SELECT.replace(', seed_public_released_at', '')).single());
    }
    return { data, error };
}

// PATCH /api/admin/manufacturers/:id — 管理員代為編輯任意廠商資料（名稱、描述、聯絡等）；用於種子廠商維護
app.patch('/api/admin/manufacturers/:id', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const manufacturerId = (req.params.id || '').trim();
        if (!manufacturerId) return res.status(400).json({ error: '請傳入廠商 id' });
        const { data: mfr } = await supabase.from('manufacturers').select('id').eq('id', manufacturerId).single();
        if (!mfr) return res.status(404).json({ error: '找不到該廠商' });
        const body = req.body || {};
        const updates = {};
        if (body.name !== undefined && body.name != null && String(body.name).trim()) updates.name = String(body.name).trim();
        if (body.description !== undefined) updates.description = (body.description && String(body.description).trim()) ? String(body.description).trim() : null;
        if (body.location !== undefined) updates.location = (body.location && String(body.location).trim()) ? String(body.location).trim() : null;
        if (body.categories !== undefined) updates.categories = Array.isArray(body.categories) ? body.categories : [];
        if (body.logo_url !== undefined) updates.logo_url = (body.logo_url && String(body.logo_url).trim()) ? String(body.logo_url).trim() : null;
        if (body.is_active !== undefined) updates.is_active = !!body.is_active;
        if (body.verified !== undefined) updates.verified = !!body.verified;
        if (body.contact_json !== undefined && typeof body.contact_json === 'object') updates.contact_json = body.contact_json;
        if (body.expires_at !== undefined) updates.expires_at = body.expires_at === null || body.expires_at === '' ? null : body.expires_at;
        if (body.vendor_source !== undefined) {
            const vs = body.vendor_source;
            if (vs === null || vs === '' || vs === 'paid') updates.vendor_source = null;
            else updates.vendor_source = String(vs).trim();
        }
        const releasedAt = parseSeedPublicReleasedAtBody(body.seed_public_released_at);
        if (releasedAt !== undefined) updates.seed_public_released_at = releasedAt;
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: '無可更新的欄位' });
        const { data: updated, error } = await updateManufacturerAdminRow(manufacturerId, updates);
        if (error) {
            console.error('PATCH /api/admin/manufacturers/:id:', error);
            if (isMissingManufacturerColumnError(error)) {
                return res.status(500).json({ error: '資料庫缺少欄位，請於 Supabase 執行 docs/add-manufacturer-logo.sql（或相關 migration）' });
            }
            return res.status(500).json({ error: error.message || '更新失敗' });
        }
        const vs = updated.vendor_source || null;
        const kind = vs === 'seed' ? '種子' : (vs === 'platform' ? '官方範例' : '一般／付費');
        const releasedNote = updated.seed_public_released_at
            ? '已同意對外公開'
            : (vs === 'seed' ? '尚未同意對外（僅 admin/tester 可預覽）' : '');
        res.json({
            ...updated,
            message: `已更新。目前類型：${kind}；${updated.expires_at ? '到期日：' + updated.expires_at : '已清除種子到期日（無倒數）'}${releasedNote ? '；' + releasedNote : ''}`
        });
    } catch (e) {
        console.error('PATCH /api/admin/manufacturers/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/admin/manufacturers/:id — 管理員刪除廠商（含種子／官方範例；關聯資料依 DB CASCADE）
app.delete('/api/admin/manufacturers/:id', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const manufacturerId = (req.params.id || '').trim();
        if (!manufacturerId) return res.status(400).json({ error: '請傳入廠商 id' });
        const { data: mfr } = await supabase.from('manufacturers').select('id, name').eq('id', manufacturerId).single();
        if (!mfr) return res.status(404).json({ error: '找不到該廠商' });
        const { error } = await supabase.from('manufacturers').delete().eq('id', manufacturerId);
        if (error) {
            console.error('DELETE /api/admin/manufacturers/:id:', error);
            return res.status(500).json({ error: error.message || '刪除失敗（可能有未設定 CASCADE 的關聯資料）' });
        }
        res.json({ ok: true, deleted_id: manufacturerId, name: mfr.name });
    } catch (e) {
        console.error('DELETE /api/admin/manufacturers/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/seed-manufacturers — 管理員查詢種子廠商列表（含剩餘天數、是否已轉付費）
app.get('/api/admin/seed-manufacturers', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const seedOnly = (req.query.seed_only === '1' || req.query.seed_only === 'true');
        let query = supabase.from('manufacturers').select('id, name, user_id, vendor_source, expires_at, is_active, location, contact_json, verified, created_at, seed_public_released_at').order('created_at', { ascending: false });
        if (seedOnly) query = query.eq('vendor_source', 'seed');
        const { data: rows, error } = await query;
        if (error) {
            if (error.code === '42703') return res.status(500).json({ error: '請先執行 docs/add-manufacturers-vendor-source.sql 與 add-manufacturers-expires-at.sql' });
            console.error('GET /api/admin/seed-manufacturers:', error);
            return res.status(500).json({ error: error.message || '查詢失敗' });
        }
        const now = new Date();
        const items = (rows || []).map((m) => {
            const vs = m.vendor_source || null;
            const exp = m.expires_at ? new Date(m.expires_at) : null;
            const isSeed = vs === 'seed';
            const isPlatform = vs === 'platform';
            const isPaid = !isSeed; // 非種子＝已解除種子限制（付費或官方範例）
            const isActive = m.is_active !== false;
            let remainingDays = null;
            if (isSeed && exp) remainingDays = exp > now ? Math.ceil((exp - now) / (24 * 60 * 60 * 1000)) : 0; // 0 = 已過期
            return {
                id: m.id,
                name: m.name,
                user_id: m.user_id || null,
                vendor_source: vs,
                expires_at: m.expires_at || null,
                seed_public_released_at: m.seed_public_released_at || null,
                seed_public_released: !!(m.seed_public_released_at),
                remaining_days: remainingDays,
                is_paid: isPaid,
                is_platform: isPlatform,
                is_seed: isSeed,
                is_active: isActive,
                location: m.location || null,
                contact_json: m.contact_json || {},
                verified: !!m.verified,
                created_at: m.created_at || null
            };
        });
        res.json({ items });
    } catch (e) {
        console.error('GET /api/admin/seed-manufacturers 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/** 管理員廠商列表：附加帳號 email、有效訂閱摘要（不改身分權限模型） */
async function enrichAdminManufacturerRows(rows) {
    const now = new Date();
    const userIds = [...new Set((rows || []).map((m) => m.user_id).filter(Boolean))];
    const emailByUser = {};
    const subByUser = {};
    if (userIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, email, full_name').in('id', userIds);
        (profs || []).forEach((p) => { emailByUser[p.id] = p; });
        const { data: subs } = await supabase
            .from('user_subscriptions')
            .select('id, user_id, start_date, end_date, status, plan_id, subscription_plans(id, name, price, plan_key, duration_months)')
            .in('user_id', userIds)
            .eq('status', 'active')
            .gt('end_date', now.toISOString())
            .order('end_date', { ascending: false });
        (subs || []).forEach((s) => {
            if (!subByUser[s.user_id]) subByUser[s.user_id] = s;
        });
    }
    return (rows || []).map((m) => {
        const vs = m.vendor_source || null;
        const exp = m.expires_at ? new Date(m.expires_at) : null;
        const isSeed = vs === 'seed';
        const isPlatform = vs === 'platform';
        let remainingDays = null;
        if (isSeed && exp) remainingDays = exp > now ? Math.ceil((exp - now) / (24 * 60 * 60 * 1000)) : 0;
        const prof = m.user_id ? emailByUser[m.user_id] : null;
        const subRow = m.user_id ? subByUser[m.user_id] : null;
        const plan = subRow && subRow.subscription_plans ? subRow.subscription_plans : null;
        return {
            id: m.id,
            name: m.name,
            user_id: m.user_id || null,
            user_email: prof ? prof.email : null,
            user_full_name: prof ? prof.full_name : null,
            vendor_source: vs,
            expires_at: m.expires_at || null,
            seed_public_released_at: m.seed_public_released_at || null,
            seed_public_released: !!(m.seed_public_released_at),
            remaining_days: remainingDays,
            is_paid: !isSeed,
            is_platform: isPlatform,
            is_seed: isSeed,
            is_active: m.is_active !== false,
            verified: !!m.verified,
            location: m.location || null,
            created_at: m.created_at || null,
            subscription: subRow ? {
                id: subRow.id,
                plan_id: subRow.plan_id,
                plan_name: plan ? plan.name : null,
                plan_key: plan ? plan.plan_key : null,
                price: plan ? plan.price : null,
                start_date: subRow.start_date,
                end_date: subRow.end_date,
                status: subRow.status
            } : null
        };
    });
}

// GET /api/admin/manufacturers — 全部廠商（含轉正後）+ 綁定帳號與訂閱摘要
app.get('/api/admin/manufacturers', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const vendorSource = (req.query.vendor_source || '').trim();
        const subFilter = (req.query.subscription || '').trim();
        const q = (req.query.q || '').trim().toLowerCase();
        let query = supabase
            .from('manufacturers')
            .select('id, name, user_id, vendor_source, expires_at, is_active, location, verified, created_at, seed_public_released_at')
            .order('created_at', { ascending: false });
        if (vendorSource === 'seed') query = query.eq('vendor_source', 'seed');
        else if (vendorSource === 'platform') query = query.eq('vendor_source', 'platform');
        const { data: rows, error } = await query;
        if (error) {
            if (error.code === '42703') return res.status(500).json({ error: '請先執行 docs/add-manufacturers-vendor-source.sql 與 add-manufacturers-expires-at.sql' });
            console.error('GET /api/admin/manufacturers:', error);
            return res.status(500).json({ error: error.message || '查詢失敗' });
        }
        let items = await enrichAdminManufacturerRows(rows || []);
        if (vendorSource === 'paid') items = items.filter((m) => !m.is_seed && !m.is_platform);
        if (q) {
            items = items.filter((m) => {
                const name = (m.name || '').toLowerCase();
                const email = (m.user_email || '').toLowerCase();
                return name.includes(q) || email.includes(q);
            });
        }
        if (subFilter === 'active') items = items.filter((m) => m.subscription && m.subscription.end_date);
        else if (subFilter === 'none') items = items.filter((m) => !m.subscription);
        res.json({ items });
    } catch (e) {
        console.error('GET /api/admin/manufacturers 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/admin/user-subscriptions — 管理員為帳號開通／換方案訂閱（帳期與方案價）
app.post('/api/admin/user-subscriptions', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const body = req.body || {};
        const userId = (body.user_id || '').trim();
        if (!userId) return res.status(400).json({ error: '請提供 user_id' });
        const { data: prof } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
        if (!prof) return res.status(404).json({ error: '找不到該用戶' });
        let planId = (body.plan_id || '').trim() || null;
        const planKey = (body.plan_key || '').trim() || null;
        if (!planId && planKey) {
            const { data: planByKey } = await supabase.from('subscription_plans').select('id').eq('plan_key', planKey).maybeSingle();
            if (!planByKey) return res.status(400).json({ error: '找不到方案 plan_key：' + planKey });
            planId = planByKey.id;
        }
        if (!planId) return res.status(400).json({ error: '請提供 plan_id 或 plan_key' });
        const { data: plan } = await supabase.from('subscription_plans').select('id, name, price, duration_months').eq('id', planId).single();
        if (!plan) return res.status(404).json({ error: '找不到訂閱方案' });
        const start = body.start_date ? new Date(body.start_date) : new Date();
        if (isNaN(start.getTime())) return res.status(400).json({ error: 'start_date 格式無效' });
        let end;
        if (body.end_date) {
            end = new Date(body.end_date);
            if (isNaN(end.getTime())) return res.status(400).json({ error: 'end_date 格式無效' });
        } else {
            end = new Date(start);
            const months = parseInt(plan.duration_months, 10) || 1;
            end.setMonth(end.getMonth() + months);
        }
        if (end <= start) return res.status(400).json({ error: '到期日必須晚於開始日' });
        const expireOthers = body.expire_other_active !== false;
        if (expireOthers) {
            await supabase
                .from('user_subscriptions')
                .update({ status: 'expired' })
                .eq('user_id', userId)
                .eq('status', 'active');
        }
        const { data: inserted, error: insErr } = await supabase
            .from('user_subscriptions')
            .insert({
                user_id: userId,
                plan_id: plan.id,
                start_date: start.toISOString(),
                end_date: end.toISOString(),
                status: 'active',
                auto_renew: false
            })
            .select('id, user_id, start_date, end_date, status, plan_id')
            .single();
        if (insErr) {
            console.error('POST /api/admin/user-subscriptions:', insErr);
            return res.status(500).json({ error: insErr.message || '建立訂閱失敗' });
        }
        try {
            await syncMembershipCatalogVisibility(userId);
        } catch (syncErr) {
            console.warn('syncMembershipCatalogVisibility:', syncErr && syncErr.message);
        }
        const currentLevel = await readProfileMemberLevel(userId);
        if (!isPaidMemberLevel(currentLevel)) {
            const levelFromPlan = (plan.name && ['進階', '尊榮', 'VIP'].includes(plan.name)) ? plan.name : '進階';
            await supabase.from('profiles').update({ member_level: levelFromPlan }).eq('id', userId);
        }
        res.json({
            success: true,
            subscription: {
                ...inserted,
                plan_name: plan.name,
                price: plan.price
            },
            message: `已開通「${plan.name}」（${plan.price} 元），到期 ${end.toISOString().slice(0, 10)}`
        });
    } catch (e) {
        console.error('POST /api/admin/user-subscriptions 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/user-subscriptions/:id — 管理員調整訂閱到期日或狀態
app.patch('/api/admin/user-subscriptions/:id', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const subId = (req.params.id || '').trim();
        if (!subId) return res.status(400).json({ error: '缺少訂閱 id' });
        const { data: existing } = await supabase.from('user_subscriptions').select('id, user_id').eq('id', subId).maybeSingle();
        if (!existing) return res.status(404).json({ error: '找不到訂閱紀錄' });
        const body = req.body || {};
        const updates = {};
        if (body.end_date !== undefined) {
            if (body.end_date === null || body.end_date === '') return res.status(400).json({ error: '請提供有效 end_date' });
            const end = new Date(body.end_date);
            if (isNaN(end.getTime())) return res.status(400).json({ error: 'end_date 格式無效' });
            updates.end_date = end.toISOString();
        }
        if (body.status !== undefined) {
            const st = String(body.status).trim();
            if (!['active', 'expired', 'cancelled'].includes(st)) return res.status(400).json({ error: 'status 僅可為 active、expired、cancelled' });
            updates.status = st;
        }
        if (body.plan_id !== undefined) {
            const pid = String(body.plan_id).trim();
            const { data: plan } = await supabase.from('subscription_plans').select('id').eq('id', pid).maybeSingle();
            if (!plan) return res.status(400).json({ error: '找不到方案' });
            updates.plan_id = pid;
        }
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: '無可更新欄位' });
        const { data: updated, error: updErr } = await supabase
            .from('user_subscriptions')
            .update(updates)
            .eq('id', subId)
            .select('id, user_id, start_date, end_date, status, plan_id, subscription_plans(name, price, plan_key)')
            .single();
        if (updErr) {
            console.error('PATCH /api/admin/user-subscriptions:', updErr);
            return res.status(500).json({ error: updErr.message || '更新失敗' });
        }
        try {
            await syncMembershipCatalogVisibility(existing.user_id);
        } catch (syncErr) {
            console.warn('syncMembershipCatalogVisibility:', syncErr && syncErr.message);
        }
        const plan = updated.subscription_plans || {};
        res.json({
            success: true,
            subscription: {
                id: updated.id,
                user_id: updated.user_id,
                start_date: updated.start_date,
                end_date: updated.end_date,
                status: updated.status,
                plan_id: updated.plan_id,
                plan_name: plan.name,
                price: plan.price,
                plan_key: plan.plan_key
            }
        });
    } catch (e) {
        console.error('PATCH /api/admin/user-subscriptions 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

async function enrichAdminIndustrySupplierRows(rows) {
    const userIds = [...new Set((rows || []).map((r) => r.user_id).filter(Boolean))];
    const emailByUser = {};
    const subByUser = {};
    const catalogBySupplier = {};
    const now = new Date().toISOString();
    if (userIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, email, full_name').in('id', userIds);
        (profs || []).forEach((p) => { emailByUser[p.id] = p; });
        const { data: subs } = await supabase
            .from('user_subscriptions')
            .select('id, user_id, end_date, status, subscription_plans(name, price, plan_key)')
            .in('user_id', userIds)
            .eq('status', 'active')
            .gt('end_date', now)
            .order('end_date', { ascending: false });
        (subs || []).forEach((s) => { if (!subByUser[s.user_id]) subByUser[s.user_id] = s; });
    }
    const supplierIds = (rows || []).map((r) => r.id);
    if (supplierIds.length) {
        const { data: catRows } = await supabase
            .from('supplier_catalog_items')
            .select('industry_supplier_id, is_active')
            .in('industry_supplier_id', supplierIds);
        (catRows || []).forEach((c) => {
            if (!catalogBySupplier[c.industry_supplier_id]) catalogBySupplier[c.industry_supplier_id] = { total: 0, active: 0 };
            catalogBySupplier[c.industry_supplier_id].total += 1;
            if (c.is_active !== false) catalogBySupplier[c.industry_supplier_id].active += 1;
        });
    }
    return (rows || []).map((s) => {
        const prof = s.user_id ? emailByUser[s.user_id] : null;
        const subRow = s.user_id ? subByUser[s.user_id] : null;
        const plan = subRow && subRow.subscription_plans ? subRow.subscription_plans : null;
        const counts = catalogBySupplier[s.id] || { total: 0, active: 0 };
        return {
            id: s.id,
            name: s.name,
            description: s.description || null,
            contact_json: s.contact_json || {},
            user_id: s.user_id || null,
            user_email: prof ? prof.email : null,
            user_full_name: prof ? prof.full_name : null,
            is_active: s.is_active !== false,
            created_at: s.created_at || null,
            catalog_total: counts.total,
            catalog_active: counts.active,
            subscription: subRow ? {
                id: subRow.id,
                plan_name: plan ? plan.name : null,
                price: plan ? plan.price : null,
                end_date: subRow.end_date
            } : null
        };
    });
}

// GET /api/admin/industry-suppliers — 產業供應商列表（含綁定帳號、目錄數、訂閱）
app.get('/api/admin/industry-suppliers', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        if (!(await supplierCatalogTablesReady())) {
            return res.status(503).json({ error: '請先執行 docs/add-industry-supplier-catalog.sql', items: [] });
        }
        const q = (req.query.q || '').trim().toLowerCase();
        const bound = (req.query.bound || '').trim();
        let query = supabase
            .from('industry_suppliers')
            .select('id, name, description, contact_json, user_id, is_active, created_at')
            .order('created_at', { ascending: false });
        if (bound === 'yes') query = query.not('user_id', 'is', null);
        else if (bound === 'no') query = query.is('user_id', null);
        const { data: rows, error } = await query;
        if (error) {
            if (error.code === '42703') {
                return res.status(503).json({ error: '請先執行 docs/add-membership-catalog-visibility.sql（industry_suppliers.user_id）', items: [] });
            }
            console.error('GET /api/admin/industry-suppliers:', error);
            return res.status(500).json({ error: error.message || '查詢失敗' });
        }
        let items = await enrichAdminIndustrySupplierRows(rows || []);
        if (q) {
            items = items.filter((s) => {
                const name = (s.name || '').toLowerCase();
                const email = (s.user_email || '').toLowerCase();
                return name.includes(q) || email.includes(q);
            });
        }
        res.json({ items });
    } catch (e) {
        console.error('GET /api/admin/industry-suppliers 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/admin/industry-suppliers — 管理員建立供應商並可綁定帳號
app.post('/api/admin/industry-suppliers', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        if (!(await supplierCatalogTablesReady())) {
            return res.status(503).json({ error: '請先執行 docs/add-industry-supplier-catalog.sql' });
        }
        const body = req.body || {};
        const name = (body.name || '').trim();
        if (!name) return res.status(400).json({ error: '請填寫公司名稱' });
        const userId = (body.user_id || '').trim() || null;
        if (userId) {
            const { data: prof } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
            if (!prof) return res.status(404).json({ error: '找不到該用戶' });
            const { data: taken } = await supabase.from('industry_suppliers').select('id').eq('user_id', userId).maybeSingle();
            if (taken) return res.status(400).json({ error: '該帳號已綁定其他產業供應商' });
        }
        const contact_json = body.contact_json && typeof body.contact_json === 'object' ? body.contact_json : {
            email: (body.email || '').trim(),
            phone: (body.phone || '').trim(),
            website: (body.website || body.url || '').trim()
        };
        const { data: inserted, error } = await supabase
            .from('industry_suppliers')
            .insert({
                user_id: userId,
                name,
                description: (body.description || '').trim() || null,
                contact_json,
                is_active: body.is_active !== false
            })
            .select('id, name, user_id, is_active')
            .single();
        if (error) {
            if (error.code === '42703') {
                return res.status(503).json({ error: '請先執行 docs/add-membership-catalog-visibility.sql（industry_suppliers.user_id）' });
            }
            console.error('POST /api/admin/industry-suppliers:', error);
            return res.status(500).json({ error: error.message || '建立失敗' });
        }
        res.status(201).json({ supplier: inserted, message: '已建立產業供應商' });
    } catch (e) {
        console.error('POST /api/admin/industry-suppliers 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/industry-suppliers/:id — 管理員更新供應商（含重新綁定帳號）
app.patch('/api/admin/industry-suppliers/:id', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const supplierId = (req.params.id || '').trim();
        if (!supplierId) return res.status(400).json({ error: '缺少供應商 id' });
        const { data: row } = await supabase.from('industry_suppliers').select('id').eq('id', supplierId).maybeSingle();
        if (!row) return res.status(404).json({ error: '找不到該供應商' });
        const body = req.body || {};
        const updates = { updated_at: new Date().toISOString() };
        if (body.name !== undefined && String(body.name).trim()) updates.name = String(body.name).trim();
        if (body.description !== undefined) updates.description = (body.description && String(body.description).trim()) ? String(body.description).trim() : null;
        if (body.is_active !== undefined) updates.is_active = !!body.is_active;
        if (body.contact_json !== undefined && typeof body.contact_json === 'object') updates.contact_json = body.contact_json;
        if (body.user_id !== undefined) {
            const userId = body.user_id === null || body.user_id === '' ? null : String(body.user_id).trim();
            if (userId) {
                const { data: prof } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
                if (!prof) return res.status(404).json({ error: '找不到該用戶' });
                const { data: taken } = await supabase
                    .from('industry_suppliers')
                    .select('id')
                    .eq('user_id', userId)
                    .neq('id', supplierId)
                    .maybeSingle();
                if (taken) return res.status(400).json({ error: '該帳號已綁定其他產業供應商' });
            }
            updates.user_id = userId;
        }
        if (Object.keys(updates).length <= 1) return res.status(400).json({ error: '無可更新欄位' });
        const { data: updated, error } = await supabase
            .from('industry_suppliers')
            .update(updates)
            .eq('id', supplierId)
            .select('id, name, user_id, is_active, description, contact_json')
            .single();
        if (error) {
            console.error('PATCH /api/admin/industry-suppliers:', error);
            return res.status(500).json({ error: error.message || '更新失敗' });
        }
        res.json({ supplier: updated, message: '已更新' });
    } catch (e) {
        console.error('PATCH /api/admin/industry-suppliers 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/admin/manufacturers/:id/vendor-assets — 管理員代為上傳該廠商素材（數位版型）
app.post('/api/admin/manufacturers/:id/vendor-assets', upload.single('image'), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const manufacturerId = (req.params.id || '').trim();
        if (!manufacturerId) return res.status(400).json({ error: '請傳入廠商 id' });
        const { data: mfr } = await supabase.from('manufacturers').select('id, vendor_source').eq('id', manufacturerId).single();
        if (!mfr) return res.status(404).json({ error: '找不到該廠商' });
        const body = req.body || {};
        const categoryKey = (body.category_key || '').trim();
        if (!categoryKey) return res.status(400).json({ error: '請選擇主分類（category_key）' });
        const subcategoryKey = (body.subcategory_key || '').trim() || null;
        const title = (body.title || '').trim() || null;
        const description = (body.description || '').trim() || null;
        const styleKey = (body.style_key || '').trim() || null;
        const materialKey = (body.material_key || '').trim() || null;
        let file = await vendorAssetFileFromMulter(req.file);
        if (!file) return res.status(400).json({ error: '請上傳素材圖片' });
        const { publicUrl } = await uploadToSupabaseStorage('custom-products', `vendor-assets/${manufacturerId}`, file);
        const defaultPublic = mfr.vendor_source === 'seed' ? false : true;
        const isPublic = body.is_public !== undefined ? parseTruthyBody(body.is_public) : defaultPublic;
        const insertPayload = {
            manufacturer_id: manufacturerId,
            category_key: categoryKey,
            subcategory_key: subcategoryKey,
            title: title,
            description: description,
            image_url: publicUrl,
            usage_type: 'reference_only',
            is_public: isPublic,
            sort_order: (body.sort_order != null && !isNaN(body.sort_order)) ? parseInt(body.sort_order, 10) : 0
        };
        if (styleKey) insertPayload.style_key = styleKey;
        if (materialKey) insertPayload.material_key = materialKey;
        insertPayload.asset_kind = normalizeVendorAssetKind(body.asset_kind);
        insertPayload[VENDOR_ASSET_PLATFORM_MANAGED_COL] = true;
        insertPayload[VENDOR_ASSET_MEMBERSHIP_HIDE_COL] = false;
        const { data: inserted, error } = await supabase
            .from('vendor_assets')
            .insert(insertPayload)
            .select('id, manufacturer_id, category_key, subcategory_key, title, description, image_url, usage_type, sort_order, asset_kind, created_at')
            .single();
        if (error) {
            if (error.code === '42P01') return res.status(500).json({ error: '請先執行 docs/vendor-assets-schema.sql 建立 vendor_assets 表' });
            if (error.code === '42703' && String(error.message || '').includes('asset_kind')) {
                delete insertPayload.asset_kind;
                const retry = await supabase.from('vendor_assets').insert(insertPayload)
                    .select('id, manufacturer_id, category_key, subcategory_key, title, description, image_url, usage_type, sort_order, created_at').single();
                if (retry.error) return res.status(500).json({ error: '請先執行 docs/add-vendor-asset-kind.sql 新增 asset_kind 欄位' });
                return res.status(201).json(retry.data);
            }
            if (error.code === '42703') return res.status(500).json({ error: '請先執行 docs/add-vendor-assets-style-material.sql 新增造型/材質欄位' });
            console.error('POST /api/admin/manufacturers/:id/vendor-assets:', error);
            return res.status(500).json({ error: error.message || '新增素材失敗' });
        }
        res.status(201).json(inserted);
    } catch (e) {
        console.error('POST /api/admin/manufacturers/:id/vendor-assets 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/manufacturers/:id/vendor-assets — 管理員列出該廠商全部素材（含下架）
app.get('/api/admin/manufacturers/:id/vendor-assets', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const manufacturerId = (req.params.id || '').trim();
        if (!manufacturerId) return res.status(400).json({ error: '請傳入廠商 id' });
        const { data: rows, error } = await supabase
            .from('vendor_assets')
            .select('id, title, image_url, asset_kind, is_public, category_key, sort_order, created_at')
            .eq('manufacturer_id', manufacturerId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (error) {
            if (error.code === '42P01') return res.json({ items: [] });
            return res.status(500).json({ error: error.message || '查詢失敗' });
        }
        res.json({ items: rows || [] });
    } catch (e) {
        console.error('GET /api/admin/manufacturers/:id/vendor-assets:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/vendor-assets/:id — 管理員更新素材（上下架等）
app.patch('/api/admin/vendor-assets/:id', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const assetId = (req.params.id || '').trim();
        if (!assetId) return res.status(400).json({ error: '請傳入素材 id' });
        const body = req.body || {};
        const updates = { updated_at: new Date().toISOString() };
        if (body.is_public !== undefined) updates.is_public = !!parseTruthyBody(body.is_public);
        if (Object.keys(updates).length <= 1) return res.status(400).json({ error: '無可更新的欄位' });
        const { data: updated, error } = await supabase
            .from('vendor_assets')
            .update(updates)
            .eq('id', assetId)
            .select('id, manufacturer_id, title, image_url, asset_kind, is_public')
            .single();
        if (error) {
            console.error('PATCH /api/admin/vendor-assets/:id:', error);
            return res.status(500).json({ error: error.message || '更新失敗' });
        }
        if (!updated) return res.status(404).json({ error: '找不到該素材' });
        res.json(updated);
    } catch (e) {
        console.error('PATCH /api/admin/vendor-assets/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/payment-config — 金流設定（僅管理員），回傳時密鑰以尾四碼遮蔽
app.get('/api/admin/payment-config', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const { data: rows } = await supabase.from('payment_config').select('key, value');
        const obj = {};
        (rows || []).forEach(r => { obj[r.key] = r.value; });
        const mask = (v) => (v && v.length > 4) ? '****' + v.slice(-4) : (v ? '****' : '');
        res.json({
            ecpay_merchant_id: obj.ecpay_merchant_id || '',
            ecpay_hash_key: obj.ecpay_hash_key ? mask(obj.ecpay_hash_key) : '',
            ecpay_hash_key_set: !!(obj.ecpay_hash_key && obj.ecpay_hash_key.length > 0),
            ecpay_hash_iv: obj.ecpay_hash_iv ? mask(obj.ecpay_hash_iv) : '',
            ecpay_hash_iv_set: !!(obj.ecpay_hash_iv && obj.ecpay_hash_iv.length > 0),
            ecpay_use_production: obj.ecpay_use_production === '1' || obj.ecpay_use_production === 'true',
            paypal_client_id: obj.paypal_client_id || '',
            paypal_client_secret: obj.paypal_client_secret ? mask(obj.paypal_client_secret) : '',
            paypal_client_secret_set: !!(obj.paypal_client_secret && obj.paypal_client_secret.length > 0),
            paypal_sandbox: obj.paypal_sandbox !== '0' && obj.paypal_sandbox !== 'false'
        });
    } catch (e) {
        console.error('GET /api/admin/payment-config:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/payment-config — 儲存金流設定（僅管理員）
app.patch('/api/admin/payment-config', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const body = req.body || {};
        const upsert = async (key, value) => {
            if (value === undefined || value === null) return;
            await supabase.from('payment_config').upsert({ key, value: String(value).trim(), updated_at: new Date().toISOString() }, { onConflict: 'key' });
        };
        if (body.ecpay_merchant_id !== undefined) await upsert('ecpay_merchant_id', body.ecpay_merchant_id);
        if (body.ecpay_hash_key !== undefined) await upsert('ecpay_hash_key', body.ecpay_hash_key);
        if (body.ecpay_hash_iv !== undefined) await upsert('ecpay_hash_iv', body.ecpay_hash_iv);
        if (body.ecpay_use_production !== undefined) await upsert('ecpay_use_production', body.ecpay_use_production ? '1' : '0');
        if (body.paypal_client_id !== undefined) await upsert('paypal_client_id', body.paypal_client_id);
        if (body.paypal_client_secret !== undefined) await upsert('paypal_client_secret', body.paypal_client_secret);
        if (body.paypal_sandbox !== undefined) await upsert('paypal_sandbox', body.paypal_sandbox ? '1' : '0');
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/admin/payment-config:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ── 社群媒體帳號（公開讀取 + 後台管理）───────────────────────────────
const SOCIAL_KEYS = ['facebook', 'instagram', 'threads', 'twitter', 'line', 'youtube', 'pinterest'];
// GET /api/config/social-links — 公開：回傳社群帳號（供前台分享列）
app.get('/api/config/social-links', async (req, res) => {
    try {
        const dbKeys = SOCIAL_KEYS.map(k => 'social_' + k);
        const { data: rows } = await supabase.from('payment_config').select('key, value').in('key', dbKeys);
        const out = {};
        (rows || []).forEach(r => { out[r.key.replace('social_', '')] = r.value || ''; });
        res.json(out);
    } catch (e) {
        res.json({});
    }
});
// GET /api/admin/social-links — 後台：取得社群帳號（管理員）
app.get('/api/admin/social-links', async (req, res) => {
    try {
        const user = await requireAdmin(req, res); if (!user) return;
        const dbKeys = SOCIAL_KEYS.map(k => 'social_' + k);
        const { data: rows } = await supabase.from('payment_config').select('key, value').in('key', dbKeys);
        const out = {};
        (rows || []).forEach(r => { out[r.key.replace('social_', '')] = r.value || ''; });
        res.json(out);
    } catch (e) {
        console.error('GET /api/admin/social-links:', e);
        res.status(500).json({ error: e.message });
    }
});
// PATCH /api/admin/social-links — 後台：儲存社群帳號（管理員）
app.patch('/api/admin/social-links', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res); if (!user) return;
        const now = new Date().toISOString();
        const upserts = SOCIAL_KEYS
            .filter(k => req.body && req.body[k] !== undefined)
            .map(k => ({ key: 'social_' + k, value: (req.body[k] || '').trim(), updated_at: now }));
        if (upserts.length === 0) return res.json({ ok: true });
        const { error } = await supabase.from('payment_config').upsert(upserts, { onConflict: 'key' });
        if (error) return res.status(500).json({ error: error.message });
        res.json({ ok: true });
    } catch (e) {
        console.error('PATCH /api/admin/social-links:', e);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/config/ga4 — 公開：回傳 GA4 衡量 ID（供前台載入 gtag，未設定則回傳空）
app.get('/api/config/ga4', async (req, res) => {
    try {
        const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'ga4_measurement_id').maybeSingle();
        const measurementId = (row && row.value && String(row.value).trim()) ? String(row.value).trim() : '';
        res.set('Cache-Control', 'public, max-age=300');
        res.json({ measurementId });
    } catch (e) {
        res.set('Cache-Control', 'public, max-age=60');
        res.json({ measurementId: '' });
    }
});

// GET /api/admin/ga4 — 後台：取得 GA4 設定（僅管理員）
app.get('/api/admin/ga4', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'ga4_measurement_id').maybeSingle();
        const measurementId = (row && row.value && String(row.value).trim()) ? String(row.value).trim() : '';
        res.json({ measurementId });
    } catch (e) {
        console.error('GET /api/admin/ga4:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/ga4 — 後台：儲存 GA4 衡量 ID（僅管理員）
app.patch('/api/admin/ga4', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const measurementId = (req.body && req.body.measurementId != null) ? String(req.body.measurementId).trim() : '';
        await supabase.from('payment_config').upsert(
            { key: 'ga4_measurement_id', value: measurementId, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
        );
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/admin/ga4:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/users/:id — 用戶管理：手動編輯會員等級、點數，僅管理員
app.patch('/api/admin/users/:id', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const userId = req.params.id;
        if (!userId) return res.status(400).json({ error: '缺少用戶 id' });
        const body = req.body || {};
        const memberLevel = body.member_level != null ? String(body.member_level).trim() : null;
        const role = body.role != null ? String(body.role).trim() : null;
        const points = body.points != null ? parseInt(body.points, 10) : null;
        const allowedRoles = ['user', 'admin', 'tester'];
        if (role !== null && role !== '' && allowedRoles.indexOf(role) === -1) {
            return res.status(400).json({ error: '角色僅可為：user、admin、tester' });
        }

        if (memberLevel !== null) {
            const { data: prof, error: profErr } = await supabase
                .from('profiles')
                .select('id').eq('id', userId).single();
            if (profErr || !prof) return res.status(404).json({ error: '找不到該用戶' });
            const { error: updateErr } = await supabase
                .from('profiles')
                .update({ member_level: memberLevel || '一般' })
                .eq('id', userId);
            if (updateErr) {
                if (updateErr.code === '42703') {
                    return res.status(400).json({ error: '請先執行 docs/admin-user-management-profiles-migration.sql 新增 member_level 欄位' });
                }
                console.error('PATCH /api/admin/users profiles:', updateErr);
                return res.status(500).json({ error: '更新會員等級失敗' });
            }
            try {
                await syncMembershipCatalogVisibility(userId);
            } catch (syncErr) {
                console.warn('syncMembershipCatalogVisibility after member_level:', syncErr && syncErr.message);
            }
        }

        if (role !== null && role !== '') {
            const { data: prof, error: profErr } = await supabase
                .from('profiles')
                .select('id').eq('id', userId).single();
            if (profErr || !prof) return res.status(404).json({ error: '找不到該用戶' });
            const { error: roleErr } = await supabase
                .from('profiles')
                .update({ role })
                .eq('id', userId);
            if (roleErr) {
                console.error('PATCH /api/admin/users profiles role:', roleErr);
                return res.status(500).json({ error: '更新角色失敗（請確認已執行 docs/migration-add-tester-role.sql）' });
            }
        }

        if (points !== null && !isNaN(points) && points >= 0) {
            const { data: existing } = await supabase.from('user_credits').select('user_id, balance').eq('user_id', userId).maybeSingle();
            if (existing) {
                const { error: credErr } = await supabase
                    .from('user_credits')
                    .update({ balance: points, updated_at: new Date().toISOString() })
                    .eq('user_id', userId);
                if (credErr) {
                    console.error('PATCH /api/admin/users user_credits update:', credErr);
                    return res.status(500).json({ error: '更新點數失敗' });
                }
            } else {
                const { error: insErr } = await supabase
                    .from('user_credits')
                    .insert({ user_id: userId, balance: points, total_earned: points, total_spent: 0 });
                if (insErr) {
                    console.error('PATCH /api/admin/users user_credits insert:', insErr);
                    return res.status(500).json({ error: '寫入點數失敗' });
                }
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/admin/users 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// 用「請求中的管理員 JWT」建 Supabase 用戶端，查 RLS 表時以該用戶身份查詢，RLS 才會通過
function supabaseWithAuth(req) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.replace(/^\s*Bearer\s+/i, '').trim();
    if (!token) return supabase;
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
    if (!anonKey) return supabase;
    return createClient(process.env.SUPABASE_URL, anonKey, {
        global: { headers: { Authorization: 'Bearer ' + token } }
    });
}

// GET /api/admin/subscription-plans — 列出所有方案（含停用），用全域 supabase（service_role 可繞過 RLS）
app.get('/api/admin/subscription-plans', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const { data: rows, error } = await supabase
            .from('subscription_plans')
            .select(SUBSCRIPTION_PLANS_SELECT_COLUMNS)
            .order('sort_order', { ascending: true });
        if (error) {
            console.error('GET /api/admin/subscription-plans:', error);
            const msg = error.message || '';
            const hint = (msg.includes('does not exist') || msg.includes('relation'))
                ? '請在 Supabase SQL Editor 執行 docs/subscriptions-schema.sql 建立 subscription_plans 表。'
                : '';
            return res.status(500).json({
                error: '查詢方案失敗',
                details: msg,
                hint: hint
            });
        }
        res.json({ plans: rows || [] });
    } catch (e) {
        console.error('GET /api/admin/subscription-plans 異常:', e);
        res.status(500).json({ error: '系統錯誤', details: e.message });
    }
});

// GET /api/subscription-plans — 公開：僅列出啟用中方案，供前台 subscription-plans.html 同步顯示
app.get('/api/subscription-plans', async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('subscription_plans')
            .select(SUBSCRIPTION_PLANS_SELECT_COLUMNS)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        if (error) {
            console.error('GET /api/subscription-plans:', error);
            return res.status(500).json({ error: '查詢失敗', plans: [] });
        }
        res.set('Cache-Control', 'public, max-age=60');
        res.json({ plans: rows || [] });
    } catch (e) {
        console.error('GET /api/subscription-plans 異常:', e);
        res.status(500).json({ error: '系統錯誤', plans: [] });
    }
});

// PATCH /api/admin/subscription-plans/:id — 更新單一方案（名稱、月費、點數、排序、啟用）
app.patch('/api/admin/subscription-plans/:id', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const id = req.params.id;
        const body = req.body || {};
        const updates = {};
        if (body.name !== undefined) updates.name = String(body.name).trim();
        if (body.price !== undefined) updates.price = parseInt(body.price, 10);
        if (body.duration_months !== undefined) updates.duration_months = parseInt(body.duration_months, 10);
        if (body.credits_monthly !== undefined) updates.credits_monthly = parseInt(body.credits_monthly, 10);
        if (body.sort_order !== undefined) updates.sort_order = parseInt(body.sort_order, 10);
        if (body.is_active !== undefined) updates.is_active = !!body.is_active;
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: '無可更新欄位' });
        const { error: updErr } = await supabase.from('subscription_plans').update(updates).eq('id', id);
        if (updErr) {
            console.error('PATCH /api/admin/subscription-plans:', updErr);
            return res.status(500).json({ error: '更新方案失敗', details: updErr.message });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/admin/subscription-plans 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/points-info — 公開點數說明（供前台 credits 頁顯示「用盡後加購」單價，與後台規則同步）
app.get('/api/points-info', async (req, res) => {
    try {
        const { data: rows } = await supabase.from('payment_config').select('key, value').eq('key', 'points_listing_per_category');
        const val = (rows && rows[0]) ? rows[0].value : null;
        res.set('Cache-Control', 'public, max-age=300');
        res.json({ points_listing_per_category: parseInt(val, 10) || 200 });
    } catch (e) {
        console.error('GET /api/points-info:', e);
        res.status(500).json({ points_listing_per_category: 200 });
    }
});

// GET /api/admin/points-config — 點數規則（管理員可調；測試員可讀，供 AI 工具頁顯示）
app.get('/api/admin/points-config', async (req, res) => {
    try {
        const adminUser = await requireAdminOrTester(req, res);
        if (!adminUser) return;
        const { data: rows } = await supabase.from('payment_config').select('key, value').in('key', [
            'points_text_to_image', 'points_image_to_image', 'points_ai_upscale', 'points_ai_sketch', 'points_ai_structure', 'points_ai_style', 'points_ai_style_transfer', 'points_ai_erase', 'points_ai_inpaint', 'points_ai_outpaint', 'points_ai_remove_bg', 'points_ai_replace_bg_relight', 'points_scene_simulate', 'points_pattern_extract', 'points_pattern_extract_per_extra_mp', 'points_translation', 'points_listing_per_category',
            'grant_welcome_points_on_register', 'welcome_points_amount', 'grant_monthly_points_enabled', 'monthly_points_free_tier'
        ]);
        const obj = {};
        (rows || []).forEach(r => { obj[r.key] = r.value; });
        const grantWelcomeOn = (obj.grant_welcome_points_on_register || '').toString() === '1' || (obj.grant_welcome_points_on_register || '').toString().toLowerCase() === 'true';
        const grantMonthlyOn = (obj.grant_monthly_points_enabled || '').toString() === '1' || (obj.grant_monthly_points_enabled || '').toString().toLowerCase() === 'true';
        res.json({
            grant_welcome_points_on_register: grantWelcomeOn,
            welcome_points_amount: parseInt(obj.welcome_points_amount, 10) || 0,
            grant_monthly_points_enabled: grantMonthlyOn,
            monthly_points_free_tier: parseInt(obj.monthly_points_free_tier, 10) || 150,
            points_text_to_image: parseInt(obj.points_text_to_image, 10) || 15,
            points_image_to_image: parseInt(obj.points_image_to_image, 10) || 20,
            points_ai_upscale: parseInt(obj.points_ai_upscale, 10) || 10,
            points_ai_sketch: parseInt(obj.points_ai_sketch, 10) || 20,
            points_ai_structure: parseInt(obj.points_ai_structure, 10) || 20,
            points_ai_style: parseInt(obj.points_ai_style, 10) || 20,
            points_ai_style_transfer: parseInt(obj.points_ai_style_transfer, 10) || 30,
            points_ai_erase: parseInt(obj.points_ai_erase, 10) || 20,
            points_ai_inpaint: parseInt(obj.points_ai_inpaint, 10) || 20,
            points_ai_outpaint: parseInt(obj.points_ai_outpaint, 10) || 15,
            points_ai_remove_bg: parseInt(obj.points_ai_remove_bg, 10) || 15,
            points_ai_replace_bg_relight: parseInt(obj.points_ai_replace_bg_relight, 10) || 30,
            points_scene_simulate: parseInt(obj.points_scene_simulate, 10) || 20,
            points_pattern_extract: parseInt(obj.points_pattern_extract, 10) || 20,
            points_pattern_extract_per_extra_mp: parseInt(obj.points_pattern_extract_per_extra_mp, 10) || 10,
            points_translation: parseInt(obj.points_translation, 10) || 1,
            points_listing_per_category: parseInt(obj.points_listing_per_category, 10) || 200
        });
    } catch (e) {
        console.error('GET /api/admin/points-config:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/points-config — 儲存點數規則
app.patch('/api/admin/points-config', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const body = req.body || {};
        const upsert = async (key, value) => {
            await supabase.from('payment_config').upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
        };
        if (body.points_text_to_image !== undefined) await upsert('points_text_to_image', body.points_text_to_image);
        if (body.points_image_to_image !== undefined) await upsert('points_image_to_image', body.points_image_to_image);
        if (body.points_ai_upscale !== undefined) await upsert('points_ai_upscale', body.points_ai_upscale);
        if (body.points_ai_sketch !== undefined) await upsert('points_ai_sketch', body.points_ai_sketch);
        if (body.points_ai_structure !== undefined) await upsert('points_ai_structure', body.points_ai_structure);
        if (body.points_ai_style !== undefined) await upsert('points_ai_style', body.points_ai_style);
        if (body.points_ai_style_transfer !== undefined) await upsert('points_ai_style_transfer', body.points_ai_style_transfer);
        if (body.points_ai_erase !== undefined) await upsert('points_ai_erase', body.points_ai_erase);
        if (body.points_ai_inpaint !== undefined) await upsert('points_ai_inpaint', body.points_ai_inpaint);
        if (body.points_ai_outpaint !== undefined) await upsert('points_ai_outpaint', body.points_ai_outpaint);
        if (body.points_ai_remove_bg !== undefined) await upsert('points_ai_remove_bg', body.points_ai_remove_bg);
        if (body.points_ai_replace_bg_relight !== undefined) await upsert('points_ai_replace_bg_relight', body.points_ai_replace_bg_relight);
        if (body.points_scene_simulate !== undefined) await upsert('points_scene_simulate', body.points_scene_simulate);
        if (body.points_pattern_extract !== undefined) await upsert('points_pattern_extract', body.points_pattern_extract);
        if (body.points_pattern_extract_per_extra_mp !== undefined) await upsert('points_pattern_extract_per_extra_mp', body.points_pattern_extract_per_extra_mp);
        if (body.points_translation !== undefined) await upsert('points_translation', body.points_translation);
        if (body.points_listing_per_category !== undefined) await upsert('points_listing_per_category', body.points_listing_per_category);
        if (body.grant_welcome_points_on_register !== undefined) await upsert('grant_welcome_points_on_register', body.grant_welcome_points_on_register ? '1' : '0');
        if (body.welcome_points_amount !== undefined) await upsert('welcome_points_amount', body.welcome_points_amount);
        if (body.grant_monthly_points_enabled !== undefined) await upsert('grant_monthly_points_enabled', body.grant_monthly_points_enabled ? '1' : '0');
        if (body.monthly_points_free_tier !== undefined) await upsert('monthly_points_free_tier', body.monthly_points_free_tier);
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/admin/points-config:', e);
        const details = (e && (e.code || e.message)) ? String(e.code || e.message) : undefined;
        res.status(500).json({ error: '系統錯誤', details });
    }
});

// GET /api/admin/ai-config — AI 模型設定（僅管理員）：翻譯 + 讀圖/分析
app.get('/api/admin/ai-config', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const { data: rows } = await supabase.from('payment_config').select('key, value').in('key', ['gemini_model', 'gemini_model_read', 'gemini_model_tagging']);
        const byKey = (rows || []).reduce((o, r) => { o[r.key] = r.value?.trim?.(); return o; }, {});
        res.json({
            gemini_model: byKey.gemini_model || process.env.GEMINI_MODEL || GEMINI_MODEL_TRANSLATION_DEFAULT,
            gemini_model_read: byKey.gemini_model_read || process.env.GEMINI_MODEL_READ || GEMINI_MODEL_READ_DEFAULT,
            gemini_model_tagging: byKey.gemini_model_tagging || process.env.GEMINI_MODEL_TAGGING || visualSemantics.GEMINI_MODEL_TAGGING_DEFAULT,
            saved_in_db: {
                gemini_model: !!byKey.gemini_model,
                gemini_model_read: !!byKey.gemini_model_read,
                gemini_model_tagging: !!byKey.gemini_model_tagging
            }
        });
    } catch (e) {
        console.error('GET /api/admin/ai-config:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/ai-config — 儲存 AI 模型設定（僅管理員）
app.patch('/api/admin/ai-config', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const body = req.body || {};
        const now = new Date().toISOString();
        const upserts = [];
        if (body.gemini_model !== undefined) {
            upserts.push({ key: 'gemini_model', value: String(body.gemini_model).trim(), updated_at: now });
        }
        if (body.gemini_model_read !== undefined) {
            upserts.push({ key: 'gemini_model_read', value: String(body.gemini_model_read).trim(), updated_at: now });
        }
        if (body.gemini_model_tagging !== undefined) {
            upserts.push({ key: 'gemini_model_tagging', value: String(body.gemini_model_tagging).trim(), updated_at: now });
        }
        if (upserts.length === 0) {
            return res.status(400).json({ error: '無可儲存的欄位' });
        }
        const { error } = await supabase.from('payment_config').upsert(upserts, { onConflict: 'key' });
        if (error) {
            console.error('PATCH /api/admin/ai-config upsert:', error);
            return res.status(500).json({
                error: error.message || '寫入 payment_config 失敗',
                hint: error.code === '42P01' ? '請在 Supabase 執行 docs/payment-config-schema.sql' : undefined
            });
        }
        const keys = [...new Set(upserts.map((u) => u.key))];
        const { data: rows, error: readErr } = await supabase.from('payment_config').select('key, value').in('key', keys);
        if (readErr) {
            return res.status(500).json({ error: readErr.message || '儲存後讀取失敗' });
        }
        const byKey = (rows || []).reduce((o, r) => { o[r.key] = r.value?.trim?.(); return o; }, {});
        res.json({
            success: true,
            gemini_model: byKey.gemini_model ?? null,
            gemini_model_read: byKey.gemini_model_read ?? null,
            gemini_model_tagging: byKey.gemini_model_tagging ?? null
        });
    } catch (e) {
        console.error('PATCH /api/admin/ai-config:', e);
        res.status(500).json({ error: e.message || '系統錯誤' });
    }
});

// GET /api/admin/migrations — 資料庫 migration 狀態（需 SUPABASE_DB_URL + 管理員）
app.get('/api/admin/migrations', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        if (!DB_URL) {
            return res.json({
                db_connected: false,
                hint: '請在 Cloud Run／本機 .env 設定 SUPABASE_DB_URL（Supabase → Project Settings → Database → Connection string）後重啟服務。',
                migrations: []
            });
        }
        const pool = new Pool({ connectionString: DB_URL });
        const client = await pool.connect();
        try {
            const migrations = await adminMigrations.getMigrationStatuses(client);
            res.json({ db_connected: true, migrations });
        } finally {
            client.release();
            await pool.end();
        }
    } catch (e) {
        console.error('GET /api/admin/migrations:', e);
        res.status(500).json({ error: e.message || '查詢失敗' });
    }
});

// POST /api/admin/migrations/:id/run — 執行白名單 migration（僅管理員）
app.post('/api/admin/migrations/:id/run', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        if (!DB_URL) {
            return res.status(503).json({
                error: '未設定 SUPABASE_DB_URL，無法從網站執行 SQL',
                hint: '請在部署環境變數加入資料庫連線字串後重啟，或改至 Supabase SQL Editor 手動執行 docs/*.sql'
            });
        }
        const id = (req.params.id || '').trim();
        const pool = new Pool({ connectionString: DB_URL });
        const client = await pool.connect();
        try {
            const result = await adminMigrations.runMigrationById(id, client);
            res.json({ success: true, ...result });
        } finally {
            client.release();
            await pool.end();
        }
    } catch (e) {
        console.error('POST /api/admin/migrations/:id/run:', e);
        res.status(500).json({ error: e.message || '執行失敗' });
    }
});

// GET /api/admin/semantics-prompts — 視覺語意／標籤用 Gemini 系統提示詞（僅管理員）
app.get('/api/admin/semantics-prompts', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const keys = visualSemantics.SEMANTICS_PROMPT_KEYS;
        const defaults = visualSemantics.DEFAULT_PROMPTS;
        const { data: rows, error } = await supabase.from('payment_config').select('key, value').in('key', keys);
        if (error) {
            if (error.code === '42P01') {
                return res.status(500).json({ error: '請先執行 docs/payment-config-schema.sql 建立 payment_config 表' });
            }
            return res.status(500).json({ error: error.message || '查詢失敗' });
        }
        const byKey = (rows || []).reduce((o, r) => { o[r.key] = r.value != null ? String(r.value) : ''; return o; }, {});
        const saved_in_db = {};
        const out = {};
        keys.forEach((k) => {
            const dbVal = (byKey[k] || '').trim();
            saved_in_db[k] = !!dbVal;
            out[k] = dbVal || defaults[k] || '';
        });
        res.json({ ...out, defaults, saved_in_db });
    } catch (e) {
        console.error('GET /api/admin/semantics-prompts:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/semantics-prompts — 儲存視覺語意系統提示詞（僅管理員）
app.patch('/api/admin/semantics-prompts', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const body = req.body || {};
        const keys = visualSemantics.SEMANTICS_PROMPT_KEYS;
        const now = new Date().toISOString();
        const upserts = [];
        keys.forEach((k) => {
            if (body[k] !== undefined) {
                upserts.push({ key: k, value: String(body[k]).trim(), updated_at: now });
            }
        });
        if (upserts.length === 0) {
            return res.status(400).json({ error: '無可儲存的提示詞欄位' });
        }
        const { error } = await supabase.from('payment_config').upsert(upserts, { onConflict: 'key' });
        if (error) {
            console.error('PATCH /api/admin/semantics-prompts:', error);
            return res.status(500).json({
                error: error.message || '寫入失敗',
                hint: error.code === '42P01' ? '請先執行 docs/payment-config-schema.sql' : undefined
            });
        }
        res.json({ success: true, saved: upserts.map((u) => u.key) });
    } catch (e) {
        console.error('PATCH /api/admin/semantics-prompts:', e);
        res.status(500).json({ error: e.message || '系統錯誤' });
    }
});

// GET /api/admin/scene-sim-prompt — 實境模擬系統提示詞（僅管理員）
app.get('/api/admin/scene-sim-prompt', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'scene_sim_system_prompt').maybeSingle();
        const system_prompt = (row && row.value != null) ? String(row.value).trim() : '';
        res.json({ system_prompt });
    } catch (e) {
        console.error('GET /api/admin/scene-sim-prompt:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/scene-sim-prompt — 儲存實境模擬系統提示詞（僅管理員）
app.patch('/api/admin/scene-sim-prompt', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const system_prompt = (req.body && req.body.system_prompt != null) ? String(req.body.system_prompt).trim() : '';
        await supabase.from('payment_config').upsert({
            key: 'scene_sim_system_prompt',
            value: system_prompt,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/admin/scene-sim-prompt:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/pattern-extract-prompt — 圖樣提取系統提示詞（僅管理員）
app.get('/api/admin/pattern-extract-prompt', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'pattern_extract_system_prompt').maybeSingle();
        const system_prompt = (row && row.value != null) ? String(row.value).trim() : '';
        res.json({ system_prompt });
    } catch (e) {
        console.error('GET /api/admin/pattern-extract-prompt:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/pattern-extract-prompt — 儲存圖樣提取系統提示詞（僅管理員）
app.patch('/api/admin/pattern-extract-prompt', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const system_prompt = (req.body && req.body.system_prompt != null) ? String(req.body.system_prompt).trim() : '';
        await supabase.from('payment_config').upsert({
            key: 'pattern_extract_system_prompt',
            value: system_prompt,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/admin/pattern-extract-prompt:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/pattern-extract-seamless-prompt — 圖樣提取無縫拼接系統提示詞（僅管理員）
app.get('/api/admin/pattern-extract-seamless-prompt', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'pattern_extract_seamless_system_prompt').maybeSingle();
        const system_prompt = (row && row.value != null) ? String(row.value).trim() : '';
        res.json({ system_prompt });
    } catch (e) {
        console.error('GET /api/admin/pattern-extract-seamless-prompt:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/pattern-extract-seamless-prompt — 儲存圖樣提取無縫拼接系統提示詞（僅管理員）
app.patch('/api/admin/pattern-extract-seamless-prompt', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const system_prompt = (req.body && req.body.system_prompt != null) ? String(req.body.system_prompt).trim() : '';
        await supabase.from('payment_config').upsert({
            key: 'pattern_extract_seamless_system_prompt',
            value: system_prompt,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/admin/pattern-extract-seamless-prompt:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/membership/user?email= — 依 email 查詢用戶等級、點數、訂閱（供會員管理頁「用戶等級與點數」）
app.get('/api/admin/membership/user', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const email = (req.query.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ error: '請提供 email' });
        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, member_level')
            .ilike('email', email)
            .maybeSingle();
        if (profErr || !profile) return res.json({ user: null });
        const userId = profile.id;
        let credits = null;
        let subscription = null;
        const { data: cred } = await supabase.from('user_credits').select('balance, total_earned, total_spent').eq('user_id', userId).maybeSingle();
        if (cred) credits = cred;
        const now = new Date().toISOString();
        const { data: subRows } = await supabase
            .from('user_subscriptions')
            .select('id, start_date, end_date, status, plan_id, subscription_plans(name, plan_key, price)')
            .eq('user_id', userId)
            .eq('status', 'active')
            .gt('end_date', now)
            .order('end_date', { ascending: false })
            .limit(1);
        if (subRows && subRows.length > 0) {
            const row = subRows[0];
            subscription = {
                id: row.id,
                start_date: row.start_date,
                end_date: row.end_date,
                status: row.status,
                plan_id: row.plan_id,
                plan_name: row.subscription_plans?.name,
                plan_key: row.subscription_plans?.plan_key,
                price: row.subscription_plans?.price
            };
        }
        let manufacturer = null;
        const { data: mfrRow } = await supabase.from('manufacturers').select('id, name, vendor_source, verified, is_active').eq('user_id', userId).maybeSingle();
        if (mfrRow) manufacturer = mfrRow;
        let industry_supplier = null;
        try {
            const { data: supRow } = await supabase.from('industry_suppliers').select('id, name, is_active').eq('user_id', userId).maybeSingle();
            if (supRow) industry_supplier = supRow;
        } catch (_) { /* ignore */ }
        const identities = buildAdminUserIdentities(profile.role, manufacturer, industry_supplier, subscription, profile.member_level);
        res.json({ user: { ...profile, credits, subscription, manufacturer, industry_supplier, identities } });
    } catch (e) {
        console.error('GET /api/admin/membership/user:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/admin/membership/adjust-credits — 管理員手動調整用戶點數（補點或扣點）
app.post('/api/admin/membership/adjust-credits', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const { email, amount, description } = req.body || {};
        const emailStr = (email && String(email).trim()).toLowerCase();
        if (!emailStr) return res.status(400).json({ error: '請提供 email' });
        const amt = parseInt(amount, 10);
        if (isNaN(amt) || amt === 0) return res.status(400).json({ error: '請提供有效點數（正數補點、負數扣點）' });
        const { data: profile } = await supabase.from('profiles').select('id').ilike('email', emailStr).maybeSingle();
        if (!profile) return res.status(404).json({ error: '找不到該用戶' });
        const userId = profile.id;
        const { data: existing } = await supabase.from('user_credits').select('user_id, balance, total_earned, total_spent').eq('user_id', userId).maybeSingle();
        const prevBalance = existing ? existing.balance : 0;
        const newBalance = Math.max(0, prevBalance + amt);
        if (existing) {
            const totalEarned = (existing.total_earned || 0) + (amt > 0 ? amt : 0);
            const totalSpent = (existing.total_spent || 0) + (amt < 0 ? Math.abs(amt) : 0);
            const { error: updErr } = await supabase.from('user_credits')
                .update({ balance: newBalance, total_earned: totalEarned, total_spent: totalSpent, updated_at: new Date().toISOString() })
                .eq('user_id', userId);
            if (updErr) return res.status(500).json({ error: '更新點數失敗' });
        } else {
            const { error: insErr } = await supabase.from('user_credits').insert({
                user_id: userId,
                balance: newBalance,
                total_earned: amt > 0 ? amt : 0,
                total_spent: amt < 0 ? Math.abs(amt) : 0
            });
            if (insErr) return res.status(500).json({ error: '寫入點數失敗' });
        }
        await supabase.from('credit_transactions').insert({
            user_id: userId,
            type: amt > 0 ? 'granted' : 'consumed',
            amount: amt,
            balance_after: newBalance,
            source: 'admin_adjust',
            description: description || (amt > 0 ? '管理員補點' : '管理員扣點')
        });
        res.json({ success: true, previous_balance: prevBalance, new_balance: newBalance });
    } catch (e) {
        console.error('POST /api/admin/membership/adjust-credits:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/** 最近 N 個月 YYYY-MM（由新到舊） */
function recentMonthKeysDesc(monthCount) {
    const n = Math.min(Math.max(parseInt(monthCount, 10) || 12, 1), 36);
    const keys = [];
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < n; i++) {
        keys.push(d.toISOString().slice(0, 7));
        d.setUTCMonth(d.getUTCMonth() - 1);
    }
    return keys;
}

function aggregateCreditTransactionsMonthly(transactions) {
    const byUserMonth = {};
    const byUserMonthDesc = {};
    (transactions || []).forEach((r) => {
        if (!r.user_id || !r.created_at) return;
        const month = String(r.created_at).slice(0, 7);
        const uid = r.user_id;
        const cellKey = uid + '|' + month;
        if (!byUserMonth[cellKey]) {
            byUserMonth[cellKey] = { consumed_points: 0, consumed_count: 0, granted_points: 0, granted_count: 0 };
        }
        const amt = parseInt(r.amount, 10) || 0;
        const desc = (r.description && String(r.description).trim()) || (r.source && String(r.source).trim()) || '其他';
        if (r.type === 'consumed' || amt < 0) {
            const pts = Math.abs(amt);
            byUserMonth[cellKey].consumed_points += pts;
            byUserMonth[cellKey].consumed_count += 1;
            const dKey = cellKey + '|' + desc;
            if (!byUserMonthDesc[dKey]) byUserMonthDesc[dKey] = { description: desc, points: 0, count: 0 };
            byUserMonthDesc[dKey].points += pts;
            byUserMonthDesc[dKey].count += 1;
        } else if (amt > 0) {
            byUserMonth[cellKey].granted_points += amt;
            byUserMonth[cellKey].granted_count += 1;
        }
    });
    return { byUserMonth, byUserMonthDesc };
}

// GET /api/admin/membership/points-monthly — 每帳號每月消耗（及獲得）點數彙總
// ?email= 單一用戶；?scope=all 全部用戶矩陣；months=1..36（預設 12）
app.get('/api/admin/membership/points-monthly', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const months = recentMonthKeysDesc(req.query.months || 12);
        const oldestMonth = months[months.length - 1];
        const fromIso = oldestMonth + '-01T00:00:00.000Z';
        const email = (req.query.email || '').trim().toLowerCase();
        const scopeAll = req.query.scope === 'all' || req.query.scope === '1';
        if (!email && !scopeAll) {
            return res.status(400).json({ error: '請提供 email，或 scope=all 查詢全部用戶' });
        }
        let userIdsFilter = null;
        let profileById = {};
        if (email) {
            const { data: profile } = await supabase.from('profiles').select('id, email, full_name, member_level, role').ilike('email', email).maybeSingle();
            if (!profile) return res.json({ months, user: null, monthly: [], breakdown: {} });
            userIdsFilter = [profile.id];
            profileById[profile.id] = profile;
        } else {
            const { data: profiles } = await supabase.from('profiles').select('id, email, full_name, member_level, role').order('email', { ascending: true });
            (profiles || []).forEach((p) => { profileById[p.id] = p; });
            userIdsFilter = Object.keys(profileById);
        }
        let query = supabase
            .from('credit_transactions')
            .select('user_id, type, amount, description, source, created_at')
            .gte('created_at', fromIso)
            .order('created_at', { ascending: false });
        if (userIdsFilter && userIdsFilter.length === 1) {
            query = query.eq('user_id', userIdsFilter[0]);
        } else if (userIdsFilter && userIdsFilter.length > 1 && userIdsFilter.length <= 400) {
            query = query.in('user_id', userIdsFilter);
        }
        const { data: rows, error } = await query.limit(100000);
        if (error) {
            console.error('GET /api/admin/membership/points-monthly:', error);
            return res.status(500).json({ error: '查詢點數紀錄失敗', details: error.message });
        }
        const filtered = (rows || []).filter((r) => !userIdsFilter || userIdsFilter.includes(r.user_id));
        const { byUserMonth, byUserMonthDesc } = aggregateCreditTransactionsMonthly(filtered);
        const totalsByMonth = {};
        months.forEach((m) => { totalsByMonth[m] = { consumed_points: 0, consumed_count: 0, granted_points: 0 }; });

        if (email && userIdsFilter && userIdsFilter[0]) {
            const uid = userIdsFilter[0];
            const monthly = months.map((m) => {
                const cell = byUserMonth[uid + '|' + m] || { consumed_points: 0, consumed_count: 0, granted_points: 0, granted_count: 0 };
                totalsByMonth[m].consumed_points += cell.consumed_points;
                totalsByMonth[m].consumed_count += cell.consumed_count;
                totalsByMonth[m].granted_points += cell.granted_points;
                const breakdown = [];
                Object.keys(byUserMonthDesc).forEach((k) => {
                    if (!k.startsWith(uid + '|' + m + '|')) return;
                    breakdown.push(byUserMonthDesc[k]);
                });
                breakdown.sort((a, b) => b.points - a.points);
                return { month: m, ...cell, breakdown };
            });
            const prof = profileById[uid];
            return res.json({
                months,
                user: prof ? { id: prof.id, email: prof.email, full_name: prof.full_name, member_level: prof.member_level || '一般', role: prof.role || 'user' } : null,
                monthly,
                totals_by_month: totalsByMonth
            });
        }

        const users = [];
        Object.keys(profileById).forEach((uid) => {
            const prof = profileById[uid];
            const monthly = {};
            let totalConsumed = 0;
            months.forEach((m) => {
                const cell = byUserMonth[uid + '|' + m] || { consumed_points: 0, consumed_count: 0 };
                monthly[m] = cell.consumed_points;
                totalsByMonth[m].consumed_points += cell.consumed_points;
                totalsByMonth[m].consumed_count += cell.consumed_count || 0;
                totalConsumed += cell.consumed_points;
            });
            if (totalConsumed > 0 || (filtered || []).some((r) => r.user_id === uid)) {
                users.push({
                    user_id: uid,
                    email: prof.email || '',
                    full_name: prof.full_name || '',
                    member_level: prof.member_level || '一般',
                    role: prof.role || 'user',
                    monthly,
                    total_consumed: totalConsumed
                });
            }
        });
        users.sort((a, b) => b.total_consumed - a.total_consumed);
        res.json({ months, users, totals_by_month: totalsByMonth, user_count: users.length });
    } catch (e) {
        console.error('GET /api/admin/membership/points-monthly 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/membership/ledger?email= — 查詢用戶點數流水
app.get('/api/admin/membership/ledger', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const email = (req.query.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ error: '請提供 email' });
        const { data: profile } = await supabase.from('profiles').select('id').ilike('email', email).maybeSingle();
        if (!profile) return res.json({ ledger: [] });
        const { data: rows } = await supabase
            .from('credit_transactions')
            .select('id, type, amount, balance_after, source, description, created_at')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(100);
        res.json({ ledger: rows || [] });
    } catch (e) {
        console.error('GET /api/admin/membership/ledger:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/points-usage-stats — 各扣點功能：次數、點數累計、平均點數（供後台統計表）
app.get('/api/admin/points-usage-stats', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const fromDate = (req.query.from_date || '').trim() || null;
        const toDate = (req.query.to_date || '').trim() || null;
        let query = supabase
            .from('credit_transactions')
            .select('amount, description, created_at, user_id')
            .eq('type', 'consumed')
            .lt('amount', 0)
            .order('created_at', { ascending: false });
        if (fromDate) query = query.gte('created_at', fromDate);
        if (toDate) query = query.lte('created_at', toDate + (toDate.length <= 10 ? 'T23:59:59.999Z' : ''));
        const { data: rows, error } = await query.limit(50000);
        if (error) {
            console.error('GET /api/admin/points-usage-stats:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        const list = rows || [];
        const userIds = [...new Set((list || []).map(function (r) { return r.user_id; }).filter(Boolean))];
        let userIdToLevel = {};
        if (userIds.length > 0) {
            try {
                const { data: profiles } = await supabase.from('profiles').select('id, member_level').in('id', userIds);
                (profiles || []).forEach(function (p) {
                    userIdToLevel[p.id] = (p.member_level && String(p.member_level).trim()) || '一般';
                });
            } catch (_) { /* profiles 可能無 member_level */ }
        }
        const byDesc = {};
        const byDay = {};
        const byLevel = {};
        list.forEach(function (r) {
            const level = userIdToLevel[r.user_id] || '一般';
            if (!byLevel[level]) byLevel[level] = { total: 0, count: 0, userIds: new Set() };
            byLevel[level].total += Math.abs(parseInt(r.amount, 10) || 0);
            byLevel[level].count += 1;
            if (r.user_id) byLevel[level].userIds.add(r.user_id);
            const desc = (r.description && String(r.description).trim()) || '其他';
            if (!byDesc[desc]) byDesc[desc] = { total: 0, count: 0 };
            byDesc[desc].total += Math.abs(parseInt(r.amount, 10) || 0);
            byDesc[desc].count += 1;
            const day = r.created_at ? r.created_at.slice(0, 10) : null;
            if (day) {
                if (!byDay[day]) byDay[day] = { total: 0, count: 0 };
                byDay[day].total += Math.abs(parseInt(r.amount, 10) || 0);
                byDay[day].count += 1;
            }
        });
        const by_level = Object.keys(byLevel).sort().map(function (level) {
            const o = byLevel[level];
            return {
                member_level: level,
                total_points: o.total,
                count: o.count,
                user_count: o.userIds ? o.userIds.size : 0,
                avg_per_user: o.userIds && o.userIds.size > 0 ? Math.round((o.total / o.userIds.size) * 10) / 10 : 0
            };
        }).sort(function (a, b) { return b.total_points - a.total_points; });
        const stats = Object.keys(byDesc).sort().map(function (desc) {
            const o = byDesc[desc];
            return {
                description: desc,
                times: o.count,
                total_points: o.total,
                avg_points: o.count > 0 ? Math.round((o.total / o.count) * 10) / 10 : 0
            };
        }).sort(function (a, b) { return b.total_points - a.total_points; });
        const total_count = list.length;
        const total_points = list.reduce(function (sum, r) { return sum + Math.abs(parseInt(r.amount, 10) || 0); }, 0);
        const daily_totals = Object.keys(byDay).sort().map(function (d) {
            const o = byDay[d];
            return { date: d, total_points: o.total, count: o.count };
        });
        res.json({ stats, total_count, total_points, daily_totals, by_level });
    } catch (e) {
        console.error('GET /api/admin/points-usage-stats 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

const DESIGN_ACTION_WHITELIST = ['find_vendor', 'redesign_generate_ok', 'share_facebook', 'share_line', 'share_instagram', 'share_pinterest', 'share_copy_link'];

// POST /api/track-design-action — 記錄設計行為（找廠商訂製、再設計並生圖成功、社群分享）
app.post('/api/track-design-action', express.json(), async (req, res) => {
    try {
        const action = (req.body && req.body.action) ? String(req.body.action).trim() : '';
        if (DESIGN_ACTION_WHITELIST.indexOf(action) === -1) {
            return res.status(400).json({ error: '無效的 action' });
        }
        let userId = null;
        try {
            const authHeader = req.headers.authorization || req.headers['x-auth-token'];
            const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
            if (token) {
                const { data: { user } } = await supabase.auth.getUser(token);
                if (user && user.id) userId = user.id;
            }
        } catch (_) { /* 未登入不影響紀錄 */ }
        const { error } = await supabase.from('design_action_log').insert({ action, user_id: userId });
        if (error) {
            console.error('POST /api/track-design-action insert:', error);
            return res.status(500).json({ error: '寫入失敗' });
        }
        res.status(204).end();
    } catch (e) {
        console.error('POST /api/track-design-action:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/design-action-stats — 設計行為次數（供後台扣點統計頁）
app.get('/api/admin/design-action-stats', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const fromDate = (req.query.from_date || '').trim() || null;
        const toDate = (req.query.to_date || '').trim() || null;
        let query = supabase.from('design_action_log').select('action, created_at').order('created_at', { ascending: false });
        if (fromDate) query = query.gte('created_at', fromDate);
        if (toDate) query = query.lte('created_at', toDate + (toDate.length <= 10 ? 'T23:59:59.999Z' : ''));
        const { data: rows, error } = await query.limit(100000);
        if (error) {
            console.error('GET /api/admin/design-action-stats:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        const list = rows || [];
        const counts = { find_vendor: 0, redesign_generate_ok: 0, share_facebook: 0, share_line: 0, share_instagram: 0, share_pinterest: 0, share_copy_link: 0 };
        const byDay = {};
        list.forEach(function (r) {
            if (counts[r.action] != null) counts[r.action] += 1;
            const day = r.created_at ? r.created_at.slice(0, 10) : null;
            if (day) {
                if (!byDay[day]) byDay[day] = { find_vendor: 0, redesign_generate_ok: 0, share_facebook: 0, share_line: 0, share_instagram: 0, share_pinterest: 0, share_copy_link: 0 };
                if (byDay[day][r.action] != null) byDay[day][r.action] += 1;
            }
        });
        const daily_totals = Object.keys(byDay).sort().map(function (d) {
            const o = byDay[d];
            return { date: d, find_vendor: o.find_vendor, redesign_generate_ok: o.redesign_generate_ok, share_instagram: o.share_instagram, share_pinterest: o.share_pinterest, share_facebook: o.share_facebook, share_line: o.share_line, share_copy_link: o.share_copy_link };
        });
        res.json({
            find_vendor_count: counts.find_vendor,
            redesign_generate_ok_count: counts.redesign_generate_ok,
            share_instagram_count: counts.share_instagram,
            share_pinterest_count: counts.share_pinterest,
            share_facebook_count: counts.share_facebook,
            share_line_count: counts.share_line,
            share_copy_link_count: counts.share_copy_link,
            daily_totals
        });
    } catch (e) {
        console.error('GET /api/admin/design-action-stats 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ---------- 點數與金流（需在 static 前） ----------
async function getCurrentUser(req, res) {
    const authHeader = req.headers.authorization || req.headers['x-auth-token'];
    const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
    if (!token) {
        res.status(401).json({ error: '請先登入' });
        return null;
    }
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        res.status(401).json({ error: '登入已過期或無效' });
        return null;
    }
    return user;
}

// 發點：依後台開關在查詢點數時執行「註冊送點」與「每月發點」（開關關閉時不執行）
const GRANT_CONFIG_KEYS = ['grant_welcome_points_on_register', 'welcome_points_amount', 'grant_monthly_points_enabled', 'monthly_points_free_tier'];
async function ensureGrantPointsIfEnabled(userId) {
    const { data: configRows } = await supabase.from('payment_config').select('key, value').in('key', GRANT_CONFIG_KEYS);
    const cfg = {};
    (configRows || []).forEach(r => { cfg[r.key] = r.value; });
    const welcomeOn = (cfg.grant_welcome_points_on_register || '').toString() === '1' || (cfg.grant_welcome_points_on_register || '').toString().toLowerCase() === 'true';
    const welcomeAmount = Math.max(0, parseInt(cfg.welcome_points_amount, 10) || 0);
    const monthlyOn = (cfg.grant_monthly_points_enabled || '').toString() === '1' || (cfg.grant_monthly_points_enabled || '').toString().toLowerCase() === 'true';
    const monthlyFree = Math.max(0, parseInt(cfg.monthly_points_free_tier, 10) || 0);

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const grantPoints = async (amount, source, description) => {
        if (!amount || amount <= 0) return;
        const { data: row } = await supabase.from('user_credits').select('balance, total_earned, total_spent').eq('user_id', userId).maybeSingle();
        const prev = row ? (row.balance || 0) : 0;
        const totalEarned = row ? (row.total_earned || 0) + amount : amount;
        const totalSpent = row ? (row.total_spent || 0) : 0;
        const newBalance = prev + amount;
        if (row) {
            await supabase.from('user_credits').update({ balance: newBalance, total_earned: totalEarned, updated_at: now.toISOString() }).eq('user_id', userId);
        } else {
            await supabase.from('user_credits').insert({ user_id: userId, balance: newBalance, total_earned: totalEarned, total_spent: 0, updated_at: now.toISOString() });
        }
        await supabase.from('credit_transactions').insert({
            user_id: userId,
            type: 'granted',
            amount: amount,
            balance_after: newBalance,
            source,
            description: description || (source === 'welcome' ? '註冊贈送' : '每月發點')
        });
    };

    if (welcomeOn && welcomeAmount > 0) {
        const { data: hasWelcome } = await supabase.from('credit_transactions').select('id').eq('user_id', userId).eq('source', 'welcome').limit(1).maybeSingle();
        if (!hasWelcome) await grantPoints(welcomeAmount, 'welcome', '註冊贈送');
    }

    if (monthlyOn) {
        const { data: hasThisMonth } = await supabase.from('credit_transactions').select('id').eq('user_id', userId).eq('source', 'monthly_grant').gte('created_at', thisMonthStart).limit(1).maybeSingle();
        if (!hasThisMonth) {
            let amount = monthlyFree;
            const { data: subRows } = await supabase.from('user_subscriptions').select('subscription_plans(credits_monthly)').eq('user_id', userId).eq('status', 'active').gt('end_date', now.toISOString()).limit(1);
            if (subRows && subRows[0] && subRows[0].subscription_plans && (subRows[0].subscription_plans.credits_monthly || 0) > 0) {
                amount = parseInt(subRows[0].subscription_plans.credits_monthly, 10) || 0;
            }
            if (amount > 0) await grantPoints(amount, 'monthly_grant', '每月發點');
        }
    }
    try {
        await syncMembershipCatalogVisibility(userId);
    } catch (syncErr) {
        console.warn('syncMembershipCatalogVisibility:', syncErr && syncErr.message);
    }
}

// GET /api/me/credits — 查詢當前用戶點數餘額與近期紀錄（若後台開關開啟，會先執行註冊送點／每月發點）
app.get('/api/me/credits', async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        try { await ensureGrantPointsIfEnabled(user.id); } catch (grantErr) { console.warn('ensureGrantPointsIfEnabled:', grantErr && grantErr.message); }
        const { data: credits, error: credErr } = await supabase
            .from('user_credits')
            .select('balance, total_earned, total_spent')
            .eq('user_id', user.id)
            .maybeSingle();
        if (credErr) {
            console.error('GET /api/me/credits:', credErr);
            return res.status(500).json({ error: '查詢點數失敗' });
        }
        const balance = credits ? credits.balance : 0;
        const total_earned = credits ? credits.total_earned : 0;
        const total_spent = credits ? credits.total_spent : 0;
        let transactions = [];
        try {
            const { data: tx } = await supabase
                .from('credit_transactions')
                .select('id, type, amount, balance_after, description, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);
            transactions = tx || [];
        } catch (_) { /* 表可能尚未建立 */ }
        res.json({ balance, total_earned, total_spent, transactions });
    } catch (e) {
        console.error('GET /api/me/credits 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/me/subscription — 當前用戶有效訂閱與「到期前兩週」提醒
app.get('/api/me/subscription', async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return; // getCurrentUser 已送 401，勿重複送
        const now = new Date();
        const { data: rows, error } = await supabase
            .from('user_subscriptions')
            .select('id, start_date, end_date, status, subscription_plans(name)')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .gt('end_date', now.toISOString())
            .order('end_date', { ascending: true });
        if (error) {
            console.error('GET /api/me/subscription:', error);
            return res.status(500).json({ error: '查詢訂閱失敗' });
        }
        const subscriptions = (rows || []).map(r => ({
            id: r.id,
            start_date: r.start_date,
            end_date: r.end_date,
            status: r.status,
            plan_name: (r.subscription_plans && r.subscription_plans.name) ? r.subscription_plans.name : null
        }));
        const twoWeeksFromNow = new Date(now);
        twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
        let renewal_reminder = null;
        for (const sub of subscriptions) {
            const endDate = new Date(sub.end_date);
            if (endDate <= twoWeeksFromNow && endDate >= now) {
                const daysLeft = Math.ceil((endDate - now) / (24 * 60 * 60 * 1000));
                renewal_reminder = {
                    end_date: sub.end_date,
                    plan_name: sub.plan_name || '年付方案',
                    days_left: daysLeft
                };
                break;
            }
        }
        res.json({ subscriptions, renewal_reminder });
    } catch (e) {
        console.error('GET /api/me/subscription 異常:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/credits/consume — 扣點（例如 AI 服務）
app.post('/api/credits/consume', express.json(), async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const body = req.body || {};
        const amount = Math.abs(parseInt(body.amount, 10) || 0);
        const reason = (body.reason || body.description || '消費').toString().trim();
        if (amount <= 0) return res.status(400).json({ error: '請填寫有效扣點數量' });
        const { data: row, error: fetchErr } = await supabase
            .from('user_credits')
            .select('balance')
            .eq('user_id', user.id)
            .maybeSingle();
        if (fetchErr) {
            console.error('POST /api/credits/consume fetch:', fetchErr);
            return res.status(500).json({ error: '查詢點數失敗' });
        }
        const current = (row && row.balance) ? row.balance : 0;
        if (current < amount) return res.status(400).json({ error: '點數不足', balance: current });
        const balanceAfter = current - amount;
        const updates = { balance: balanceAfter, total_spent: (row ? (row.total_spent || 0) : 0) + amount, updated_at: new Date().toISOString() };
        if (!row) {
            const { error: insErr } = await supabase.from('user_credits').insert({
                user_id: user.id,
                balance: balanceAfter,
                total_earned: 0,
                total_spent: amount,
                updated_at: updates.updated_at
            });
            if (insErr) {
                console.error('POST /api/credits/consume insert:', insErr);
                return res.status(500).json({ error: '扣點失敗' });
            }
        } else {
            const { error: upErr } = await supabase.from('user_credits').update(updates).eq('user_id', user.id);
            if (upErr) {
                console.error('POST /api/credits/consume update:', upErr);
                return res.status(500).json({ error: '扣點失敗' });
            }
        }
        await supabase.from('credit_transactions').insert({
            user_id: user.id,
            type: 'consumed',
            amount: -amount,
            balance_after: balanceAfter,
            source: 'ai_service',
            description: reason,
            metadata: body.metadata || {}
        });
        res.json({ success: true, balance_after: balanceAfter });
    } catch (e) {
        console.error('POST /api/credits/consume 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// 綠界 CheckMacValue（SHA256：HashKey + 參數字串 + HashIV，URL encode 後小寫再 SHA256 大寫）
function ecpayCheckMacValue(params, hashKey, hashIV) {
    const exclude = ['CheckMacValue'];
    const pairs = Object.keys(params)
        .filter(k => !exclude.includes(k) && params[k] !== undefined && params[k] !== '')
        .sort()
        .map(k => k + '=' + params[k]);
    const dataStr = pairs.join('&');
    const beforeHash = hashKey + dataStr + hashIV;
    const encoded = encodeURIComponent(beforeHash).toLowerCase().replace(/%20/g, '+');
    return crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase();
}

// POST /api/payment/ecpay/create — 建立綠界訂單，回傳自動送出表單的 HTML
app.post('/api/payment/ecpay/create', express.json(), async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const config = await getPaymentConfig();
        const ecpay = config.ecpay;
        if (!ecpay.hashKey || !ecpay.hashIV) {
            return res.status(503).json({
                error: '綠界金流尚未設定',
                hint: '請至後台「金流設定」或 .env 填寫 ECPAY_HASH_KEY、ECPAY_HASH_IV。測試用可至綠界測試後台登入取得：' + ECPAY_TEST_STAGE
            });
        }
        const body = req.body || {};
        const amount = Math.abs(parseInt(body.amount, 10) || 0);
        const credits = Math.abs(parseInt(body.credits, 10) || 0);
        if (amount <= 0 || credits <= 0) return res.status(400).json({ error: '請填寫金額與點數' });
        const billing = (body.billing || '').toLowerCase();
        const planKey = body.plan && String(body.plan).trim() ? String(body.plan).trim() : null;
        const isYearly = billing === 'yearly' && planKey;
        const orderId = 'EC' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        const insertPayload = {
            order_id: orderId,
            user_id: user.id,
            provider: 'ecpay',
            amount,
            currency: 'TWD',
            credits_to_grant: credits,
            status: 'pending'
        };
        if (isYearly) {
            insertPayload.order_type = 'yearly';
            insertPayload.metadata = { plan_key: planKey };
        }
        const { data: orderRow, error: orderErr } = await supabase
            .from('payment_orders')
            .insert(insertPayload)
            .select('id')
            .single();
        if (orderErr) {
            console.error('payment_orders insert:', orderErr);
            return res.status(500).json({ error: '建立訂單失敗' });
        }
        const tradeDate = new Date();
        const tradeDateStr = tradeDate.getFullYear() + '/' +
            String(tradeDate.getMonth() + 1).padStart(2, '0') + '/' +
            String(tradeDate.getDate()).padStart(2, '0') + ' ' +
            String(tradeDate.getHours()).padStart(2, '0') + ':' +
            String(tradeDate.getMinutes()).padStart(2, '0') + ':' +
            String(tradeDate.getSeconds()).padStart(2, '0');
        const returnBase = (process.env.BASE_URL || BASE_URL || '').replace(/\/$/, '');
        const params = {
            MerchantID: ecpay.merchantID,
            MerchantTradeNo: orderId,
            MerchantTradeDate: tradeDateStr,
            PaymentType: 'aio',
            TotalAmount: amount,
            TradeDesc: '點數儲值',
            ItemName: credits + ' 點數',
            ReturnURL: ecpay.notifyURL,
            ChoosePayment: 'ALL',
            NeedExtraPaidInfo: 'N',
            ClientBackURL: returnBase + '/payment/return.html?order_id=' + encodeURIComponent(orderId),
            EncryptType: 1
        };
        params.CheckMacValue = ecpayCheckMacValue(params, ecpay.hashKey, ecpay.hashIV);
        const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body><form id="ecpayForm" method="POST" action="' + ecpay.apiURL + '">' +
            Object.keys(params).map(k => '<input type="hidden" name="' + k + '" value="' + String(params[k]).replace(/"/g, '&quot;') + '"/>').join('') +
            '</form><script>document.getElementById("ecpayForm").submit();</script></body></html>';
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (e) {
        console.error('POST /api/payment/ecpay/create 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/payment/ecpay/create-subscription — 綠界信用卡定期定額（月訂閱）
app.post('/api/payment/ecpay/create-subscription', express.json(), async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const config = await getPaymentConfig();
        const ecpay = config.ecpay;
        if (!ecpay.hashKey || !ecpay.hashIV) {
            return res.status(503).json({
                error: '綠界金流尚未設定',
                hint: '請至後台「金流設定」或 .env 填寫 ECPAY_HASH_KEY、ECPAY_HASH_IV。'
            });
        }
        const body = req.body || {};
        const amount = Math.abs(parseInt(body.amount, 10) || 0);
        const credits = Math.abs(parseInt(body.credits, 10) || 0);
        if (amount <= 0 || credits <= 0) return res.status(400).json({ error: '請填寫月付金額與每期點數' });
        const orderId = 'ECP' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        const { error: orderErr } = await supabase
            .from('payment_orders')
            .insert({
                order_id: orderId,
                user_id: user.id,
                provider: 'ecpay',
                amount,
                currency: 'TWD',
                credits_to_grant: credits,
                status: 'pending',
                order_type: 'subscription'
            })
            .select('id')
            .single();
        if (orderErr) {
            console.error('payment_orders insert subscription:', orderErr);
            return res.status(500).json({ error: '建立訂閱訂單失敗' });
        }
        const tradeDate = new Date();
        const tradeDateStr = tradeDate.getFullYear() + '/' +
            String(tradeDate.getMonth() + 1).padStart(2, '0') + '/' +
            String(tradeDate.getDate()).padStart(2, '0') + ' ' +
            String(tradeDate.getHours()).padStart(2, '0') + ':' +
            String(tradeDate.getMinutes()).padStart(2, '0') + ':' +
            String(tradeDate.getSeconds()).padStart(2, '0');
        const returnBase = (process.env.BASE_URL || BASE_URL || '').replace(/\/$/, '');
        const periodNotifyURL = returnBase + '/api/payment/notify-period';
        const params = {
            MerchantID: ecpay.merchantID,
            MerchantTradeNo: orderId,
            MerchantTradeDate: tradeDateStr,
            PaymentType: 'aio',
            TotalAmount: amount,
            TradeDesc: '月訂閱定期定額',
            ItemName: credits + ' 點/月',
            ReturnURL: ecpay.notifyURL,
            ChoosePayment: 'Credit',
            NeedExtraPaidInfo: 'N',
            ClientBackURL: returnBase + '/payment/return.html?order_id=' + encodeURIComponent(orderId),
            EncryptType: 1,
            PeriodAmount: amount,
            PeriodType: 'M',
            Frequency: 1,
            ExecTimes: 12,
            PeriodReturnURL: periodNotifyURL
        };
        params.CheckMacValue = ecpayCheckMacValue(params, ecpay.hashKey, ecpay.hashIV);
        const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body><form id="ecpayForm" method="POST" action="' + ecpay.apiURL + '">' +
            Object.keys(params).map(k => '<input type="hidden" name="' + k + '" value="' + String(params[k]).replace(/"/g, '&quot;') + '"/>').join('') +
            '</form><script>document.getElementById("ecpayForm").submit();</script></body></html>';
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (e) {
        console.error('POST /api/payment/ecpay/create-subscription 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/payment/notify — 綠界付款結果回調（表單 application/x-www-form-urlencoded）
app.post('/api/payment/notify', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const body = req.body || {};
        const receivedMac = body.CheckMacValue;
        if (!receivedMac) {
            return res.status(400).send('0|缺少 CheckMacValue');
        }
        const config = await getPaymentConfig();
        const ecpay = config.ecpay;
        if (!ecpay.hashKey || !ecpay.hashIV) {
            return res.status(500).send('0|設定錯誤');
        }
        const computed = ecpayCheckMacValue(body, ecpay.hashKey, ecpay.hashIV);
        if (computed !== receivedMac) {
            console.error('ECPay CheckMacValue 驗證失敗');
            return res.status(400).send('0|CheckMacValue 錯誤');
        }
        const orderId = body.MerchantTradeNo;
        const rtnCode = parseInt(body.RtnCode, 10);
        // 付款失敗：僅更新訂單為 failed，不入點、不建立訂閱
        if (rtnCode !== 1) {
            await supabase.from('payment_orders').update({
                status: 'failed',
                raw_callback: body
            }).eq('order_id', orderId);
            return res.send('1|OK');
        }
        const { data: order, error: ordErr } = await supabase
            .from('payment_orders')
            .select('id, user_id, credits_to_grant, status, order_type, metadata')
            .eq('order_id', orderId)
            .single();
        if (ordErr || !order) {
            console.error('payment_orders select:', ordErr);
            return res.send('1|OK');
        }
        if (order.status === 'paid') {
            return res.send('1|OK');
        }
        // 以下僅在「付款成功」時執行：更新訂單為 paid，再依條件入點／建立年付訂閱
        const paidAt = new Date().toISOString();
        await supabase.from('payment_orders').update({
            status: 'paid',
            external_id: body.TradeNo,
            raw_callback: body,
            paid_at: paidAt
        }).eq('order_id', orderId);
        if (body.SimulatePaid === '1') {
            return res.send('1|OK');
        }
        // 非模擬付款：入點（點數僅在實際付款成功後更新）
        const credits = order.credits_to_grant;
        const { data: cred } = await supabase.from('user_credits').select('balance, total_earned, total_spent').eq('user_id', order.user_id).maybeSingle();
        const balanceBefore = (cred && cred.balance) ? cred.balance : 0;
        const balanceAfter = balanceBefore + credits;
        const totalEarned = (cred && cred.total_earned) ? cred.total_earned + credits : credits;
        const totalSpent = cred ? (cred.total_spent || 0) : 0;
        if (cred) {
            await supabase.from('user_credits').update({
                balance: balanceAfter,
                total_earned: totalEarned,
                updated_at: paidAt
            }).eq('user_id', order.user_id);
        } else {
            await supabase.from('user_credits').insert({
                user_id: order.user_id,
                balance: balanceAfter,
                total_earned: totalEarned,
                total_spent: 0,
                updated_at: paidAt
            });
        }
        await supabase.from('credit_transactions').insert({
            user_id: order.user_id,
            type: 'purchase',
            amount: credits,
            balance_after: balanceAfter,
            source: 'purchase',
            description: order.order_type === 'subscription' ? '綠界月訂閱' : '綠界儲值',
            metadata: { order_id: orderId, provider: 'ecpay' }
        });
        if (order.order_type === 'yearly' && order.metadata && order.metadata.plan_key) {
            const planKey = order.metadata.plan_key;
            const { data: plan } = await supabase.from('subscription_plans').select('id').eq('plan_key', planKey).maybeSingle();
            if (plan) {
                const start = new Date();
                const end = new Date(start);
                end.setFullYear(end.getFullYear() + 1);
                await supabase.from('user_subscriptions').insert({
                    user_id: order.user_id,
                    plan_id: plan.id,
                    start_date: start.toISOString(),
                    end_date: end.toISOString(),
                    status: 'active',
                    auto_renew: false
                });
                try {
                    await syncMembershipCatalogVisibility(order.user_id);
                } catch (syncErr) {
                    console.warn('syncMembershipCatalogVisibility:', syncErr && syncErr.message);
                }
            }
        }
        res.send('1|OK');
    } catch (e) {
        console.error('POST /api/payment/notify 異常:', e);
        res.status(500).send('0|Exception');
    }
});

// POST /api/payment/notify-period — 綠界定期定額每期扣款結果（PeriodReturnURL，見 5631）
app.post('/api/payment/notify-period', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const body = req.body || {};
        const receivedMac = body.CheckMacValue;
        if (!receivedMac) return res.status(400).send('0|缺少 CheckMacValue');
        const config = await getPaymentConfig();
        const ecpay = config.ecpay;
        if (!ecpay.hashKey || !ecpay.hashIV) return res.status(500).send('0|設定錯誤');
        const computed = ecpayCheckMacValue(body, ecpay.hashKey, ecpay.hashIV);
        if (computed !== receivedMac) {
            console.error('ECPay notify-period CheckMacValue 驗證失敗');
            return res.status(400).send('0|CheckMacValue 錯誤');
        }
        const rtnCode = parseInt(body.RtnCode, 10);
        // 該期失敗或模擬付款：不入點（定期定額失敗時綠界不撥款，該期不發點數）
        if (rtnCode !== 1) return res.send('1|OK');
        if (body.SimulatePaid === '1') return res.send('1|OK');
        const orderId = body.MerchantTradeNo;
        const periodIndex = String(body.TotalSuccessTimes || body.total_success_times || '');
        const { data: order, error: ordErr } = await supabase
            .from('payment_orders')
            .select('id, user_id, credits_to_grant, order_type')
            .eq('order_id', orderId)
            .single();
        if (ordErr || !order || order.order_type !== 'subscription') return res.send('1|OK');
        const { data: existing } = await supabase
            .from('credit_transactions')
            .select('id')
            .eq('user_id', order.user_id)
            .contains('metadata', { order_id: orderId, period_index: periodIndex })
            .limit(1)
            .maybeSingle();
        if (existing) return res.send('1|OK');
        const credits = order.credits_to_grant;
        const paidAt = new Date().toISOString();
        const { data: cred } = await supabase.from('user_credits').select('balance, total_earned').eq('user_id', order.user_id).maybeSingle();
        const balanceBefore = (cred && cred.balance) ? cred.balance : 0;
        const balanceAfter = balanceBefore + credits;
        const totalEarned = (cred && cred.total_earned) ? cred.total_earned + credits : credits;
        if (cred) {
            await supabase.from('user_credits').update({
                balance: balanceAfter,
                total_earned: totalEarned,
                updated_at: paidAt
            }).eq('user_id', order.user_id);
        } else {
            await supabase.from('user_credits').insert({
                user_id: order.user_id,
                balance: balanceAfter,
                total_earned: totalEarned,
                total_spent: 0,
                updated_at: paidAt
            });
        }
        await supabase.from('credit_transactions').insert({
            user_id: order.user_id,
            type: 'purchase',
            amount: credits,
            balance_after: balanceAfter,
            source: 'purchase',
            description: '綠界月訂閱（定期扣款）',
            metadata: { order_id: orderId, provider: 'ecpay', period_index: periodIndex }
        });
        res.send('1|OK');
    } catch (e) {
        console.error('POST /api/payment/notify-period 異常:', e);
        res.status(500).send('0|Exception');
    }
});

// PayPal 金流：依 getPaymentConfig() 動態建立 client（後台或 .env 設定）
function getPayPalClient(paypalConfig) {
    if (!paypalConfig || !paypalConfig.clientId || !paypalConfig.clientSecret) return null;
    try {
        const paypal = require('@paypal/checkout-server-sdk');
        const env = paypalConfig.sandbox
            ? new paypal.core.SandboxEnvironment(paypalConfig.clientId, paypalConfig.clientSecret)
            : new paypal.core.LiveEnvironment(paypalConfig.clientId, paypalConfig.clientSecret);
        return new paypal.core.PayPalHttpClient(env);
    } catch (_) {
        return null;
    }
}

// POST /api/payment/paypal/create — 建立 PayPal 訂單，回傳 approval_url
app.post('/api/payment/paypal/create', express.json(), async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const config = await getPaymentConfig();
        const paypalClient = getPayPalClient(config.paypal);
        if (!paypalClient) {
            return res.status(503).json({
                error: 'PayPal 金流尚未設定',
                hint: '請至後台「金流設定」或 .env 填寫 PAYPAL_CLIENT_ID、PAYPAL_CLIENT_SECRET。測試用 Sandbox 帳號：' + PAYPAL_DEV_DOC
            });
        }
        const body = req.body || {};
        const amount = Math.abs(parseFloat(body.amount) || 0);
        const credits = Math.abs(parseInt(body.credits, 10) || 0);
        if (amount <= 0 || credits <= 0) return res.status(400).json({ error: '請填寫金額與點數' });
        const billing = (body.billing || '').toLowerCase();
        const planKey = body.plan && String(body.plan).trim() ? String(body.plan).trim() : null;
        const isYearly = billing === 'yearly' && planKey;
        const orderId = 'PP' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        const insertPayload = {
            order_id: orderId,
            user_id: user.id,
            provider: 'paypal',
            amount: Math.round(amount),
            currency: 'USD',
            credits_to_grant: credits,
            status: 'pending'
        };
        if (isYearly) {
            insertPayload.order_type = 'yearly';
            insertPayload.metadata = { plan_key: planKey };
        }
        const { error: orderErr } = await supabase.from('payment_orders').insert(insertPayload);
        if (orderErr) {
            console.error('payment_orders insert:', orderErr);
            return res.status(500).json({ error: '建立訂單失敗' });
        }
        const paypal = require('@paypal/checkout-server-sdk');
        const baseUrl = (process.env.BASE_URL || BASE_URL || '').replace(/\/$/, '') || ('http://localhost:' + (process.env.PORT || 3000));
        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: orderId,
                amount: { currency_code: 'USD', value: amount.toFixed(2) },
                description: credits + ' credits'
            }],
            application_context: {
                return_url: baseUrl + '/payment/return.html?provider=paypal&order_id=' + encodeURIComponent(orderId),
                cancel_url: baseUrl + '/payment/return.html?provider=paypal&cancel=1'
            }
        });
        const response = await paypalClient.execute(request);
        const approvalUrl = response.result.links && response.result.links.find(l => l.rel === 'approve');
        if (!approvalUrl || !approvalUrl.href) {
            return res.status(500).json({ error: '無法取得 PayPal 付款連結' });
        }
        await supabase.from('payment_orders').update({ external_id: response.result.id }).eq('order_id', orderId);
        res.json({ approval_url: approvalUrl.href, order_id: orderId });
    } catch (e) {
        console.error('POST /api/payment/paypal/create 異常:', e);
        res.status(500).json({ error: e.message || '系統錯誤' });
    }
});

// POST /api/payment/paypal/capture — 用戶從 PayPal 返回後帶 token 來完成請款並入點
app.post('/api/payment/paypal/capture', express.json(), async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const token = (req.body || {}).token || req.query.token;
        if (!token) return res.status(400).json({ error: '缺少 token' });
        const config = await getPaymentConfig();
        const paypalClient = getPayPalClient(config.paypal);
        if (!paypalClient) return res.status(503).json({ error: 'PayPal 金流尚未設定' });
        const paypal = require('@paypal/checkout-server-sdk');
        const request = new paypal.orders.OrdersCaptureRequest(token);
        request.requestBody({});
        const response = await paypalClient.execute(request);
        const paypalOrderId = response.result.id;
        const refId = (response.result.purchase_units && response.result.purchase_units[0] && response.result.purchase_units[0].reference_id) || '';
        const { data: order, error: ordErr } = await supabase
            .from('payment_orders')
            .select('id, user_id, credits_to_grant, status, order_type, metadata')
            .eq('external_id', paypalOrderId)
            .eq('provider', 'paypal')
            .single();
        if (ordErr || !order || order.user_id !== user.id) {
            return res.status(404).json({ error: '找不到對應訂單' });
        }
        if (order.status === 'paid') {
            const { data: c } = await supabase.from('user_credits').select('balance').eq('user_id', user.id).maybeSingle();
            return res.json({ success: true, balance_after: (c && c.balance) ? c.balance : 0 });
        }
        const credits = order.credits_to_grant;
        const paidAt = new Date().toISOString();
        await supabase.from('payment_orders').update({ status: 'paid', paid_at: paidAt }).eq('id', order.id);
        const { data: cred } = await supabase.from('user_credits').select('balance, total_earned, total_spent').eq('user_id', user.id).maybeSingle();
        const balanceBefore = (cred && cred.balance) ? cred.balance : 0;
        const balanceAfter = balanceBefore + credits;
        const totalEarned = (cred && cred.total_earned) ? cred.total_earned + credits : credits;
        if (cred) {
            await supabase.from('user_credits').update({
                balance: balanceAfter,
                total_earned: totalEarned,
                updated_at: paidAt
            }).eq('user_id', user.id);
        } else {
            await supabase.from('user_credits').insert({
                user_id: user.id,
                balance: balanceAfter,
                total_earned: totalEarned,
                total_spent: 0,
                updated_at: paidAt
            });
        }
        await supabase.from('credit_transactions').insert({
            user_id: user.id,
            type: 'purchase',
            amount: credits,
            balance_after: balanceAfter,
            source: 'purchase',
            description: 'PayPal 儲值',
            metadata: { order_id: refId, provider: 'paypal' }
        });
        if (order.order_type === 'yearly' && order.metadata && order.metadata.plan_key) {
            const planKey = order.metadata.plan_key;
            const { data: plan } = await supabase.from('subscription_plans').select('id').eq('plan_key', planKey).maybeSingle();
            if (plan) {
                const start = new Date();
                const end = new Date(start);
                end.setFullYear(end.getFullYear() + 1);
                await supabase.from('user_subscriptions').insert({
                    user_id: order.user_id,
                    plan_id: plan.id,
                    start_date: start.toISOString(),
                    end_date: end.toISOString(),
                    status: 'active',
                    auto_renew: false
                });
                try {
                    await syncMembershipCatalogVisibility(order.user_id);
                } catch (syncErr) {
                    console.warn('syncMembershipCatalogVisibility:', syncErr && syncErr.message);
                }
            }
        }
        res.json({ success: true, balance_after: balanceAfter });
    } catch (e) {
        console.error('POST /api/payment/paypal/capture 異常:', e);
        res.status(500).json({ error: e.message || '系統錯誤' });
    }
});

// 小圖示：在 static 之前註冊，避免雲端/快取導致不顯示
const imgDir = path.join(__dirname, 'public', 'img');
function sendIcon(req, res, filename) {
    const filePath = path.join(imgDir, filename);
    if (fs.existsSync(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.sendFile(filePath);
    }
    res.status(204).end();
}
app.get('/favicon.ico', (req, res) => sendIcon(req, res, 'favicon.ico'));
app.get('/img/favicon.ico', (req, res) => sendIcon(req, res, 'favicon.ico'));
app.get('/img/favicon-32x32.png', (req, res) => sendIcon(req, res, 'favicon-32x32.png'));
app.get('/img/favicon-16x16.png', (req, res) => sendIcon(req, res, 'favicon-16x16.png'));
app.get('/img/apple-touch-icon.png', (req, res) => sendIcon(req, res, 'apple-touch-icon.png'));

// vendor-profile 動態 OG：有 ?id= 時依廠商資料輸出 meta，供社群爬蟲與分享預覽
app.get('/vendor-profile.html', async (req, res, next) => {
    const id = (req.query.id || '').trim();
    if (!id) return next();
    try {
        const { data: mfr } = await supabase.from('manufacturers').select('id, name, description, logo_url').eq('id', id).maybeSingle();
        if (!mfr) return next();
        let coverUrl = mfr.logo_url || null;
        if (!coverUrl) {
            const { data: first } = await supabase.from('manufacturer_portfolio').select('image_url').eq('manufacturer_id', id).order('sort_order', { ascending: true }).limit(1).maybeSingle();
            if (first && first.image_url) coverUrl = first.image_url;
        }
        const origin = (req.get('x-forwarded-proto') && req.get('host')) ? `${req.get('x-forwarded-proto')}://${req.get('host')}` : null;
        const base = origin || BASE_URL;
        const pageUrl = base + '/vendor-profile.html?id=' + encodeURIComponent(id);
        const supabaseOrigin = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
        if (coverUrl && coverUrl.startsWith('http') && supabaseOrigin && coverUrl.startsWith(supabaseOrigin + '/')) {
            coverUrl = base + '/api/proxy-image?url=' + encodeURIComponent(coverUrl);
        }
        const name = (mfr.name || '廠商').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const desc = ((mfr.description || '') + ' - MATCHDO 合做').trim().slice(0, 160).replace(/</g, '&lt;').replace(/"/g, '&quot;') || (name + ' - 在 MATCHDO 合做瀏覽廠商作品與聯繫方式');
        const htmlPath = path.join(__dirname, 'public', 'vendor-profile.html');
        if (!fs.existsSync(htmlPath)) return next();
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace(/<title>[^<]*<\/title>/, '<title>' + name + ' - MATCHDO 合做</title>');
        html = html.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + desc + '">');
        html = html.replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + name + ' - MATCHDO 合做">');
        html = html.replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + desc + '">');
        html = html.replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + (coverUrl || (base + '/img/og-vendors.jpg')) + '">');
        html = html.replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + pageUrl.replace(/"/g, '&quot;') + '">');
        html = html.replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + name + ' - MATCHDO 合做">');
        html = html.replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + desc + '">');
        html = html.replace(/<meta name="twitter:image" content="[^"]*">/, '<meta name="twitter:image" content="' + (coverUrl || (base + '/img/og-vendors.jpg')) + '">');
        html = html.replace(/<link rel="canonical" href="[^"]*" id="canonicalTag">/, '<link rel="canonical" href="' + pageUrl.replace(/"/g, '&quot;') + '" id="canonicalTag">');
        html = html.replace(/<link rel="alternate" hreflang="zh-TW" href="[^"]*" id="hreflangZh">/, '<link rel="alternate" hreflang="zh-TW" href="' + pageUrl.replace(/"/g, '&quot;') + '" id="hreflangZh">');
        html = html.replace(/<link rel="alternate" hreflang="en" href="[^"]*" id="hreflangEn">/, '<link rel="alternate" hreflang="en" href="' + pageUrl.replace(/"/g, '&quot;') + '&lang=en" id="hreflangEn">');
        html = html.replace(/<link rel="alternate" hreflang="x-default" href="[^"]*">/, '<link rel="alternate" hreflang="x-default" href="' + pageUrl.replace(/"/g, '&quot;') + '">');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(html);
    } catch (e) {
        console.error('GET /vendor-profile.html 動態 OG 異常:', e && e.message);
        next();
    }
});

app.use(express.static(path.join(__dirname, 'public')));
// 錯誤連結修正：/public/custom/* → /custom/*
app.get(/^\/public\/custom\/?(.*)$/, (req, res) => {
    const rest = (req.path.match(/^\/public\/custom\/?(.*)$/) || [])[1] || '';
    res.redirect(302, '/custom' + (rest ? '/' + rest : ''));
});
app.use('/uploads', express.static(uploadDir));

// 圖片代理：僅允許 Supabase Storage 網址，同源輸出以避免跨域 __cf_bm Cookie 警告與部分「圖片截斷」問題
const SUPABASE_STORAGE_ORIGIN = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
app.get('/api/proxy-image', (req, res) => {
    const raw = req.query.url;
    if (!raw || typeof raw !== 'string') return res.status(400).send('Missing url');
    let decoded;
    try { decoded = decodeURIComponent(raw); } catch (_) { return res.status(400).send('Invalid url'); }
    if (!SUPABASE_STORAGE_ORIGIN || !decoded.startsWith(SUPABASE_STORAGE_ORIGIN + '/')) {
        return res.status(400).send('URL not allowed');
    }
    (async () => {
        try {
            const resp = await fetch(decoded, { method: 'GET', redirect: 'follow' });
            if (!resp.ok) {
                res.status(resp.status === 404 ? 404 : 502).send(resp.statusText || 'Upstream error');
                return;
            }
            const ct = resp.headers.get('content-type') || 'application/octet-stream';
            res.setHeader('Content-Type', ct);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            const buf = await resp.arrayBuffer();
            res.end(Buffer.from(buf));
        } catch (e) {
            console.error('proxy-image error:', e.message);
            if (!res.headersSent) res.status(502).send('Proxy error');
        }
    })();
});

// 提供 client 和 expert 目錄的靜態服務
app.use('/client', express.static(path.join(__dirname, 'client')));
app.use('/expert', express.static(path.join(__dirname, 'expert')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
// 提供 js 和 config 目錄的靜態服務
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/config', express.static(path.join(__dirname, 'config')));

// 啟動時若分類為空，從預設 JSON 引導一次（主分類 ai_categories + 子分類 ai_subcategories）
async function bootstrapCategories() {
    try {
        const { data, error } = await supabase
            .from('ai_categories')
            .select('key')
            .limit(1);
        if (error) {
            console.warn('檢查分類時發生錯誤：', error.message);
            return;
        }
        if (!data || data.length === 0) {
            const defaultsPath = path.join(__dirname, 'public', 'config', 'ai-categories.defaults.json');
            if (fs.existsSync(defaultsPath)) {
                try {
                    const raw = JSON.parse(fs.readFileSync(defaultsPath, 'utf-8'));
                    const list = raw.categories || [];
                    if (!list.length) return;
                    const mainPayload = list.map(c => ({ key: c.key, name: c.name, prompt: c.prompt || '' }));
                    const { error: upErr } = await supabase.from('ai_categories').upsert(mainPayload, { onConflict: 'key' });
                    if (upErr) {
                        console.warn('匯入預設主分類失敗：', upErr.message);
                        return;
                    }
                    let subCount = 0;
                    for (const c of list) {
                        const subs = Array.isArray(c.sub) ? c.sub : [];
                        for (let i = 0; i < subs.length; i++) {
                            const name = subs[i];
                            const subKey = c.key + '__' + String(name).replace(/\s+/g, '_').slice(0, 100);
                            const { error: subErr } = await supabase.from('ai_subcategories').upsert(
                                { key: subKey, name, category_key: c.key, sort_order: i },
                                { onConflict: 'key' }
                            );
                            if (!subErr) subCount++;
                        }
                    }
                    console.log(`已從預設檔匯入 ${list.length} 筆主分類、${subCount} 筆子分類`);
                } catch (e) {
                    console.warn('讀取/解析預設分類檔失敗：', e.message);
                }
            }
        }
    } catch (e) {
        console.warn('啟動分類引導時發生例外：', e.message);
    }
}

// AI 辨識階段：僅回傳項目陣列
app.post('/api/ai-detect', upload.array('designImages', 10), async (req, res) => {
    try {
        const files = req.files || [];
        const userDescription = req.body.userDescription || '';
        
        // 至少要有圖片或描述其中之一
        if (!files.length && !userDescription) {
            return res.status(400).json({ error: '請至少上傳一張設計圖或填寫需求描述' });
        }
        
        let base64Image = null;
        if (files.length > 0) {
            base64Image = (files[0].buffer || Buffer.from('')).toString('base64');
        }
        
        // 首頁換分類會送 req.body.category（主分類 key）、req.body.subcategory（子分類名稱）
        // 依 category 從 ai_categories 讀取該筆的 prompt；僅在「查無該筆或 prompt 為空」時用下方 fallback，不會改寫 DB 已儲存的提示詞
        const STRUCTURED_PROMPT_TEMPLATE = `你是專業企業服務與設計顧問,具備視覺設計分析與商業空間評估能力。

【分析流程】
1. 如用戶提供空間/設計稿/產品照片或影片,識別:
   - 業態類型(餐飲/零售/辦公/工廠等)
   - 空間風格與現況
   - 品牌視覺需求(Logo/招牌/包裝等)
   - 數位資產(網站/App/影片/圖檔)

2. 依據所選子分類「{subcategory}」,結合圖像資訊,列出:
   - 人力服務(設計師/開發者/行銷人員)
   - 交付項目(稿件/檔案/成品數量)
   - 周期與修改次數

3. 輸出格式:JSON 陣列 [{"item_name":"項目名稱", "spec":"規格說明", "quantity":數量, "unit":"單位"}]
   - 單位:式/件/場/個/小時/天
   - quantity 必須為數字

【注意事項】
- 無圖片時提供該類別標準服務包
- 標註交付時程與修改制度
- 區分初稿/精修/定稿階段`;
        let categoryPrompt = STRUCTURED_PROMPT_TEMPLATE.replace(/\{subcategory\}/g, req.body.subcategory || '該類別');
        
        if (req.body.category) {
            try {
                const { data, error } = await supabase
                    .from('ai_categories')
                    .select('prompt')
                    .eq('key', req.body.category)
                    .limit(1);
                if (!error && data && data[0] && data[0].prompt) {
                    categoryPrompt = data[0].prompt; // 使用 DB 已儲存的完整提示詞，不改寫
                    if (req.body.subcategory) {
                        categoryPrompt = categoryPrompt.replace(/\{subcategory\}/g, req.body.subcategory);
                    } else {
                        categoryPrompt = categoryPrompt.replace(/\{subcategory\}/g, '該類別');
                    }
                }
                // 若未進入上列 if，表示 DB 無該分類或 prompt 為空，沿用 fallback categoryPrompt（已含 {subcategory} 替換）
            } catch (e) {
                console.warn('無法讀取分類提示詞:', e.message);
            }
        }
        
        const prompt = req.body.prompt || categoryPrompt;
        let customPrompt = prompt;
        
        // 加入用戶描述
        if (userDescription) {
            customPrompt += `\n\n用戶需求描述：${userDescription}`;
            customPrompt += `\n請根據以上描述${base64Image ? '和圖片' : ''}來分析項目。`;
        }
        
        if (req.body.item) {
            customPrompt += `\n請優先辨識與「${req.body.item}」相關的項目。`;
        }
        if (req.body.unit) {
            customPrompt += `\n請將單位統一為「${req.body.unit}」或常見工程單位。`;
        }
        if (req.body.qty) {
            customPrompt += `\n若可判斷，請將「${req.body.item || '指定項目'}」的數量設為 ${req.body.qty}。`;
        }
        // 建立專案記錄（保留上傳檔與表單摘要）
        let tags = [];
        try {
          if (req.body.subcategories) tags = JSON.parse(req.body.subcategories);
        } catch {}
        const title = req.body.category ? `專案-${req.body.category}` : '專案-未分類';
        let project_id = null;
        let owner_id = null;
        // 先解析 token 以取得 owner_id，供上傳路徑與建立專案使用
        let token = null;
        if (req.headers.authorization) {
            token = req.headers.authorization.replace(/^\s*Bearer\s+/i, '');
        } else if (req.headers['x-auth-token']) {
            token = req.headers['x-auth-token'];
        }
        if (token) {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                if (!authError && user) owner_id = user.id;
            } catch (e) {}
        }
        let filesInfo = [];
        if (files.length > 0) {
            const pathPrefix = owner_id ? String(owner_id).replace(/-/g, '') : 'anon';
            for (const f of files) {
                try {
                    const { publicUrl } = await uploadToSupabaseStorage('project-images', pathPrefix, f);
                    filesInfo.push({ filename: f.originalname || 'image', url: publicUrl });
                } catch (e) {
                    console.warn('上傳至 Storage 失敗:', e.message);
                }
            }
        }
        if (owner_id) {
            try {
                // 收集動態欄位（優先使用 JSON 格式）
                let dynamicFields = {};
                if (req.body.dynamic_fields_json) {
                    try {
                        dynamicFields = JSON.parse(req.body.dynamic_fields_json);
                    } catch (e) {
                        console.warn('無法解析 dynamic_fields_json');
                    }
                }
                
                // 使用 SERVICE_ROLE_KEY 繞過 RLS
                const supabaseAdmin = createClient(
                    process.env.SUPABASE_URL,
                    process.env.SUPABASE_SERVICE_ROLE_KEY
                );
                
                const { data: projectInserted, error: insertError } = await supabaseAdmin
                    .from('projects')
                    .insert({
                        owner_id,
                        title,
                        description: JSON.stringify({ 
                            prompt, 
                            files: filesInfo,
                            subcategory: tags,
                            dynamic_fields: dynamicFields
                        }),
                        status: 'draft',
                        category: req.body.category || null,
                        subcategory: tags.length > 0 ? tags : null,
                        project_location: req.body.projectLocation ? [req.body.projectLocation] : []
                    })
                    .select('id')
                    .single();
                    
                if (!insertError && projectInserted && projectInserted.id) {
                    project_id = projectInserted.id;
                } else if (insertError) {
                    console.error('創建專案失敗:', insertError.message);
                }
            } catch (e) {
                console.error('創建專案例外:', e);
            }
        }

        // 構建 AI 請求內容
        const parts = [{ text: customPrompt }];
        if (base64Image) {
            parts.push({ inlineData: { mimeType: "image/jpeg", data: base64Image } });
        }
        
        const modelName = await getReadModelName();
        const result = await runInGeminiQueue(() => genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts }]
        }));
        const text = (result && result.text != null ? String(result.text) : '') || '';
        let items = [];
        try {
            // 支援 AI 回傳陣列或物件
            if (text.trim().startsWith('[')) {
                items = JSON.parse(text);
            } else {
                const aiResult = JSON.parse(text);
                items = aiResult.items || [];
            }
        } catch (e) {
            // 嘗試用正則抓取 JSON 區塊
            const match = text.match(/\[.*\]/s);
            if (match) {
                try {
                    items = JSON.parse(match[0]);
                } catch (e2) {
                    return res.status(500).json({ error: 'AI 回傳格式錯誤', raw: text, prompt: customPrompt });
                }
            } else {
                return res.status(500).json({ error: 'AI 回傳格式錯誤', raw: text, prompt: customPrompt });
            }
        }
        res.json({ success: true, project_id, items, uploaded_files: filesInfo });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '系統忙碌中，請稍後再試' });
    }
});

// 估價階段：接收前端編輯後的項目陣列
app.post('/api/quote', express.json(), async (req, res) => {
    try {
        const items = req.body.items || [];
        let finalQuote = [];
        let totalEstimate = 0;
        for (let item of items) {
            const { data: prices, error } = await supabase
                .from('price_library')
                .select('supplier_id, unit_price, item_name')
                .ilike('item_name', `%${item.item_name}%`)
                .limit(1);
            if (prices && prices.length > 0) {
                const price = prices[0].unit_price;
                const cost = price * item.quantity;
                totalEstimate += cost;
                finalQuote.push({
                    item: item.item_name,
                    spec: item.spec,
                    qty: item.quantity,
                    unit: item.unit,
                    matched_price: price,
                    subtotal: cost
                });
            } else {
                finalQuote.push({
                    item: item.item_name,
                    spec: item.spec,
                    qty: item.quantity,
                    unit: item.unit,
                    matched_price: "未找到報價",
                    subtotal: 0
                });
            }
        }
        res.json({ success: true, total: totalEstimate, details: finalQuote });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '系統忙碌中，請稍後再試' });
    }
});
// 查詢專案（驗證資料庫保存）
app.get('/api/projects/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', req.params.id)
            .limit(1);
        if (error) return res.status(500).json({ error: error.message });
        if (!data || !data.length) return res.status(404).json({ error: 'Not found' });
        res.json({ success: true, project: data[0] });
    } catch (e) {
        res.status(500).json({ error: '查詢失敗' });
    }
});
app.post('/api/analyze', upload.array('designImages', 10), async (req, res) => {
    try {
        const files = req.files || [];
        if (!files.length) return res.status(400).json({ error: '請至少上傳一張設計圖' });
        const base64Image = (files[0].buffer || Buffer.from('')).toString('base64');
        // 支援自訂 prompt、項目、單位
        const prompt = req.body.prompt || "你是一個專業的工程估算師。請分析這張設計圖，列出所有需要的施工項目。請嚴格輸出為 JSON 格式，包含: item_name (項目), spec (規格描述), quantity (數量), unit (單位: 坪/才/式/公尺)。請標準化項目名稱，例如統一使用 '超耐磨地板', '系統櫃', '油漆'。";
        // 若有指定項目/單位/數量，補充進 prompt
        let customPrompt = prompt;
        if (req.body.item) {
            customPrompt += `\n請優先辨識與「${req.body.item}」相關的項目。`;
        }
        if (req.body.unit) {
            customPrompt += `\n請將單位統一為「${req.body.unit}」或常見工程單位。`;
        }
        if (req.body.qty) {
            customPrompt += `\n若可判斷，請將「${req.body.item || '指定項目'}」的數量設為 ${req.body.qty}。`;
        }
        const modelName = await getReadModelName();
        const result = await runInGeminiQueue(() => genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: customPrompt }, { inlineData: { mimeType: 'image/jpeg', data: base64Image } }] }]
        }));
        const text = (result && result.text != null ? String(result.text) : '') || '';
        let aiResult;
        let items = [];
        try {
            aiResult = JSON.parse(text);
            items = aiResult.items || [];
        } catch (e) {
            // 嘗試用正則抓取 JSON 區塊
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    aiResult = JSON.parse(match[0]);
                    items = aiResult.items || [];
                } catch (e2) {
                    return res.status(500).json({ error: 'AI 回傳格式錯誤', raw: text, prompt: customPrompt });
                }
            } else {
                return res.status(500).json({ error: 'AI 回傳格式錯誤', raw: text, prompt: customPrompt });
            }
        }
        let finalQuote = [];
        let totalEstimate = 0;
        for (let item of items) {
            const { data: prices, error } = await supabase
                .from('price_library')
                .select('supplier_id, unit_price, item_name')
                .ilike('item_name', `%${item.item_name}%`)
                .limit(1);
            if (prices && prices.length > 0) {
                const price = prices[0].unit_price;
                const cost = price * item.quantity;
                totalEstimate += cost;
                finalQuote.push({
                    item: item.item_name,
                    spec: item.spec,
                    qty: item.quantity,
                    unit: item.unit,
                    matched_price: price,
                    subtotal: cost
                });
            } else {
                // 沒有報價也要列出
                finalQuote.push({
                    item: item.item_name,
                    spec: item.spec,
                    qty: item.quantity,
                    unit: item.unit,
                    matched_price: "未找到報價",
                    subtotal: 0
                });
            }
        }
        res.json({ success: true, total: totalEstimate, details: finalQuote });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '系統忙碌中，請稍後再試' });
    }
});

// 站點選單（供前台載入與後台編輯）
app.get('/api/site-menu', (req, res) => {
    try {
        const cfgPath = path.join(__dirname, 'public', 'config', 'site-menu.json');
        const raw = fs.readFileSync(cfgPath, 'utf-8');
        // 防止快取，確保前台能立即讀到最新選單
        res.set('Cache-Control', 'no-store');
        res.json(JSON.parse(raw));
    } catch (e) {
        res.status(500).json({ items: [], error: '讀取失敗' });
    }
});
app.put('/api/site-menu', express.json(), (req, res) => {
    try {
        const items = Array.isArray(req.body.items) ? req.body.items : [];
        const cfgPath = path.join(__dirname, 'public', 'config', 'site-menu.json');
        fs.writeFileSync(cfgPath, JSON.stringify({ items }, null, 2), 'utf-8');
        res.json({ success: true, count: items.length });
    } catch (e) {
        res.status(500).json({ error: '寫入失敗' });
    }
});

// 後台：媒合標籤過濾詞（去尾字後相同即相符），由 /admin/tag-strip.html 管理
app.get('/api/admin/tag-strip-suffixes', (req, res) => {
    try {
        res.json({ suffixes: getTagStripSuffixes() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.put('/api/admin/tag-strip-suffixes', express.json(), (req, res) => {
    try {
        const list = Array.isArray(req.body.suffixes) ? req.body.suffixes : [];
        const suffixes = list.map(w => (w || '').toString().trim()).filter(Boolean);
        const dir = path.dirname(tagStripSuffixesPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(tagStripSuffixesPath, JSON.stringify(suffixes, null, 2), 'utf-8');
        _tagStripSuffixesCache = null;
        res.json({ success: true, suffixes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 取得 AI 分類（唯一來源：ai_categories + ai_subcategories，前後端同一組資料）
app.get('/api/categories', async (req, res) => {
    try {
        let mainRows = null;
        let mainError = null;
        const { data: mainData, error: mainErr } = await supabase.from('ai_categories').select('key, name, prompt, sort_order');
        mainRows = mainData;
        mainError = mainErr;
        if (mainError) {
            const { data: fallback } = await supabase.from('ai_categories').select('key, name, prompt');
            if (fallback && fallback.length > 0) {
                mainRows = fallback;
                mainError = null;
            }
        }
        const { data: subRows, error: subError } = await supabase
            .from('ai_subcategories')
            .select('key, name, category_key, form_config, sort_order');

        if (mainError || !mainRows) {
            console.warn('GET /api/categories ai_categories 讀取失敗:', mainError && mainError.message);
            return res.status(500).json({ error: '讀取分類失敗：' + (mainError ? mainError.message : '無資料') });
        }

        const mainList = Array.isArray(mainRows) ? mainRows : [];
        if (mainList.length && mainList[0].sort_order != null) {
            mainList.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
        }
        const subByCategory = {};
        if (!subError && Array.isArray(subRows)) {
            subRows.forEach(s => {
                if (!subByCategory[s.category_key]) subByCategory[s.category_key] = [];
                subByCategory[s.category_key].push({ name: s.name, form_config: s.form_config || [], sort_order: s.sort_order });
            });
            Object.keys(subByCategory).forEach(k => subByCategory[k].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
        }

        const categories = mainList.map(m => ({
            key: m.key,
            name: m.name,
            prompt: m.prompt || '',
            sort_order: m.sort_order != null ? m.sort_order : 0,
            sub: (subByCategory[m.key] || []).map(s => s.name),
            sub_configs: (subByCategory[m.key] || []).reduce((acc, s) => {
                acc[s.name] = Array.isArray(s.form_config) ? s.form_config : (s.form_config || {});
                return acc;
            }, {})
        }));

        res.set('Cache-Control', 'no-store');
        res.json({ categories, via: 'split-db' });
    } catch (e) {
        console.error('GET /api/categories 異常:', e);
        res.status(500).json({ error: '載入分類失敗：' + e.message });
    }
});

// 計價單位只依「該分類」從 DB 撈（相同分類的專家報價用什麼單位，發包端／專家端就用什麼選項，不硬編碼）
app.get('/api/listings/units-by-category', async (req, res) => {
    try {
        const category = req.query.category;
        if (!category) return res.status(400).json({ error: '請提供 query 參數 category' });
        const { data: rows, error } = await supabase
            .from('listings')
            .select('unit')
            .eq('category', category)
            .eq('status', 'active')
            .not('unit', 'is', null);
        if (error) return res.status(500).json({ error: error.message });
        const raw = (rows || []).map(r => (r.unit || '').trim()).filter(Boolean);
        const units = [...new Set(raw)].sort();
        res.json({ success: true, category, units });
    } catch (e) {
        res.status(500).json({ error: '取得單位列表失敗' });
    }
});

// 獲取子分類及其 form_config
app.get('/api/subcategories', async (req, res) => {
    try {
        const category_key = req.query.category_key;
        if (!category_key) {
            return res.status(400).json({ error: '缺少 category_key 參數' });
        }
        
        const { data: subRows, error } = await supabase
            .from('ai_subcategories')
            .select('key, name, category_key, form_config, sort_order')
            .eq('category_key', category_key)
            .order('sort_order', { ascending: true });
        
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        
        const subcategories = (subRows || []).map(s => ({
            key: s.key,
            name: s.name,
            form_config: Array.isArray(s.form_config) ? s.form_config : []
        }));
        
        res.json({ success: true, subcategories });
    } catch (e) {
        res.status(500).json({ error: '獲取子分類失敗' });
    }
});

// 更新子分類的 form_config
app.post('/api/subcategories/update-config', express.json(), async (req, res) => {
    try {
        const { category_key, subcategory_name, form_config } = req.body;
        
        if (!category_key || !subcategory_name) {
            return res.status(400).json({ error: '缺少必要參數' });
        }
        
        // 根據 category_key 和 name 更新 form_config
        const { error } = await supabase
            .from('ai_subcategories')
            .update({ form_config: form_config || [] })
            .eq('category_key', category_key)
            .eq('name', subcategory_name);
        
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: '更新子分類配置失敗' });
    }
});

// 一鍵初始化居家子分類的 form_config（從 home-subcategory-form-fields.json 讀取）
// 【測試】查詢並強制插入/更新一筆測試資料
app.get('/api/test-first-subcat', async (req, res) => {
    try {
        // 1. 查詢總數
        const { count: totalCount } = await supabase
            .from('ai_subcategories')
            .select('*', { count: 'exact', head: true });
        
        // 2. 查詢 home 分類的資料
        const { data: homeData, error: selectError } = await supabase
            .from('ai_subcategories')
            .select('*')
            .eq('category_key', 'home')
            .limit(3);
        
        // 3. 嘗試插入一筆測試資料（如果不存在）
        const testKey = 'home__清潔服務';
        const testFields = [
            {"name":"area","label":"施作坪數","type":"number","unit":"坪","required":true,"placeholder":"請輸入坪數"},
            {"name":"clean_type","label":"清潔類型","type":"select","required":true,"options":["日常清潔","空屋細清"]},
            {"name":"floor_elevator","label":"樓層與電梯","type":"text","required":true}
        ];
        
        // 先嘗試更新
        const { data: updateResult, error: updateError } = await supabase
            .from('ai_subcategories')
            .update({ form_config: testFields })
            .eq('key', testKey)
            .select();
        
        let insertResult = null;
        let insertError = null;
        
        // 如果更新沒有影響任何行，嘗試插入
        if (!updateResult || updateResult.length === 0) {
            const insertData = await supabase
                .from('ai_subcategories')
                .insert({
                    key: testKey,
                    name: '清潔服務',
                    category_key: 'home',
                    form_config: testFields,
                    sort_order: 0
                })
                .select();
            
            insertResult = insertData.data;
            insertError = insertData.error;
        }
        
        // 4. 再次查詢確認
        const { data: afterData } = await supabase
            .from('ai_subcategories')
            .select('key, name, form_config')
            .eq('key', testKey)
            .single();
        
        res.json({ 
            success: true,
            total_count: totalCount,
            home_data_count: homeData ? homeData.length : 0,
            home_data_sample: homeData ? homeData.slice(0, 1) : null,
            update_test: {
                updated: updateResult && updateResult.length > 0,
                update_error: updateError ? updateError.message : null,
                insert_result: insertResult ? '已插入' : '未插入',
                insert_error: insertError ? insertError.message : null
            },
            after_operation: afterData
        });
    } catch (e) {
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

// 【測試】更新單一記錄
app.post('/api/test-update-one', express.json(), async (req, res) => {
    try {
        const { key, fields } = req.body;
        console.log(`[TEST-UPDATE] key=${key}, fields 數量=${fields ? fields.length : 'null'}`);
        console.log(`[TEST-UPDATE] fields=`, JSON.stringify(fields));
        
        const { data, error } = await supabase
            .from('ai_subcategories')
            .update({ form_config: fields })
            .eq('key', key)
            .select('key, name, form_config');
        
        console.log(`[TEST-UPDATE] 結果: data=${data ? data.length : 'null'}, error=${error ? error.message : 'null'}`);
        
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        
        res.json({ success: true, updated: data && data.length > 0, data });
    } catch (e) {
        console.error('[TEST-UPDATE] 例外:', e);
        res.status(500).json({ error: e.message });
    }
});

// 【強制更新】居家子分類 form_config（直接寫入，不檢查）
app.post('/api/subcategories/force-init-home', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'docs', 'home-subcategory-form-fields.json');
        console.log('[FORCE-INIT] 讀取檔案:', filePath);
        
        const raw = fs.readFileSync(filePath, 'utf-8');
        console.log('[FORCE-INIT] 檔案長度:', raw.length);
        
        const json = JSON.parse(raw);
        console.log('[FORCE-INIT] JSON 解析成功, subcategories 數量:', json.subcategories ? json.subcategories.length : 'null');
        
        if (!json.subcategories || !Array.isArray(json.subcategories)) {
            return res.status(400).json({ error: '檔案格式錯誤', json });
        }
        
        let results = [];
        let index = 0;
        
        for (const sub of json.subcategories) {
            index++;
            console.log(`[FORCE-INIT ${index}/${json.subcategories.length}] 處理: ${sub.key}, 欄位數: ${sub.fields.length}`);
            
            try {
                // 強制更新（不檢查是否存在）
                const { data, error, count } = await supabase
                    .from('ai_subcategories')
                    .update({ form_config: sub.fields })
                    .eq('key', sub.key)
                    .select('key, name, form_config');
                
                console.log(`[FORCE-INIT ${index}] Supabase 回應: data=${data ? data.length : 'null'}, error=${error ? error.message : 'null'}`);
                
                if (error) {
                    console.error(`[FORCE-INIT ${index}] ERROR:`, error);
                    results.push({ key: sub.key, status: 'ERROR', message: error.message });
                } else if (data && data.length > 0) {
                    const updatedConfig = data[0].form_config;
                    console.log(`[FORCE-INIT ${index}] SUCCESS: ${sub.key}, 欄位數: ${updatedConfig ? updatedConfig.length : 0}`);
                    results.push({ 
                        key: sub.key, 
                        status: 'SUCCESS', 
                        fields_count: Array.isArray(updatedConfig) ? updatedConfig.length : 0
                    });
                } else {
                    console.warn(`[FORCE-INIT ${index}] NOT_FOUND: ${sub.key} (data 為空)`);
                    results.push({ key: sub.key, status: 'NOT_FOUND', message: '資料庫中不存在此 key' });
                }
            } catch (err) {
                console.error(`[FORCE-INIT ${index}] EXCEPTION:`, err);
                results.push({ key: sub.key, status: 'EXCEPTION', message: err.message });
            }
        }
        
        const successCount = results.filter(r => r.status === 'SUCCESS').length;
        console.log(`[FORCE-INIT] 完成！成功: ${successCount}/${json.subcategories.length}`);
        
        res.json({ 
            success: true,
            total: json.subcategories.length,
            success_count: successCount,
            results
        });
    } catch (e) {
        console.error('[FORCE-INIT] 失敗:', e);
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

app.post('/api/subcategories/init-home', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'docs', 'home-subcategory-form-fields.json');
        const raw = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(raw);
        
        if (!json.subcategories || !Array.isArray(json.subcategories)) {
            return res.status(400).json({ error: '檔案格式錯誤' });
        }
        
        let count = 0;
        let errors = [];
        
        for (const sub of json.subcategories) {
            console.log(`更新子分類: ${sub.key}, 欄位數: ${sub.fields.length}`);
            
            const { data, error } = await supabase
                .from('ai_subcategories')
                .update({ form_config: sub.fields })
                .eq('key', sub.key)
                .select();
            
            if (error) {
                console.error(`更新 ${sub.key} 失敗:`, error);
                errors.push(`${sub.key}: ${error.message}`);
            } else if (data && data.length > 0) {
                console.log(`✓ 已更新 ${sub.key}`);
                count++;
            } else {
                console.warn(`⚠ ${sub.key} 不存在於資料庫`);
                errors.push(`${sub.key}: 不存在`);
            }
        }
        
        res.json({ 
            success: true, 
            count, 
            total: json.subcategories.length,
            message: `已初始化 ${count}/${json.subcategories.length} 個居家子分類的必填欄位`,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (e) {
        console.error('初始化失敗:', e);
        res.status(500).json({ error: e.message });
    }
});

// 預覽一鍵匯入的內容（讀取 default-categories.json，不寫入 DB）
app.get('/api/categories/preview-default', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'public', 'config', 'default-categories.json');
        const raw = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(raw);
        const list = Array.isArray(json.categories) ? json.categories : [];
        const summary = list.map(c => ({
            key: c.key,
            name: c.name,
            subCount: Array.isArray(c.sub) ? c.sub.length : 0
        }));
        res.set('Cache-Control', 'no-store');
        res.json({ categories: list, summary, message: '此為 default-categories.json 內容，一鍵匯入會寫入以上項目' });
    } catch (e) {
        res.status(500).json({ error: '讀取預設檔失敗：' + e.message });
    }
});

// 一鍵匯入預設分類（主分類 + 子分類；從 default-categories.json 讀取；保留 DB 已有提示詞不覆寫）
app.post('/api/categories/import-default', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'public', 'config', 'default-categories.json');
        const raw = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(raw);
        const list = Array.isArray(json.categories) ? json.categories : [];
        if (!list.length) return res.status(400).json({ error: '預設分類清單為空' });

        const keys = list.map(c => c.key).filter(Boolean);
        const { data: existingRows } = await supabase.from('ai_categories').select('key, prompt').in('key', keys);
        const existingByKey = {};
        if (Array.isArray(existingRows)) existingRows.forEach(r => { existingByKey[r.key] = r; });

        const mainPayload = list.map(c => {
            const existing = existingByKey[c.key];
            const prompt = (existing && existing.prompt && String(existing.prompt).trim()) ? existing.prompt : (c.prompt || '');
            return { key: c.key, name: c.name, prompt };
        });
        const { error: mainErr } = await supabase.from('ai_categories').upsert(mainPayload, { onConflict: 'key' });
        if (mainErr) {
            try { fs.writeFileSync(LOCAL_CATEGORIES_PATH, JSON.stringify({ categories: list }, null, 2), 'utf-8'); } catch {}
            res.set('Cache-Control', 'no-store');
            return res.json({ success: false, error: mainErr.message });
        }
        let subCount = 0;
        for (const c of list) {
            const subs = Array.isArray(c.sub) ? c.sub : [];
            for (let i = 0; i < subs.length; i++) {
                const item = subs[i];
                const subKey = (typeof item === 'object' && item != null && item.key != null)
                    ? String(item.key).slice(0, 200)
                    : (c.key + '__' + String(item).replace(/\s+/g, '_').slice(0, 100));
                const name = (typeof item === 'object' && item != null && item.name != null)
                    ? String(item.name)
                    : String(item);
                const { error: subErr } = await supabase.from('ai_subcategories').upsert(
                    { key: subKey, name, category_key: c.key, sort_order: i },
                    { onConflict: 'key' }
                );
                if (!subErr) subCount++;
            }
        }
        try { fs.writeFileSync(LOCAL_CATEGORIES_PATH, JSON.stringify({ categories: list }, null, 2), 'utf-8'); } catch {}
        res.set('Cache-Control', 'no-store');
        return res.json({ success: true, count: list.length, subCount, message: '已匯入；DB 內已有之主分類提示詞已保留未覆寫' });
    } catch (e) {
        res.status(500).json({ error: '匯入預設分類失敗' });
    }
});

// 更新分類（主分類 ai_categories + 子分類 ai_subcategories）
app.put('/api/categories', express.json(), async (req, res) => {
    try {
        const categories = Array.isArray(req.body.categories) ? req.body.categories : [];
        if (!categories.length) return res.status(400).json({ error: '無有效資料' });

        for (let idx = 0; idx < categories.length; idx++) {
            const cat = categories[idx];
            if (!cat.key || !String(cat.key).trim()) {
                console.warn('PUT /api/categories 略過 key 為空的主分類');
                continue;
            }
            // 1. 主分類寫入 ai_categories（含 sort_order）
            const { error: mainErr } = await supabase
                .from('ai_categories')
                .upsert({
                    key: cat.key.trim(),
                    name: (cat.name || '').trim(),
                    prompt: cat.prompt || '',
                    sort_order: cat.sort_order != null ? cat.sort_order : idx
                }, { onConflict: 'key' });

            if (mainErr) {
                console.warn('ai_categories upsert failed:', mainErr.message);
            }

            // 2. 子分類寫入 ai_subcategories（僅當前端有送 sub 陣列且非空時才覆寫；避免 sub 為空時誤刪全部子分類）
            if (cat.sub && Array.isArray(cat.sub) && cat.sub.length > 0) {
                const { data: existingSubs } = await supabase
                    .from('ai_subcategories')
                    .select('key, name, form_config')
                    .eq('category_key', cat.key);
                const existingByKey = {};
                const existingByName = {};
                if (existingSubs && existingSubs.length > 0) {
                    existingSubs.forEach(s => {
                        existingByKey[s.key] = s;
                        existingByName[s.name] = { key: s.key, form_config: s.form_config };
                    });
                    await supabase.from('ai_subcategories').delete().eq('category_key', cat.key);
                }
                const subPayload = cat.sub.map((subName, subIdx) => {
                    const existing = existingByName[subName];
                    const subKey = (existing && existing.key) ? existing.key : (cat.key + '__' + String(subName).replace(/\s+/g, '_').slice(0, 100));
                    const fromFront = cat.sub_configs && cat.sub_configs[subName];
                    const fromDb = existing && existing.form_config;
                    const form_config = fromFront !== undefined && fromFront !== null
                        ? fromFront
                        : (fromDb !== undefined && fromDb !== null ? fromDb : []);
                    return {
                        key: subKey,
                        name: subName,
                        category_key: cat.key,
                        form_config,
                        sort_order: subIdx
                    };
                });
                const { error: subErr } = await supabase.from('ai_subcategories').upsert(subPayload, { onConflict: 'key' });
                if (subErr) console.warn('ai_subcategories upsert failed:', subErr.message);
            }
        }

        res.json({ success: true, message: '分類資料已儲存', count: categories.length });
    } catch (e) {
        console.error('PUT /api/categories 異常:', e);
        res.status(500).json({ error: '儲存失敗：' + e.message });
    }
});

// 除錯：容器內路徑與首頁檔案是否存在（修好 File not found 後可刪或改為僅 NODE_ENV!==production）
app.get('/api/debug-path', (req, res) => {
    const p = path.join(__dirname, 'public');
    const idx = path.join(__dirname, 'public', 'iStudio-1.0.0', 'index.html');
    let list = [];
    try { list = fs.readdirSync(p); } catch (e) { list = [e.message]; }
    res.json({
        __dirname,
        cwd: process.cwd(),
        publicExists: fs.existsSync(p),
        indexExists: fs.existsSync(idx),
        indexPath: idx,
        publicDirContents: list,
    });
});

// 健康檢查（環境與資料庫對應狀態）
app.get('/api/health', async (req, res) => {
    const info = {
        env: {
            SUPABASE_URL: !!process.env.SUPABASE_URL,
            SUPABASE_KEY: !!process.env.SUPABASE_KEY,
            SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            SUPABASE_DB_URL: !!process.env.SUPABASE_DB_URL
        },
        supabase: { ok: false },
        db: { ok: false },
    };
    try {
        const { data, error } = await supabase.from('ai_categories').select('key').limit(1);
        if (error) {
            info.supabase.error = error.message;
        } else {
            info.supabase.ok = true;
            info.supabase.count = Array.isArray(data) ? data.length : 0;
        }
    } catch (e) {
        info.supabase.error = e.message;
    }
    if (DB_URL) {
        try {
            const pool = new Pool({ connectionString: DB_URL });
            const client = await pool.connect();
            const r = await client.query('select to_regclass(\'public.ai_categories\') as exists, (select count(*) from public.ai_categories) as cnt');
            client.release();
            await pool.end();
            info.db.ok = !!r.rows[0].exists;
            info.db.count = r.rows[0].cnt || 0;
        } catch (e2) {
            info.db.error = e2.message;
        }
    }
    res.set('Cache-Control', 'no-store');
    res.json(info);
});

// 前台用公開設定（導航是否顯示服務媒合等，由 ENV 控制）
app.get('/api/public-config', (req, res) => {
    // 文件：服務媒合開關預設關閉，僅 ENABLE_SERVICE_MATCHING=true 時顯示
    const enableServiceMatching = process.env.ENABLE_SERVICE_MATCHING === 'true';
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ enableServiceMatching });
});

// 一鍵匯入預設分類（主分類 + 子分類獨立表）
app.post('/api/categories/seed-defaults', async (req, res) => {
    try {
        const defaultsPath = path.join(__dirname, 'public', 'config', 'ai-categories.defaults.json');
        if (!fs.existsSync(defaultsPath)) {
            return res.status(404).json({ error: '找不到預設分類檔' });
        }
        const raw = JSON.parse(fs.readFileSync(defaultsPath, 'utf-8'));
        const list = raw.categories || [];
        if (!list.length) return res.status(400).json({ error: '預設檔無有效資料' });
        const mainPayload = list.map(c => ({ key: c.key, name: c.name, prompt: c.prompt || '' }));
        const { error: mainErr } = await supabase.from('ai_categories').upsert(mainPayload, { onConflict: 'key' });
        if (mainErr) return res.status(500).json({ error: mainErr.message });
        let subCount = 0;
        for (const c of list) {
            const subs = Array.isArray(c.sub) ? c.sub : [];
            for (let i = 0; i < subs.length; i++) {
                const name = subs[i];
                const subKey = c.key + '__' + String(name).replace(/\s+/g, '_').slice(0, 100);
                const { error: subErr } = await supabase.from('ai_subcategories').upsert(
                    { key: subKey, name, category_key: c.key, sort_order: i },
                    { onConflict: 'key' }
                );
                if (!subErr) subCount++;
            }
        }
        res.json({ success: true, count: list.length, subCount });
    } catch (e) {
        res.status(500).json({ error: '匯入預設分類失敗' });
    }
});

// ===== 客製產品 API =====

const BFL_BASE = 'https://api.bfl.ai';
const BFL_FLUX_PRO = BFL_BASE + '/v1/flux-2-pro';

/** Admin Playground 可用模型 → BFL path */
const BFL_PLAYGROUND_MODELS = {
    'flux-2-max': '/v1/flux-2-max',
    'flux-2-pro': '/v1/flux-2-pro',
    'flux-2-flex': '/v1/flux-2-flex',
    'flux-2-klein-9b': '/v1/flux-2-klein-9b',
    'flux-2-klein-4b': '/v1/flux-2-klein-4b'
};
function getBflPlaygroundEndpoint(model) {
    const path = BFL_PLAYGROUND_MODELS[model] || BFL_PLAYGROUND_MODELS['flux-2-pro'];
    return BFL_BASE + path;
}

/** 共用的 BFL 輪詢取圖：createData 含 polling_url，輪詢到 Ready 後下載 sample 回傳 Buffer */
async function pollBflResult(createData, BFL_API_KEY) {
    const pollingUrl = createData.polling_url;
    if (!pollingUrl) throw new Error('BFL 未回傳 polling_url');
    for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const pollRes = await fetch(pollingUrl, {
            headers: { 'accept': 'application/json', 'x-key': BFL_API_KEY }
        });
        const pollData = await pollRes.json();
        if (pollData.status === 'Ready' && pollData.result && pollData.result.sample) {
            const imageRes = await fetch(pollData.result.sample);
            return Buffer.from(await imageRes.arrayBuffer());
        }
        if (pollData.status === 'Error' || pollData.status === 'Failed') {
            throw new Error(pollData.message || pollData.error || 'FLUX 生成失敗');
        }
    }
    throw new Error('FLUX 逾時');
}

/** FLUX 2.0 PRO 純文字生圖；BFL 僅 body.prompt（無 negative_prompt），prompt 可含製造限制句 */
async function generateImageWithFlux2ProTextToImage(prompt, seed, outputFormat) {
    const BFL_API_KEY = process.env.BFL_API_KEY;
    if (!BFL_API_KEY) return null;
    prompt = await translatePromptToEnglishForFlux(prompt);
    const fmt = (outputFormat === 'png' || outputFormat === 'jpeg') ? outputFormat : 'jpeg';
    const body = {
        prompt,
        width: 1024,
        height: 1024,
        output_format: fmt,
        safety_tolerance: 2
    };
    if (seed != null && Number.isInteger(Number(seed))) body.seed = Number(seed);
    const createRes = await fetch(BFL_FLUX_PRO, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'Content-Type': 'application/json', 'x-key': BFL_API_KEY },
        body: JSON.stringify(body)
    });
    if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`BFL create: ${createRes.status} ${errText}`);
    }
    const createData = await createRes.json();
    return pollBflResult(createData, BFL_API_KEY);
}

/** FLUX 2.0 PRO 參考圖編輯；BFL 僅 body.prompt（無 negative_prompt） */
async function generateImageWithFlux2Pro(prompt, referenceImages, seed, outputFormat) {
    const BFL_API_KEY = process.env.BFL_API_KEY;
    if (!BFL_API_KEY || !referenceImages || referenceImages.length === 0) return null;
    prompt = await translatePromptToEnglishForFlux(prompt);
    const fmt = (outputFormat === 'png' || outputFormat === 'jpeg') ? outputFormat : 'jpeg';
    const maxImages = 8;
    const images = referenceImages.slice(0, maxImages).map((img) => {
        if (typeof img === 'string' && img.startsWith('data:')) {
            const m = img.match(/^data:image\/\w+;base64,(.+)$/);
            return m ? m[1] : img;
        }
        return img;
    });
    const body = { prompt, output_format: fmt, width: 1024, height: 1024 };
    if (seed != null && Number.isInteger(Number(seed))) body.seed = Number(seed);
    body.input_image = images[0];
    for (let i = 1; i < images.length; i++) body[`input_image_${i + 1}`] = images[i];
    const createRes = await fetch(BFL_FLUX_PRO, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'Content-Type': 'application/json', 'x-key': BFL_API_KEY },
        body: JSON.stringify(body)
    });
    if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`BFL create: ${createRes.status} ${errText}`);
    }
    const createData = await createRes.json();
    return pollBflResult(createData, BFL_API_KEY);
}

/** 廠商素材：數位原型＝商品圖重繪（可選底色）；材料＝滿版圖樣優化（不用底色，見 material-swatch-plan） */
async function optimizeVendorAssetImageWithFlux(fileBuffer, mimeType, title, assetKind, materialCatalogHint, backgroundColor) {
    if (!fileBuffer || !fileBuffer.length) throw new Error('無效的參考圖');
    const isMaterial = normalizeVendorAssetKind(assetKind) === 'material';
    const prompt = isMaterial
        ? buildVendorAssetMaterialOptimizePrompt(title, materialCatalogHint)
        : buildVendorAssetProductOptimizePrompt(title, backgroundColor);
    const mime = mimeType || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${fileBuffer.toString('base64')}`;
    const buf = await generateImageWithFlux2Pro(prompt, [dataUrl], null, 'jpeg');
    if (!buf || !buf.length) throw new Error('圖片優化服務未設定或暫時無法使用（BFL_API_KEY）');
    return buf;
}

/** 通用 BFL 文生圖（指定 endpoint、解析度），供 Admin Playground 使用；不串任何系統提示詞 */
async function bflPlaygroundTextToImage(endpointUrl, prompt, width, height, seed, outputFormat, BFL_API_KEY) {
    prompt = await translatePromptToEnglishForFlux(prompt);
    const body = {
        prompt,
        width: Math.min(2048, Math.max(512, Number(width) || 1024)),
        height: Math.min(2048, Math.max(512, Number(height) || 1024)),
        output_format: (outputFormat === 'png' || outputFormat === 'jpeg') ? outputFormat : 'jpeg',
        safety_tolerance: 2
    };
    if (seed != null && Number.isInteger(Number(seed))) body.seed = Number(seed);
    const createRes = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'Content-Type': 'application/json', 'x-key': BFL_API_KEY },
        body: JSON.stringify(body)
    });
    if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`BFL create: ${createRes.status} ${errText}`);
    }
    const createData = await createRes.json();
    return pollBflResult(createData, BFL_API_KEY);
}

/** 通用 BFL 圖生圖（指定 endpoint、解析度），供 Admin Playground 使用；不串任何系統提示詞 */
async function bflPlaygroundImageEdit(endpointUrl, prompt, referenceImages, width, height, seed, outputFormat, BFL_API_KEY) {
    prompt = await translatePromptToEnglishForFlux(prompt);
    const images = referenceImages.slice(0, 8).map((img) => {
        if (typeof img === 'string' && img.startsWith('data:')) {
            const m = img.match(/^data:image\/\w+;base64,(.+)$/);
            return m ? m[1] : img;
        }
        return img;
    });
    const w = Math.min(2048, Math.max(512, Number(width) || 1024));
    const h = Math.min(2048, Math.max(512, Number(height) || 1024));
    const body = { prompt, output_format: (outputFormat === 'png' || outputFormat === 'jpeg') ? outputFormat : 'jpeg', width: w, height: h, input_image: images[0] };
    if (seed != null && Number.isInteger(Number(seed))) body.seed = Number(seed);
    for (let i = 1; i < images.length; i++) body[`input_image_${i + 1}`] = images[i];
    const createRes = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'Content-Type': 'application/json', 'x-key': BFL_API_KEY },
        body: JSON.stringify(body)
    });
    if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`BFL create: ${createRes.status} ${errText}`);
    }
    const createData = await createRes.json();
    return pollBflResult(createData, BFL_API_KEY);
}

// 依分類 key 陣列取得後端基礎提示詞並與使用者描述組合（後端處理，不暴露給前端）
async function buildPromptFromCategoryKeys(categoryKeys, userPrompt) {
    if (!categoryKeys || !Array.isArray(categoryKeys) || categoryKeys.length === 0)
        return userPrompt;
    const keys = [...new Set(categoryKeys)].filter(Boolean);
    const prompts = [];
    const { data: mains } = await supabase.from('custom_product_categories').select('key, prompt').in('key', keys).eq('is_active', true);
    const mainMap = {};
    (mains || []).forEach(m => { mainMap[m.key] = (m.prompt || '').trim(); });
    const { data: subs } = await supabase.from('custom_product_subcategories').select('key, prompt').in('key', keys).eq('is_active', true);
    const subMap = {};
    (subs || []).forEach(s => { if (!mainMap[s.key]) subMap[s.key] = (s.prompt || '').trim(); });
    keys.forEach(k => {
        const p = mainMap[k] || subMap[k] || '';
        if (p) prompts.push(p);
    });
    const base = prompts.join('\n\n').trim();
    return base ? base + '\n\n' + userPrompt : userPrompt;
}

// 設計風向分類：從 remake_categories / remake_subcategories 取 prompt（供 /api/generate-product-image?categorySource=remake）
async function buildPromptFromRemakeCategoryKeys(categoryKeys, userPrompt) {
    if (!categoryKeys || !Array.isArray(categoryKeys) || categoryKeys.length === 0)
        return userPrompt;
    const keys = [...new Set(categoryKeys)].filter(Boolean);
    const prompts = [];
    const { data: mains } = await supabase.from('remake_categories').select('key, prompt').in('key', keys).eq('is_active', true);
    const mainMap = {};
    (mains || []).forEach(m => { mainMap[m.key] = (m.prompt || '').trim(); });
    const { data: subs } = await supabase.from('remake_subcategories').select('key, prompt').in('key', keys).eq('is_active', true);
    const subMap = {};
    (subs || []).forEach(s => { if (!mainMap[s.key]) subMap[s.key] = (s.prompt || '').trim(); });
    keys.forEach(k => {
        const p = mainMap[k] || subMap[k] || '';
        if (p) prompts.push(p);
    });
    const base = prompts.join('\n\n').trim();
    return base ? base + '\n\n' + userPrompt : userPrompt;
}

// 實境模擬：通用系統提示詞（後台未設定時使用）
const DEFAULT_SCENE_SIM_SYSTEM_PROMPT = 'Seamlessly place the product into the provided environment or person image. Keep the product clearly visible and well-integrated. Match lighting, shadows, and perspective to the scene. Output a single photorealistic image.';

const DEFAULT_PATTERN_EXTRACT_SYSTEM_PROMPT = 'Analyze the reference image and extract its core artistic motif. Generate a clean, flat, high-resolution 2D standalone graphic design. The output must be a single, centered flat artwork on a solid white background, completely isolated from any physical product or 3D environment. No mockups, no shading, zero perspective distortion. Optimized for apparel DTG printing or decal application with sharp edge clarity.';

const DEFAULT_PATTERN_EXTRACT_SEAMLESS_PROMPT = 'Analyze the reference image and extract its core aesthetic, texture, and color palette. Generate a completely flat, 2D seamless repeating pattern. The design must be perfectly tileable with consistent edge-matching, allowing for infinite repetition top-to-bottom and left-to-right without any visible seams or borders. Uniform flat studio lighting, zero 3D distortion or mockups. High-resolution print-ready textile surface design.';

// 實境模擬：從 payment_config 讀取系統提示詞（供生圖 API 組合用；空則用上方預設）
async function getSceneSimSystemPrompt() {
    const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'scene_sim_system_prompt').maybeSingle();
    const value = (row && row.value != null) ? String(row.value).trim() : '';
    return value || DEFAULT_SCENE_SIM_SYSTEM_PROMPT;
}

// 圖樣提取：從 payment_config 讀取系統提示詞；空則用上方預設
async function getPatternExtractSystemPrompt() {
    const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'pattern_extract_system_prompt').maybeSingle();
    const value = (row && row.value != null) ? String(row.value).trim() : '';
    return value || DEFAULT_PATTERN_EXTRACT_SYSTEM_PROMPT;
}

// 圖樣提取無縫拼接：從 payment_config 讀取；空則用上方預設
async function getPatternExtractSeamlessSystemPrompt() {
    const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'pattern_extract_seamless_system_prompt').maybeSingle();
    const value = (row && row.value != null) ? String(row.value).trim() : '';
    return value || DEFAULT_PATTERN_EXTRACT_SEAMLESS_PROMPT;
}

/** 將圖片參數轉成 BFL 用的 base64：data:image/xxx;base64,xxx 取後段；http(s) URL 則 fetch 後轉 base64 */
async function resolveImageToBase64(img) {
    if (!img || typeof img !== 'string') return null;
    const s = img.trim();
    if (s.startsWith('data:image/')) {
        const m = s.match(/^data:image\/\w+;base64,(.+)$/);
        return m ? m[1] : null;
    }
    if (s.startsWith('http://') || s.startsWith('https://')) {
        try {
            const resp = await fetch(s, { headers: { 'Accept': 'image/*' } });
            if (!resp.ok) return null;
            const buf = Buffer.from(await resp.arrayBuffer());
            return buf.toString('base64');
        } catch (e) {
            console.warn('resolveImageToBase64 fetch:', e.message);
            return null;
        }
    }
    return null;
}

/** 實境模擬：環境圖 + 產品圖 + 提示詞，送 BFL Flux 2 Pro 圖生圖，回傳 PNG buffer */
async function generateSceneSimulateImage(environmentImageBase64, productImageBase64, userPrompt, seed) {
    const BFL_API_KEY = process.env.BFL_API_KEY;
    if (!BFL_API_KEY || !environmentImageBase64 || !productImageBase64) return null;
    const systemPrompt = await getSceneSimSystemPrompt();
    let prompt = (userPrompt && String(userPrompt).trim())
        ? systemPrompt + '\n\nUser instruction: ' + String(userPrompt).trim()
        : systemPrompt;
    prompt = await translatePromptToEnglishForFlux(prompt);
    const body = {
        prompt,
        output_format: 'jpeg',
        width: 1024,
        height: 1024,
        input_image: environmentImageBase64,
        input_image_2: productImageBase64
    };
    if (seed != null && Number.isInteger(Number(seed))) body.seed = Number(seed);
    const createRes = await fetch(BFL_FLUX_PRO, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'Content-Type': 'application/json', 'x-key': BFL_API_KEY },
        body: JSON.stringify(body)
    });
    if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`BFL scene-sim: ${createRes.status} ${errText}`);
    }
    const createData = await createRes.json();
    return pollBflResult(createData, BFL_API_KEY);
}

/** 圖樣提取：單張圖 + 提示詞 + 可選無縫拼接 + 解析度 + 輸出格式，送 BFL 圖生圖（僅 input_image），回傳 buffer */
async function generatePatternExtractImage(imageBase64, userPrompt, seamless, seed, width, height, outputFormat) {
    const BFL_API_KEY = process.env.BFL_API_KEY;
    if (!BFL_API_KEY || !imageBase64) return null;
    const systemPrompt = seamless
        ? await getPatternExtractSeamlessSystemPrompt()
        : await getPatternExtractSystemPrompt();
    let prompt = (userPrompt && String(userPrompt).trim())
        ? systemPrompt + '\n\nUser instruction: ' + String(userPrompt).trim()
        : systemPrompt;
    prompt = await translatePromptToEnglishForFlux(prompt);
    const w = Math.min(2048, Math.max(512, parseInt(width, 10) || 1024));
    const h = Math.min(2048, Math.max(512, parseInt(height, 10) || 1024));
    const fmt = (outputFormat === 'png' || outputFormat === 'jpeg') ? outputFormat : 'jpeg';
    const body = {
        prompt,
        output_format: fmt,
        width: w,
        height: h,
        input_image: imageBase64
    };
    if (seed != null && Number.isInteger(Number(seed))) body.seed = Number(seed);
    const createRes = await fetch(BFL_FLUX_PRO, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'Content-Type': 'application/json', 'x-key': BFL_API_KEY },
        body: JSON.stringify(body)
    });
    if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`BFL pattern-extract: ${createRes.status} ${errText}`);
    }
    const createData = await createRes.json();
    return pollBflResult(createData, BFL_API_KEY);
}

// API: 實境模擬（環境/人物圖 + 產品圖 → 合成圖，不存數位資產）；需登入，成功後扣 points_scene_simulate（預設 20 點）
app.post('/api/scene-simulate', express.json(), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!currentUser) {
            return res.status(401).json({ success: false, error: '請先登入後再使用實境模擬' });
        }
        const { environmentImage, productImage, prompt } = req.body;
        if (!environmentImage || typeof environmentImage !== 'string') {
            return res.status(400).json({ success: false, error: '請上傳環境或人物圖片' });
        }
        if (!productImage || typeof productImage !== 'string') {
            return res.status(400).json({ success: false, error: '請選擇產品圖片' });
        }
        const envBase64 = await resolveImageToBase64(environmentImage);
        const productBase64 = await resolveImageToBase64(productImage);
        if (!envBase64) {
            return res.status(400).json({ success: false, error: '環境圖片無法讀取，請重新上傳' });
        }
        if (!productBase64) {
            return res.status(400).json({ success: false, error: '產品圖片無法讀取，請重新選擇' });
        }
        if (!process.env.BFL_API_KEY) {
            return res.status(503).json({ success: false, error: '實境模擬服務暫未設定，請稍後再試' });
        }
        const seed = Math.floor(Math.random() * 2147483647);
        const buffer = await generateSceneSimulateImage(envBase64, productBase64, prompt || '', seed);
        if (!buffer) {
            return res.status(500).json({ success: false, error: '生圖失敗，請稍後再試' });
        }
        const imageData = buffer.toString('base64');
        if (!isAdmin) {
            const pointsToDeduct = await getPointsSceneSimulate();
            if (pointsToDeduct > 0) {
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'scene_simulate',
                    description: '實境模擬',
                    metadata: {}
                });
            }
        }
        res.json({
            success: true,
            imageData: `data:image/png;base64,${imageData}`,
            seed
        });
    } catch (error) {
        console.error('實境模擬錯誤:', error);
        res.status(500).json({
            success: false,
            error: error.message || '實境模擬失敗，請稍後再試'
        });
    }
});

// API: 圖樣提取（單張圖 → 提取圖樣，可選無縫拼接）；依輸出解析度計價：1 MP=20 點，每多 1 MP +10 點（MP 無條件進位，上限 4 MP）
app.post('/api/pattern-extract', express.json(), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!currentUser) {
            return res.status(401).json({ success: false, error: '請先登入後再使用圖樣提取' });
        }
        const { image, prompt: userPrompt, seamless, width, height, output_format } = req.body;
        if (!image || typeof image !== 'string') {
            return res.status(400).json({ success: false, error: '請上傳一張圖片' });
        }
        const w = Math.min(2048, Math.max(512, parseInt(width, 10) || 1024));
        const h = Math.min(2048, Math.max(512, parseInt(height, 10) || 1024));
        const pointsToDeduct = await getPointsPatternExtractForResolution(w, h);
        if (!isAdmin && pointsToDeduct > 0) {
            const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
            const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
            if (balance < pointsToDeduct) {
                return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
            }
        }
        const imageBase64 = await resolveImageToBase64(image);
        if (!imageBase64) {
            return res.status(400).json({ success: false, error: '圖片無法讀取，請重新上傳' });
        }
        if (!process.env.BFL_API_KEY) {
            return res.status(503).json({ success: false, error: '圖樣提取服務暫未設定，請稍後再試' });
        }
        const outputFormat = (output_format === 'png' || output_format === 'jpeg') ? output_format : 'jpeg';
        const seed = Math.floor(Math.random() * 2147483647);
        const buffer = await generatePatternExtractImage(imageBase64, userPrompt || '', !!seamless, seed, w, h, outputFormat);
        if (!buffer) {
            return res.status(500).json({ success: false, error: '生圖失敗，請稍後再試' });
        }
        const imageData = buffer.toString('base64');
        const mime = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
        if (!isAdmin && pointsToDeduct > 0) {
            const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
            const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
            const balanceAfter = balance - pointsToDeduct;
            const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
            await supabase.from('user_credits').upsert({
                user_id: currentUser.id,
                balance: balanceAfter,
                total_spent: totalSpent,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
            const ctRes = await supabase.from('credit_transactions').insert({
                user_id: currentUser.id,
                type: 'consumed',
                amount: -pointsToDeduct,
                balance_after: balanceAfter,
                source: 'pattern_extract',
                description: '圖樣提取',
                metadata: {}
            });
            if (ctRes.error) console.warn('pattern_extract credit_transactions insert:', ctRes.error?.message);
        }
        res.json({
            success: true,
            imageData: `data:${mime};base64,${imageData}`,
            seed
        });
    } catch (error) {
        console.error('圖樣提取錯誤:', error);
        res.status(500).json({
            success: false,
            error: error.message || '圖樣提取失敗，請稍後再試'
        });
    }
});

// API: 生成產品示意圖（categoryKeys 必填，後端組合基礎提示詞 + 使用者描述）
// categorySource: 'remake' 時使用 remake_categories 的 prompt，否則使用訂製分類
app.post('/api/generate-product-image', express.json({ limit: '15mb' }), async (req, res) => {
    try {
        const { prompt, categoryKeys, aspectRatio = '1:1', resolution = '2K', referenceImages, referenceSources, seed, categorySource, output_format } = req.body;
        const outputFormat = (output_format === 'png' || output_format === 'jpeg') ? output_format : 'jpeg';
        if (!prompt) {
            return res.status(400).json({ success: false, error: '請提供產品描述' });
        }
        if (!categoryKeys || !Array.isArray(categoryKeys) || categoryKeys.length === 0) {
            return res.status(400).json({ success: false, error: '請至少選擇一項圖內容分類' });
        }
        const useRemake = (categorySource === 'remake' || categorySource === 'remake_categories');
        const hasRefs = referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0;
        if (useRemake && !hasRefs) {
            return res.status(400).json({ success: false, error: '設計風向須上傳至少一張參考圖' });
        }

        // ── 步驟 1：取得使用者資訊，在生圖前先確認點數夠（避免 BFL 費用白花）──
        let currentUser = null;
        let isAdmin = false;
        let pointsToDeduct = 0;
        let currentBalance = 0;
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (!authError && user) {
                currentUser = user;
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                if (!isAdmin) {
                    const basePoints = hasRefs ? await getPointsImageToImage() : await getPointsTextToImage();
                    pointsToDeduct = await applyAnnualDiscount(user.id, basePoints);
                    const { data: creditRow } = await supabase
                        .from('user_credits').select('balance').eq('user_id', user.id).maybeSingle();
                    currentBalance = creditRow?.balance ?? 0;
                    if (currentBalance < pointsToDeduct) {
                        return res.status(402).json({
                            success: false,
                            error: `點數不足，本次生圖需要 ${pointsToDeduct} 點，目前餘額 ${currentBalance} 點`,
                            required: pointsToDeduct,
                            balance: currentBalance
                        });
                    }
                }
            }
        }

        let fullPrompt = useRemake
            ? await buildPromptFromRemakeCategoryKeys(categoryKeys, prompt)
            : await buildPromptFromCategoryKeys(categoryKeys, prompt);
        const uiLang = (req.body.ui_locale || req.body.lang || '').trim() || null;
        let fluxReferenceImages = hasRefs ? referenceImages : [];
        let fluxReferenceSources = hasRefs ? (referenceSources || []) : [];
        if (hasRefs) {
            const ordered = reorderFluxReferenceInputs(referenceImages, referenceSources);
            fluxReferenceImages = ordered.images;
            fluxReferenceSources = ordered.sources;
            const prototypeAssets = await resolvePrototypeAssetsForPrompt(fluxReferenceSources);
            const protoAppendix = buildPrototypeCustomizationPromptAppendix(prototypeAssets, uiLang);
            if (protoAppendix) fullPrompt = (fullPrompt || '').trim() + protoAppendix;
            const materialRefs = await resolveMaterialRefsForPrompt(fluxReferenceSources);
            const materialAppendix = buildMaterialTexturePromptAppendix(materialRefs, uiLang);
            if (materialAppendix) fullPrompt = (fullPrompt || '').trim() + materialAppendix;
        }
        // 使用者未填 seed 時由後端產生隨機 seed，傳給 FLUX 並寫入 DB，方便重現與顯示
        let seedNum = (seed != null && seed !== '' && Number.isInteger(Number(seed))) ? Number(seed) : null;
        if (seedNum == null) seedNum = Math.floor(Math.random() * 2147483647);

        let imageData = null;
        let usedFlux = false;

        // ── 步驟 2：呼叫 BFL 生圖 ──
        if (process.env.BFL_API_KEY) {
            try {
                if (hasRefs) {
                    const buffer = await generateImageWithFlux2Pro(fullPrompt, fluxReferenceImages, seedNum, outputFormat);
                    if (buffer) { imageData = buffer.toString('base64'); usedFlux = true; }
                } else {
                    const buffer = await generateImageWithFlux2ProTextToImage(fullPrompt, seedNum, outputFormat);
                    if (buffer) { imageData = buffer.toString('base64'); usedFlux = true; }
                }
            } catch (e) {
                console.warn('FLUX 2.0 pro 失敗:', e.message);
            }
        }

        if (!imageData) {
            return res.status(500).json({
                success: false,
                error: process.env.BFL_API_KEY
                    ? 'FLUX 生圖失敗，請稍後再試或調整描述' + (hasRefs ? '與參考圖' : '')
                    : '未設定 BFL_API_KEY，無法生圖'
            });
        }

        // ── 步驟 3：生圖成功，上傳 Storage ──
        const buffer = Buffer.from(imageData, 'base64');
        const ext = outputFormat === 'png' ? 'png' : 'jpg';
        const mime = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
        let imageUrl = null;
        try {
            const { publicUrl } = await uploadToSupabaseStorage('custom-products', 'generated', { buffer, mimetype: mime, originalname: `generated-${Date.now()}.${ext}` }, { ext, contentType: mime });
            imageUrl = publicUrl;
        } catch (e) {
            console.warn('上傳生成圖至 Storage 失敗:', e.message);
        }
        if (!imageUrl) imageUrl = `data:${mime};base64,${imageData}`;

        // ── 先回傳生成成功，不與扣點／寫入綁在一起 ──
        res.json({
            success: true,
            imageUrl,
            imageData: `data:${mime};base64,${imageData}`,
            output_format: outputFormat,
            resolution: '1024x1024',
            aspectRatio: '1:1',
            usedFlux,
            seedUsed: seedNum,
            mode: hasRefs ? 'image-to-image' : 'text-to-image'
        });

        // ── 扣點與寫入 custom_products 在回傳之後執行，失敗只 log 不影響前端 ──
        if (currentUser) {
            (async () => {
                try {
                    if (!isAdmin && pointsToDeduct > 0) {
                        const newBalance = currentBalance - pointsToDeduct;
                        const { error: updErr } = await supabase.from('user_credits')
                            .update({ balance: newBalance, updated_at: new Date().toISOString() })
                            .eq('user_id', currentUser.id);
                        if (updErr) { console.warn('扣點更新 user_credits 失敗:', updErr.message); return; }
                        const { error: creditErr } = await supabase.from('credit_transactions').insert({
                            user_id: currentUser.id,
                            type: 'consumed',
                            amount: -pointsToDeduct,
                            balance_after: newBalance,
                            source: hasRefs ? 'image_to_image' : 'text_to_image',
                            description: hasRefs ? `圖生圖（${pointsToDeduct} 點）` : `文生圖（${pointsToDeduct} 點）`
                        });
                        if (creditErr) console.warn('寫入 credit_transactions 失敗:', creditErr.message);
                        else console.log('生圖扣點 user=%s points=%d balance_after=%d', currentUser.id, pointsToDeduct, newBalance);
                    }
                    const title = (prompt && String(prompt).trim()) ? String(prompt).trim().substring(0, 80) + (String(prompt).trim().length > 80 ? '…' : '') : '產品草圖';
                    const description = (prompt && String(prompt).trim()) || '（無描述）';
                    const generationPromptVal = (prompt && String(prompt).trim()) ? String(prompt).trim() : null;
                    const mainCategoryKey = (categoryKeys && categoryKeys[0]) ? String(categoryKeys[0]).trim() || null : null;
                    const subCategoryKey = (categoryKeys && categoryKeys.length >= 2 && categoryKeys[1]) ? String(categoryKeys[1]).trim() || null : null;
                    const showOnHomepage = !(await hasActivePaidSubscription(currentUser.id));
                    const autoInsertPayload = {
                        owner_id: currentUser.id,
                        title, description,
                        category: mainCategoryKey,
                        subcategory_key: subCategoryKey,
                        reference_image_url: null,
                        ai_generated_image_url: imageUrl,
                        analysis_json: null,
                        status: 'draft',
                        generation_prompt: generationPromptVal,
                        generation_seed: seedNum,
                        show_on_homepage: showOnHomepage
                    };
                    const autoUiLocale = (req.body.ui_locale || req.body.lang || '').trim() || null;
                    mergeDesignerRegionIntoPayload(autoInsertPayload, req, autoUiLocale);
                    let insertRes = await supabase.from('custom_products').insert(autoInsertPayload).select('id').single();
                    if (insertRes.error && insertRes.error.code === '42703') {
                        insertRes = await supabase.from('custom_products')
                            .insert(stripInternalCustomProductInsertColumns(autoInsertPayload))
                            .select('id').single();
                    }
                    const insertedProduct = insertRes.data;
                    const insertErr = insertRes.error;
                    if (insertErr) console.error('寫入 custom_products 失敗:', insertErr.message);
                    else {
                        console.log('已寫入 custom_products owner_id=%s', currentUser.id);
                        if (insertedProduct && insertedProduct.id && imageUrl) {
                            enrichCustomProductSemantics(insertedProduct.id, currentUser.id, {
                                imageUrl,
                                generationPrompt: generationPromptVal,
                                title,
                                categoryKey: mainCategoryKey
                            }).catch(() => {});
                        }
                    }
                } catch (e) {
                    console.error('扣點或寫入 custom_products 異常:', e.message);
                }
            })();
        }
    } catch (error) {
        console.error('生成圖片錯誤:', error);
        res.status(500).json({
            success: false,
            error: '圖片生成失敗，請檢查描述是否清楚或稍後再試',
            details: error.message
        });
    }
});

// API: Admin Playground 生圖（文生圖／圖生圖；管理員與測試員可用）
app.post('/api/admin/playground-generate', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdminOrTester(req, res);
        if (!adminUser) return;
        const BFL_API_KEY = process.env.BFL_API_KEY;
        if (!BFL_API_KEY) {
            return res.status(503).json({ success: false, error: '未設定 BFL_API_KEY，無法生圖' });
        }
        const { prompt, referenceImage, referenceImages, model = 'flux-2-pro', width = 1024, height = 1024, seed, output_format } = req.body;
        const rawPrompt = (prompt && String(prompt).trim()) ? String(prompt).trim() : '';
        if (!rawPrompt) {
            return res.status(400).json({ success: false, error: '請輸入描述（prompt）' });
        }
        const outputFormat = (output_format === 'png' || output_format === 'jpeg') ? output_format : 'jpeg';
        const endpointUrl = getBflPlaygroundEndpoint(model);
        const w = Math.min(2048, Math.max(512, Number(width) || 1024));
        const h = Math.min(2048, Math.max(512, Number(height) || 1024));
        let seedNum = (seed != null && seed !== '' && Number.isInteger(Number(seed))) ? Number(seed) : null;
        if (seedNum == null) seedNum = Math.floor(Math.random() * 2147483647);

        let refList = Array.isArray(referenceImages) && referenceImages.length > 0
            ? referenceImages
            : (referenceImage && typeof referenceImage === 'string' && referenceImage.length > 0 ? [referenceImage] : []);
        refList = refList.slice(0, 8).filter(Boolean);

        let buffer;
        if (refList.length > 0) {
            buffer = await bflPlaygroundImageEdit(endpointUrl, rawPrompt, refList, w, h, seedNum, outputFormat, BFL_API_KEY);
        } else {
            buffer = await bflPlaygroundTextToImage(endpointUrl, rawPrompt, w, h, seedNum, outputFormat, BFL_API_KEY);
        }
        if (!buffer) {
            return res.status(500).json({ success: false, error: 'FLUX 生圖失敗' });
        }
        const imageData = buffer.toString('base64');
        const mime = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
        res.json({
            success: true,
            imageData: `data:${mime};base64,${imageData}`,
            output_format: outputFormat,
            width: w,
            height: h,
            seedUsed: seedNum
        });
    } catch (error) {
        console.error('Admin playground 生圖錯誤:', error);
        res.status(500).json({
            success: false,
            error: error.message || '生圖失敗，請稍後再試'
        });
    }
});

// ---------- AI 放大（Stability Fast Upscale） ----------
const FREE_MEMBER_LEVEL_LABEL = '一般';

/** 後台「會員等級」：一般＝免費；進階／尊榮／VIP（及非「一般」之自訂名）＝付費權益 */
function isPaidMemberLevel(memberLevel) {
    const level = (memberLevel != null ? String(memberLevel).trim() : '') || FREE_MEMBER_LEVEL_LABEL;
    return level !== FREE_MEMBER_LEVEL_LABEL;
}

async function readProfileMemberLevel(userId) {
    if (!userId) return FREE_MEMBER_LEVEL_LABEL;
    try {
        const { data } = await supabase.from('profiles').select('member_level').eq('id', userId).maybeSingle();
        return (data && data.member_level) ? String(data.member_level).trim() : FREE_MEMBER_LEVEL_LABEL;
    } catch (_) {
        return FREE_MEMBER_LEVEL_LABEL;
    }
}

/** 是否視為付費會員：有效 user_subscriptions（方案價>0）或 profiles.member_level 非「一般」 */
async function hasActivePaidSubscription(userId) {
    if (!userId) return false;
    const now = new Date().toISOString();
    const { data: rows } = await supabase
        .from('user_subscriptions')
        .select('id, subscription_plans(price)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('end_date', now);
    if (rows && rows.length > 0 && rows.some(r => (r.subscription_plans && (r.subscription_plans.price || 0) > 0))) {
        return true;
    }
    return isPaidMemberLevel(await readProfileMemberLevel(userId));
}

const VENDOR_ASSET_MEMBERSHIP_HIDE_COL = 'public_hidden_by_membership';
const VENDOR_ASSET_PLATFORM_MANAGED_COL = 'platform_managed';

async function isStaffProfileUserId(userId) {
    if (!userId) return false;
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    const role = data && data.role ? String(data.role) : '';
    return role === 'admin' || role === 'tester';
}

async function isSeedManufacturerAccountUserId(userId) {
    if (!userId) return false;
    const { data } = await supabase.from('manufacturers').select('vendor_source').eq('user_id', userId).maybeSingle();
    return !!(data && data.vendor_source === 'seed');
}

/** 限制 A：免費帳號不可上傳（種子展示期平台代維護、管理員／測試員除外） */
async function canUploadProductsAndAssetsUserId(userId) {
    if (!userId) return false;
    if (await isStaffProfileUserId(userId)) return true;
    if (await isSeedManufacturerAccountUserId(userId)) return true;
    return hasActivePaidSubscription(userId);
}

async function assertCanUploadProductsAndAssets(req, res) {
    const user = await getCurrentUser(req, res);
    if (!user) return null;
    const allowed = await canUploadProductsAndAssetsUserId(user.id);
    if (!allowed) {
        res.status(403).json({
            error: '免費帳號無法上傳產品與素材，請升級付費方案後再試',
            code: 'MEMBERSHIP_UPLOAD_REQUIRED'
        });
        return null;
    }
    return user;
}

function manufacturerExemptFromMembershipCatalog(mfr) {
    if (!mfr) return true;
    const src = mfr.vendor_source ? String(mfr.vendor_source) : '';
    return src === 'seed' || src === 'platform';
}

async function readProfileMembershipCatalogTier(userId) {
    try {
        const { data, error } = await supabase.from('profiles').select('membership_catalog_tier').eq('id', userId).maybeSingle();
        if (error && error.code === '42703') return null;
        return (data && data.membership_catalog_tier) ? String(data.membership_catalog_tier) : null;
    } catch (_) {
        return null;
    }
}

async function writeProfileMembershipCatalogTier(userId, tier) {
    try {
        await supabase.from('profiles').update({ membership_catalog_tier: tier }).eq('id', userId);
    } catch (_) { /* 欄位未建時略過 */ }
}

/** 僅在付費↔免費「轉換」時處理；不掃每次登入。不動種子／平台代管／管理員上傳素材。 */
async function syncMembershipCatalogVisibility(userId) {
    if (!userId) return;
    if (await isStaffProfileUserId(userId)) return;

    const tierNow = (await hasActivePaidSubscription(userId)) ? 'paid' : 'free';
    const tierPrev = await readProfileMembershipCatalogTier(userId);
    if (tierPrev === tierNow) return;

    await writeProfileMembershipCatalogTier(userId, tierNow);
    if (tierPrev === 'paid' && tierNow === 'free') {
        await hideVendorAssetsOnMembershipDowngrade(userId);
        return;
    }
    if (tierPrev === 'free' && tierNow === 'paid') {
        await restoreVendorAssetsAfterMembershipUpgrade(userId);
    }
}

async function hideVendorAssetsOnMembershipDowngrade(userId) {
    const now = new Date().toISOString();
    const { data: mfr } = await supabase
        .from('manufacturers')
        .select('id, vendor_source')
        .eq('user_id', userId)
        .maybeSingle();
    if (!mfr || manufacturerExemptFromMembershipCatalog(mfr)) return;

    let { data: publicRows, error: selErr } = await supabase
        .from('vendor_assets')
        .select('id')
        .eq('manufacturer_id', mfr.id)
        .eq('is_public', true)
        .eq(VENDOR_ASSET_PLATFORM_MANAGED_COL, false);
    if (selErr && selErr.code === '42703') {
        ({ data: publicRows } = await supabase
            .from('vendor_assets')
            .select('id')
            .eq('manufacturer_id', mfr.id)
            .eq('is_public', true));
    }
    const ids = (publicRows || []).map((r) => r.id).filter(Boolean);
    if (!ids.length) return;

    const hide = { is_public: false, updated_at: now };
    hide[VENDOR_ASSET_MEMBERSHIP_HIDE_COL] = true;
    const { error } = await supabase.from('vendor_assets').update(hide).in('id', ids);
    if (error && error.code === '42703') {
        console.warn('syncMembershipCatalogVisibility: 請執行 docs/add-membership-catalog-visibility.sql（勿在無標記欄位時批量下架）');
    } else if (error) {
        console.error('syncMembershipCatalogVisibility hide vendor_assets:', error.message);
    }
}

async function restoreVendorAssetsAfterMembershipUpgrade(userId) {
    const now = new Date().toISOString();
    const { data: mfr } = await supabase
        .from('manufacturers')
        .select('id, vendor_source')
        .eq('user_id', userId)
        .maybeSingle();
    if (!mfr || manufacturerExemptFromMembershipCatalog(mfr)) return;

    const restore = { is_public: true, updated_at: now };
    restore[VENDOR_ASSET_MEMBERSHIP_HIDE_COL] = false;
    const { error } = await supabase
        .from('vendor_assets')
        .update(restore)
        .eq('manufacturer_id', mfr.id)
        .eq(VENDOR_ASSET_MEMBERSHIP_HIDE_COL, true);
    if (error && error.code === '42703') {
        console.warn('vendor_assets.public_hidden_by_membership 未建，無法還原會員下架素材');
    } else if (error) {
        console.error('syncMembershipCatalogVisibility restore vendor_assets:', error.message);
    }
}
// 是否為有效年繳訂閱（duration_months >= 12，用於生圖 6 折）
async function hasAnnualSubscription(userId) {
    if (!userId) return false;
    const now = new Date().toISOString();
    const { data: rows } = await supabase
        .from('user_subscriptions')
        .select('id, subscription_plans(price, duration_months)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('end_date', now);
    if (!rows || rows.length === 0) return false;
    return rows.some(r => (r.subscription_plans && (r.subscription_plans.duration_months || 0) >= 12));
}
// 訂閱會員「我的 AI 編輯區」點數打 6 折（至少 1 點）
async function applyAiEditDiscountForSubscriber(userId, points) {
    if (!userId || points <= 0) return points;
    const isPaid = await hasActivePaidSubscription(userId);
    if (!isPaid) return points;
    return Math.max(1, Math.round(points * 0.6));
}
// 年繳會員點數打 6 折（至少 1 點）
async function applyAnnualDiscount(userId, points) {
    if (!userId || points <= 0) return points;
    const isAnnual = await hasAnnualSubscription(userId);
    if (!isAnnual) return points;
    return Math.max(1, Math.round(points * 0.6));
}

// 讀取 points_text_to_image（文生圖，預設 15）
async function getPointsTextToImage() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_text_to_image');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 15);
}
// 讀取 points_image_to_image（圖生圖，預設 20）
async function getPointsImageToImage() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_image_to_image');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 20);
}

// 廠商素材上傳（含 AI 標籤，預設 5 點）
async function getPointsVendorAssetUpload() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_vendor_asset_upload');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 5);
}

// 數位原型上傳 + 產品圖優化（含標籤，預設 15 點）
async function getPointsVendorAssetOptimize() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_vendor_asset_optimize');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 15);
}

// 材料參考上傳 + 材質圖優化（含標籤，預設 10 點）
async function getPointsVendorAssetMaterialOptimize() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_vendor_asset_material_optimize');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 10);
}

async function getPointsVendorAssetOptimizeForKind(assetKind) {
    return normalizeVendorAssetKind(assetKind) === 'material'
        ? getPointsVendorAssetMaterialOptimize()
        : getPointsVendorAssetOptimize();
}

async function getPointsVendorAssetDescription() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_vendor_asset_description');
    const v = rows && rows[0] && rows[0].value != null ? parseInt(rows[0].value, 10) : NaN;
    return Number.isFinite(v) && v >= 0 ? v : 1;
}

async function checkUserCreditsBalance(userId, required) {
    const { data: credRow } = await supabase.from('user_credits').select('balance').eq('user_id', userId).maybeSingle();
    const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
    return { balance, sufficient: balance >= required };
}

/** 扣點；餘額不足回傳 { ok: false } */
async function consumeUserCredits(userId, points, source, description, metadata = {}) {
    if (!userId || points <= 0) return { ok: true, balance_after: null, skipped: true };
    const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', userId).maybeSingle();
    const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
    if (balance < points) return { ok: false, error: '點數不足', balance, required: points };
    const balanceAfter = balance - points;
    const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + points;
    const now = new Date().toISOString();
    const { error: upErr } = await supabase.from('user_credits').upsert({
        user_id: userId,
        balance: balanceAfter,
        total_spent: totalSpent,
        updated_at: now
    }, { onConflict: 'user_id' });
    if (upErr) return { ok: false, error: upErr.message || '扣點失敗' };
    await supabase.from('credit_transactions').insert({
        user_id: userId,
        type: 'consumed',
        amount: -points,
        balance_after: balanceAfter,
        source: source || 'consumed',
        description: description || '',
        metadata: metadata || {}
    });
    return { ok: true, balance_after: balanceAfter };
}
// 讀取 points_ai_upscale（供扣點用）
async function getPointsAIUpscale() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_upscale');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 10);
}

async function getPointsSceneSimulate() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_scene_simulate');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 20);
}

/** 圖樣提取計價：依「總解析度」總像素 (寬×高) 計算，不依長寬比。1 MP = 1024×1024 像素，總像素無條件進位到整數 MP，上限 4 MP。 */
function patternExtractMegapixelsFromResolution(width, height) {
    const w = Math.min(2048, Math.max(512, parseInt(width, 10) || 1024));
    const h = Math.min(2048, Math.max(512, parseInt(height, 10) || 1024));
    const totalPixels = w * h;  // 總解析度（總像素）
    const oneMp = 1024 * 1024;
    return Math.min(4, Math.ceil(totalPixels / oneMp) || 1);
}

/** 圖樣提取點數：基本 1 MP = 20 點，超過後每多 1 MP 多 10 點（對應官方：首 MP 較貴、後續較便宜）。 */
async function getPointsPatternExtractForResolution(width, height) {
    const { data: rows } = await supabase.from('payment_config').select('key, value').in('key', ['points_pattern_extract', 'points_pattern_extract_per_extra_mp']);
    const obj = {};
    (rows || []).forEach(r => { obj[r.key] = r.value; });
    const base = Math.max(0, parseInt(obj.points_pattern_extract, 10) || 20);
    const perExtra = Math.max(0, parseInt(obj.points_pattern_extract_per_extra_mp, 10) || 10);
    const mp = patternExtractMegapixelsFromResolution(width, height);
    return base + (mp - 1) * perExtra;
}

async function getPointsPatternExtract() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_pattern_extract');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 20);
}

// POST /api/upscale-image — 上傳圖片，Stability Fast 4x 放大；管理員不扣點，一般用戶成功後扣 points_ai_upscale
app.post('/api/upscale-image', upload.single('image'), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            if (!currentUser) {
                const user = await getCurrentUser(req, res);
                if (!user) return;
                currentUser = user;
            }
        }
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ success: false, error: '請上傳一張圖片' });
        }
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY，無法使用放大功能' });
        }
        const form = new FormData();
        form.append('image', new Blob([file.buffer], { type: file.mimetype || 'image/png' }), file.originalname || 'image.png');
        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/upscale/fast', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + STABILITY_API_KEY },
            body: form
        });
        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability upscale error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '放大服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }
        const contentType = stabilityRes.headers.get('content-type') || '';
        let imageBase64;
        if (contentType.includes('application/json')) {
            const json = await stabilityRes.json();
            const artifact = json.artifacts && json.artifacts[0];
            if (artifact && artifact.base64) imageBase64 = artifact.base64;
            else if (json.image) imageBase64 = json.image;
        }
        if (!imageBase64) {
            const buf = Buffer.from(await stabilityRes.arrayBuffer());
            imageBase64 = buf.toString('base64');
        }
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得放大結果' });
        }
        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIUpscale();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_upscale',
                    description: 'AI 圖片放大',
                    metadata: {}
                });
            }
        }
        res.json({
            success: true,
            imageData: 'data:image/png;base64,' + imageBase64
        });
    } catch (e) {
        console.error('POST /api/upscale-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '放大失敗，請稍後再試', details: e.message });
    }
});

// 讀取 points_ai_sketch（前台 Sketch 扣點，預設 20）
async function getPointsAISketch() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_sketch');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 20);
}

// POST /api/sketch-image — Stability Control Sketch：草圖→成圖；管理員不扣點，一般用戶成功後扣 points_ai_sketch（預設 20 點）
app.post('/api/sketch-image', upload.single('image'), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ success: false, error: '請上傳一張草圖' });
        }
        let prompt = (req.body && req.body.prompt && String(req.body.prompt).trim()) || '';
        if (!prompt) {
            return res.status(400).json({ success: false, error: '請填寫描述（prompt）' });
        }
        let negativePrompt = (req.body.negative_prompt && String(req.body.negative_prompt).trim()) || '';
        [prompt, negativePrompt] = await translatePromptAndNegativeToEnglish(prompt, negativePrompt);
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const controlStrength = Math.min(1, Math.max(0, parseFloat(req.body.control_strength) || 0.7));
        const seed = parseInt(req.body.seed, 10) || 0;
        const outputFormat = ['jpeg', 'png'].includes(String(req.body.output_format || '').toLowerCase())
            ? String(req.body.output_format).toLowerCase() : 'jpeg';

        const form = new FormData();
        form.append('image', new Blob([file.buffer], { type: file.mimetype || 'image/png' }), file.originalname || 'image.png');
        form.append('prompt', prompt);
        if (negativePrompt) form.append('negative_prompt', negativePrompt);
        form.append('control_strength', String(controlStrength));
        if (seed > 0) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/control/sketch', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability sketch error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '草圖轉圖像服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAISketch();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_sketch',
                    description: '草圖轉圖像',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/sketch-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// 讀取 points_ai_structure（前台結構轉圖像扣點，預設 20）
async function getPointsAIStructure() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_structure');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 20);
}

// POST /api/structure-image — Stability Control Structure：結構→成圖；管理員不扣點，一般用戶成功後扣 points_ai_structure（預設 20 點）
app.post('/api/structure-image', upload.single('image'), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ success: false, error: '請上傳一張圖片' });
        }
        let prompt = (req.body && req.body.prompt && String(req.body.prompt).trim()) || '';
        if (!prompt) {
            return res.status(400).json({ success: false, error: '請填寫描述（prompt）' });
        }
        let negativePrompt = (req.body.negative_prompt && String(req.body.negative_prompt).trim()) || '';
        [prompt, negativePrompt] = await translatePromptAndNegativeToEnglish(prompt, negativePrompt);
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const controlStrength = Math.min(1, Math.max(0, parseFloat(req.body.control_strength) || 0.7));
        const seed = parseInt(req.body.seed, 10) || 0;
        const outputFormat = ['jpeg', 'png'].includes(String(req.body.output_format || '').toLowerCase())
            ? String(req.body.output_format).toLowerCase() : 'jpeg';

        const form = new FormData();
        form.append('image', new Blob([file.buffer], { type: file.mimetype || 'image/png' }), file.originalname || 'image.png');
        form.append('prompt', prompt);
        if (negativePrompt) form.append('negative_prompt', negativePrompt);
        form.append('control_strength', String(controlStrength));
        if (seed > 0) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/control/structure', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability structure error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '結構轉圖像服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIStructure();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_structure',
                    description: '結構轉圖像',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/structure-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// 讀取 points_ai_style（前台風格引導扣點，預設 20）
async function getPointsAIStyle() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_style');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 20);
}

const STYLE_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '21:9', '9:21', '2:3', '3:2', '4:5', '5:4'];

// POST /api/style-image — Stability Control Style：風格引導；管理員不扣點，一般用戶成功後扣 points_ai_style（預設 20 點）
app.post('/api/style-image', upload.single('image'), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ success: false, error: '請上傳一張圖片' });
        }
        let prompt = (req.body && req.body.prompt && String(req.body.prompt).trim()) || '';
        if (!prompt) {
            return res.status(400).json({ success: false, error: '請填寫描述（prompt）' });
        }
        let negativePrompt = (req.body.negative_prompt && String(req.body.negative_prompt).trim()) || '';
        [prompt, negativePrompt] = await translatePromptAndNegativeToEnglish(prompt, negativePrompt);
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const fidelity = Math.min(1, Math.max(0, parseFloat(req.body.fidelity) || 0.5));
        const seed = parseInt(req.body.seed, 10) || 0;
        const outputFormat = ['jpeg', 'png'].includes(String(req.body.output_format || '').toLowerCase())
            ? String(req.body.output_format).toLowerCase() : 'jpeg';
        const aspectRatio = (req.body.aspect_ratio && STYLE_ASPECT_RATIOS.includes(String(req.body.aspect_ratio))) ? String(req.body.aspect_ratio) : '1:1';

        const form = new FormData();
        form.append('image', new Blob([file.buffer], { type: file.mimetype || 'image/png' }), file.originalname || 'image.png');
        form.append('prompt', prompt);
        if (negativePrompt) form.append('negative_prompt', negativePrompt);
        form.append('fidelity', String(fidelity));
        form.append('aspect_ratio', aspectRatio);
        if (seed > 0) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/control/style', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability style error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '風格引導服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIStyle();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_style',
                    description: '風格引導',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/style-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// 讀取 points_ai_style_transfer（前台風格轉換扣點，預設 30）
async function getPointsAIStyleTransfer() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_style_transfer');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 30);
}

// POST /api/style-transfer-image — Stability Control Style Transfer：內容圖+風格圖→成圖；管理員不扣點，一般用戶成功後扣 points_ai_style_transfer（預設 30 點）
app.post('/api/style-transfer-image', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'style_image', maxCount: 1 }]), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const files = req.files || {};
        const contentFile = (files.image && files.image[0]) ? files.image[0] : null;
        const styleFile = (files.style_image && files.style_image[0]) ? files.style_image[0] : null;
        if (!contentFile || !contentFile.buffer) {
            return res.status(400).json({ success: false, error: '請上傳內容圖（image）' });
        }
        if (!styleFile || !styleFile.buffer) {
            return res.status(400).json({ success: false, error: '請上傳風格圖（style_image）' });
        }
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const seed = parseInt(req.body.seed, 10) || 0;
        const outputFormat = ['jpeg', 'png'].includes(String(req.body.output_format || '').toLowerCase())
            ? String(req.body.output_format).toLowerCase() : 'jpeg';
        let prompt = (req.body.prompt && String(req.body.prompt).trim()) || '';
        let negativePrompt = (req.body.negative_prompt && String(req.body.negative_prompt).trim()) || '';
        [prompt, negativePrompt] = await translatePromptAndNegativeToEnglish(prompt, negativePrompt);

        const form = new FormData();
        form.append('init_image', new Blob([contentFile.buffer], { type: contentFile.mimetype || 'image/png' }), contentFile.originalname || 'image.png');
        form.append('style_image', new Blob([styleFile.buffer], { type: styleFile.mimetype || 'image/png' }), styleFile.originalname || 'style.png');
        if (prompt) form.append('prompt', prompt);
        if (negativePrompt) form.append('negative_prompt', negativePrompt);
        if (seed > 0) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/control/style-transfer', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability style-transfer error:', stabilityRes.status, errText);
            let errMsg = '風格轉換服務暫時無法使用，請稍後再試';
            if (stabilityRes.status === 401) errMsg = 'Stability API Key 無效或已過期，請檢查 stability-key.txt 或 .env';
            else if (stabilityRes.status === 429) errMsg = '請求過於頻繁，請稍後再試';
            else if (stabilityRes.status === 402) errMsg = 'Stability 點數不足，請至 platform.stability.ai 儲值';
            else if (errText && errText.length < 150) errMsg = errText;
            return res.status(502).json({ success: false, error: errMsg, details: errText.slice(0, 200) });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIStyleTransfer();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_style_transfer',
                    description: '風格轉換',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/style-transfer-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// 讀取 points_ai_erase（前台移除物件扣點，預設 20）
async function getPointsAIErase() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_erase');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 20);
}

// POST /api/erase-image — Stability Edit Erase：依 mask 移除物件；管理員不扣點，一般用戶成功後扣 points_ai_erase（預設 20 點）
app.post('/api/erase-image', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mask', maxCount: 1 }]), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const files = req.files || {};
        const imageFile = (files.image && files.image[0]) ? files.image[0] : null;
        const maskFile = (files.mask && files.mask[0]) ? files.mask[0] : null;
        if (!imageFile || !imageFile.buffer) {
            return res.status(400).json({ success: false, error: '請上傳原圖（image）' });
        }
        if (!maskFile || !maskFile.buffer) {
            return res.status(400).json({ success: false, error: '請上傳遮罩圖（mask），白色區域為要移除的範圍' });
        }
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const seed = parseInt(req.body.seed, 10) || 0;
        const outputFormat = ['jpeg', 'png'].includes(String(req.body.output_format || '').toLowerCase())
            ? String(req.body.output_format).toLowerCase() : 'jpeg';

        const form = new FormData();
        form.append('image', new Blob([imageFile.buffer], { type: imageFile.mimetype || 'image/png' }), imageFile.originalname || 'image.png');
        form.append('mask', new Blob([maskFile.buffer], { type: maskFile.mimetype || 'image/png' }), maskFile.originalname || 'mask.png');
        if (seed > 0) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/edit/erase', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability erase error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '移除物件服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIErase();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_erase',
                    description: '移除物件',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/erase-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// 讀取 points_ai_inpaint（前台內部補繪扣點，預設 20）
async function getPointsAIInpaint() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_inpaint').limit(1);
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 20);
}

// 讀取 points_ai_outpaint（外擴繪圖扣點，預設 15）
async function getPointsAIOutpaint() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_outpaint').limit(1);
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 15);
}

// 讀取 points_ai_remove_bg（圖像去背扣點，預設 15）
async function getPointsAIRemoveBg() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_remove_bg').limit(1);
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 15);
}

// 讀取 points_ai_replace_bg_relight（置換背景與重打光扣點，預設 30）
async function getPointsAIReplaceBgRelight() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_replace_bg_relight').limit(1);
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 30);
}

// POST /api/inpaint-image — Stability Edit Inpaint：原圖 + mask + prompt 重繪遮罩區域；管理員不扣點，一般用戶成功後扣 points_ai_inpaint（預設 20 點）
app.post('/api/inpaint-image', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mask', maxCount: 1 }]), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const files = req.files || {};
        const imageFile = (files.image && files.image[0]) ? files.image[0] : null;
        const maskFile = (files.mask && files.mask[0]) ? files.mask[0] : null;
        if (!imageFile || !imageFile.buffer) {
            return res.status(400).json({ success: false, error: '請上傳原圖（image）' });
        }
        if (!maskFile || !maskFile.buffer) {
            return res.status(400).json({ success: false, error: '請上傳遮罩圖（mask），白色區域為要重繪的範圍' });
        }
        let prompt = (req.body.prompt && String(req.body.prompt).trim()) || '';
        if (!prompt) return res.status(400).json({ success: false, error: '請填寫描述（prompt）' });
        let negativePrompt = (req.body.negative_prompt && String(req.body.negative_prompt).trim()) || '';
        [prompt, negativePrompt] = await translatePromptAndNegativeToEnglish(prompt, negativePrompt);
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const seed = parseInt(req.body.seed, 10) || 0;
        const outputFormat = ['jpeg', 'png'].includes(String(req.body.output_format || '').toLowerCase())
            ? String(req.body.output_format).toLowerCase() : 'jpeg';

        const form = new FormData();
        form.append('image', new Blob([imageFile.buffer], { type: imageFile.mimetype || 'image/png' }), imageFile.originalname || 'image.png');
        form.append('mask', new Blob([maskFile.buffer], { type: maskFile.mimetype || 'image/png' }), maskFile.originalname || 'mask.png');
        form.append('prompt', prompt);
        if (negativePrompt) form.append('negative_prompt', negativePrompt);
        if (seed > 0) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/edit/inpaint', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability inpaint error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '內部補繪服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIInpaint();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_inpaint',
                    description: '內部補繪',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/inpaint-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// POST /api/outpaint-image — Stability Edit Outpaint：原圖 + 方向擴展（left/right/up/down）+ prompt；管理員不扣點，一般用戶成功後扣 points_ai_outpaint（預設 15 點）
app.post('/api/outpaint-image', upload.single('image'), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ success: false, error: '請上傳原圖（image）' });
        }
        let prompt = (req.body.prompt && String(req.body.prompt).trim()) || '';
        if (!prompt) prompt = 'natural extension of the image, seamless background';
        else prompt = await translatePromptToEnglish(prompt);
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const left = Math.max(0, parseInt(req.body.left, 10) || 0);
        const right = Math.max(0, parseInt(req.body.right, 10) || 0);
        const up = Math.max(0, parseInt(req.body.up, 10) || 0);
        const down = Math.max(0, parseInt(req.body.down, 10) || 0);
        if (left + right + up + down === 0) {
            return res.status(400).json({ success: false, error: '請至少設定一個擴展方向（left / right / up / down）的像素值' });
        }
        const creativity = Math.min(1, Math.max(0, parseFloat(req.body.creativity) || 0.5));
        const seed = parseInt(req.body.seed, 10) || 0;
        const outputFormat = ['jpeg', 'png'].includes(String(req.body.output_format || '').toLowerCase())
            ? String(req.body.output_format).toLowerCase() : 'jpeg';

        const form = new FormData();
        form.append('image', new Blob([file.buffer], { type: file.mimetype || 'image/png' }), file.originalname || 'image.png');
        form.append('prompt', prompt);
        form.append('left', String(left));
        form.append('right', String(right));
        form.append('up', String(up));
        form.append('down', String(down));
        form.append('creativity', String(creativity));
        if (seed > 0) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/edit/outpaint', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability outpaint error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '外擴繪圖服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIOutpaint();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_outpaint',
                    description: '外擴繪圖',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/outpaint-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// POST /api/remove-background-image — Stability Edit Remove Background：上傳圖片去背，回傳透明背景圖；管理員不扣點，一般用戶成功後扣 points_ai_remove_bg（預設 15 點）
app.post('/api/remove-background-image', upload.single('image'), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ success: false, error: '請上傳原圖（image）' });
        }
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const of = req.body && req.body.output_format;
        const outputFormat = ['jpeg', 'png'].includes(String(of || '').toLowerCase()) ? String(of).toLowerCase() : 'jpeg';

        const form = new FormData();
        form.append('image', new Blob([file.buffer], { type: file.mimetype || 'image/png' }), file.originalname || 'image.png');
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/edit/remove-background', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability remove-background error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '圖像去背服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIRemoveBg();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_remove_bg',
                    description: '圖像去背',
                    metadata: {}
                });
            }
        }

        const mime = 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/remove-background-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// POST /api/replace-background-relight-image — Stability Edit Replace Background and Relight；管理員不扣點，一般用戶扣 points_ai_replace_bg_relight（預設 30 點）
const replaceBgRelightUpload = upload.fields([
    { name: 'subject_image', maxCount: 1 },
    { name: 'background_reference', maxCount: 1 },
    { name: 'light_reference', maxCount: 1 }
]);
app.post('/api/replace-background-relight-image', replaceBgRelightUpload, async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const files = req.files || {};
        const subjectFile = (files.subject_image && files.subject_image[0]) ? files.subject_image[0] : null;
        if (!subjectFile || !subjectFile.buffer) {
            return res.status(400).json({ success: false, error: '請上傳主體圖片（subject_image）' });
        }
        const body = req.body || {};
        const backgroundPrompt = typeof body.background_prompt === 'string' ? body.background_prompt.trim() : '';
        const backgroundRefFile = (files.background_reference && files.background_reference[0]) ? files.background_reference[0] : null;
        if (!backgroundPrompt && !backgroundRefFile) {
            return res.status(400).json({ success: false, error: '請填寫背景描述（background_prompt）或上傳背景參考圖（background_reference）' });
        }
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        let background_prompt = backgroundPrompt;
        let foreground_prompt = typeof body.foreground_prompt === 'string' ? body.foreground_prompt.trim() : '';
        let negative_prompt = typeof body.negative_prompt === 'string' ? body.negative_prompt.trim() : '';
        if (background_prompt) background_prompt = await translatePromptToEnglish(background_prompt);
        if (foreground_prompt) foreground_prompt = await translatePromptToEnglish(foreground_prompt);
        if (negative_prompt) negative_prompt = await translatePromptToEnglish(negative_prompt);
        const outputFormat = (body.output_format === 'png' || body.output_format === 'jpeg') ? body.output_format : 'jpeg';

        const form = new FormData();
        form.append('subject_image', new Blob([subjectFile.buffer], { type: subjectFile.mimetype || 'image/png' }), subjectFile.originalname || 'subject.png');
        if (background_prompt) form.append('background_prompt', background_prompt);
        if (backgroundRefFile && backgroundRefFile.buffer) {
            form.append('background_reference', new Blob([backgroundRefFile.buffer], { type: backgroundRefFile.mimetype || 'image/png' }), backgroundRefFile.originalname || 'background_ref.png');
        }
        if (foreground_prompt) form.append('foreground_prompt', foreground_prompt);
        if (negative_prompt) form.append('negative_prompt', negative_prompt);
        const preserve = parseFloat(body.preserve_original_subject);
        if (!Number.isNaN(preserve) && preserve >= 0 && preserve <= 1) form.append('preserve_original_subject', String(preserve));
        const depth = parseFloat(body.original_background_depth);
        if (!Number.isNaN(depth) && depth >= 0 && depth <= 1) form.append('original_background_depth', String(depth));
        if (body.keep_original_background === 'true' || body.keep_original_background === true) form.append('keep_original_background', 'true');
        const lightStrength = parseFloat(body.light_source_strength);
        if (!Number.isNaN(lightStrength) && lightStrength >= 0 && lightStrength <= 1) form.append('light_source_strength', String(lightStrength));
        const lightRefFile = (files.light_reference && files.light_reference[0]) ? files.light_reference[0] : null;
        if (lightRefFile && lightRefFile.buffer) {
            form.append('light_reference', new Blob([lightRefFile.buffer], { type: lightRefFile.mimetype || 'image/png' }), lightRefFile.originalname || 'light_ref.png');
        }
        const lightDir = body.light_source_direction;
        if (lightDir && ['none', 'above', 'below', 'left', 'right'].includes(String(lightDir))) form.append('light_source_direction', String(lightDir));
        const seed = parseInt(body.seed, 10);
        if (Number.isInteger(seed)) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability replace-background-and-relight error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '置換背景與重打光服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIReplaceBgRelight();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_replace_bg_relight',
                    description: '置換背景與重打光',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/replace-background-relight-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

/** 參考圖描述：壓到極簡長度（模型偶爾仍會寫太長） */
function trimReferenceImageDescription(text, useEnglish) {
    let s = String(text || '').trim().replace(/\s+/g, ' ');
    if (!s) return s;
    const maxLen = useEnglish ? 220 : 72;
    if (s.length <= maxLen) return s;
    const cut = s.slice(0, maxLen);
    const punct = useEnglish
        ? cut.lastIndexOf('. ')
        : Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('，'));
    if (punct > 10) return cut.slice(0, punct + 1).trim();
    return cut.trim() + '…';
}

// API: 用 Gemini 閱讀參考圖並產生描述詞（輔助用，不生圖）；依 req.body.lang 回傳中文或英文
app.post('/api/describe-reference-images', express.json(), async (req, res) => {
    try {
        const { images, lang } = req.body;
        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ success: false, error: '請上傳至少一張參考圖' });
        }
        const parts = [];
        const maxImages = 8;
        for (let i = 0; i < Math.min(images.length, maxImages); i++) {
            const dataUrl = images[i];
            if (typeof dataUrl !== 'string') continue;
            if (dataUrl.startsWith('data:')) {
                // base64 data URL
                const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (!match) continue;
                parts.push({ inlineData: { mimeType: match[1].trim() || 'image/jpeg', data: match[2].trim() } });
            } else if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
                // 一般 URL（例如 Supabase Storage）：先 fetch 轉 base64
                try {
                    const fetchRes = await fetch(dataUrl);
                    if (!fetchRes.ok) continue;
                    const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';
                    const mimeType = contentType.split(';')[0].trim();
                    const arrayBuf = await fetchRes.arrayBuffer();
                    const base64Data = Buffer.from(arrayBuf).toString('base64');
                    parts.push({ inlineData: { mimeType, data: base64Data } });
                } catch (_) { continue; }
            }
        }
        if (parts.length === 0) {
            return res.status(400).json({ success: false, error: '無法解析圖片格式' });
        }
        const useEnglish = (lang && String(lang).toLowerCase().replace(/-.*$/, '') === 'en');
        const imgNote = parts.length > 1 ? `the following ${parts.length} reference images` : 'the reference image';
        const textPrompt = useEnglish
            ? `Look at ${imgNote}. Write a VERY SHORT product highlight for a design prompt: 1–2 sentences, under 35 words total. Cover only product type, key shape, main material/texture, and dominant color—brief phrases, not a catalog. No bullet lists, no paragraphs, no background, no manufacturing tips. Plain text only.`
            : `請看${parts.length > 1 ? '以下 ' + parts.length + ' 張' : '這張'}參考圖。寫極簡產品特色供「產品設計生圖」使用：全長不超過 50 字，1～2 句。只點到品項、造型輪廓、材質質感、主色即可。禁止條列、禁止長段落、禁止製造建議或背景說明。只輸出描述正文。`;
        const modelName = await getReadModelName();
        const result = await runInGeminiQueue(() => genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: textPrompt }, ...parts] }]
        }));
        let text = (result && result.text != null ? String(result.text) : '')?.trim() || '';
        text = trimReferenceImageDescription(text, useEnglish);
        if (!text) {
            return res.status(500).json({ success: false, error: '無法產生描述' });
        }
        res.json({ success: true, description: text });
    } catch (e) {
        console.error('describe-reference-images 錯誤:', e);
        res.status(500).json({
            success: false,
            error: '讀圖產生描述時發生錯誤',
            details: e.message
        });
    }
});

// API: 分析客製產品並媒合廠商
app.post('/api/analyze-custom-product', upload.array('images', 10), async (req, res) => {
    try {
        const { category, category_key, subcategory_key, quantity, description, budgetMin, budgetMax, generatedImage, prompt } = req.body;
        const mainCategoryKey = (category_key != null && String(category_key).trim()) ? String(category_key).trim() : (category != null && String(category).trim()) ? String(category).trim() : null;
        const subCategoryKey = (subcategory_key != null && String(subcategory_key).trim()) ? String(subcategory_key).trim() : null;
        
        // 準備圖片資料
        let imageParts = [];
        
        if (req.files && req.files.length > 0) {
            imageParts = req.files.map(file => ({
                inlineData: {
                    data: (file.buffer || Buffer.from('')).toString('base64'),
                    mimeType: file.mimetype || 'image/jpeg'
                }
            }));
        } else if (generatedImage) {
            // AI 生成的圖片
            imageParts = [{
                inlineData: {
                    data: generatedImage,
                    mimeType: 'image/png'
                }
            }];
        } else {
            return res.status(400).json({ success: false, error: '請提供圖片' });
        }

        // AI 分析提示詞
        const imageCount = imageParts.length;
        const analysisPrompt = `你是專業的產品訂製分析師。請分析${imageCount > 1 ? `以下 ${imageCount} 張` : '以下'}產品圖片，並提供詳細的製作建議。

產品類別：${mainCategoryKey || category}
預計數量：${quantity}
${description ? `需求說明：${description}` : ''}
${prompt ? `設計理念：${prompt}` : ''}

${imageCount > 1 ? `注意：共有 ${imageCount} 張參考圖，請綜合分析所有圖片的特點，找出共同的設計元素和風格。` : ''}

請以 JSON 格式回應：
{
  "productType": "產品具體類型",
  "materials": ["所需材質1", "材質2"],
  "techniques": ["需要的工藝1", "工藝2"],
  "difficulty": "製作難度（簡單/中等/困難）",
  "estimatedDays": "預估製作天數",
  "keyFeatures": ["產品特點1", "特點2"],
  "designStyle": "${imageCount > 1 ? '綜合多張圖片的共同設計風格' : '設計風格'}",
  "recommendations": "製作建議"
}`;

        // 呼叫 AI 分析
        const modelName = await getReadModelName();
        const result = await runInGeminiQueue(() => genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: analysisPrompt }, ...imageParts] }]
        }));

        const responseText = (result && result.text != null ? String(result.text) : '') || '';
        let analysis;
        
        try {
            // 嘗試解析 JSON
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {
                productType: '客製產品',
                materials: ['待確認'],
                techniques: ['手工訂製'],
                difficulty: '中等'
            };
        } catch (e) {
            console.error('解析 AI 回應失敗:', e);
            analysis = {
                productType: '客製產品',
                materials: ['待確認'],
                techniques: ['手工訂製'],
                difficulty: '中等',
                rawResponse: responseText
            };
        }

        // 查詢真實廠商資料
        const manufacturers = await queryManufacturers(mainCategoryKey || category, analysis);

        // 上傳圖片至 Storage，取得 publicUrl 陣列
        const imageUrls = [];
        if (req.files && req.files.length > 0) {
            for (const f of req.files) {
                try {
                    const { publicUrl } = await uploadToSupabaseStorage('custom-products', 'product', f);
                    imageUrls.push(publicUrl);
                } catch (e) {
                    console.warn('上傳至 Storage 失敗:', e.message);
                }
            }
        }
        const projectData = {
            category: mainCategoryKey || category,
            subcategory_key: subCategoryKey || null,
            quantity: parseInt(quantity) || 1,
            description: description || null,
            budget_min: budgetMin ? parseFloat(budgetMin) : null,
            budget_max: budgetMax ? parseFloat(budgetMax) : null,
            ai_analysis: analysis,
            image_urls: imageUrls,
            is_ai_generated: !!generatedImage,
            generation_prompt: prompt || null,
            status: 'published'
        };

        let savedProductId = null;
        try {
            const { data: savedProduct, error: saveError } = await supabase
                .from('custom_products')
                .insert(projectData)
                .select()
                .single();

            if (saveError) {
                console.error('儲存產品失敗:', saveError);
            } else {
                savedProductId = savedProduct.id;
                console.log('產品已儲存:', savedProductId);

                // 儲存媒合記錄
                if (manufacturers.length > 0 && savedProductId) {
                    const matchRecords = manufacturers.map(mfr => ({
                        product_id: savedProductId,
                        manufacturer_id: mfr.id,
                        match_score: mfr.matchScore,
                        match_reasons: {
                            category_match: true,
                            capabilities: mfr.capabilities || []
                        },
                        status: 'pending'
                    }));

                    const { error: matchError } = await supabase
                        .from('product_matches')
                        .insert(matchRecords);

                    if (matchError) {
                        console.error('儲存媒合記錄失敗:', matchError);
                    }
                }
            }
        } catch (e) {
            console.error('資料庫操作失敗:', e);
        }

        res.json({
            success: true,
            analysis,
            manufacturers,
            productId: savedProductId
        });

    } catch (error) {
        console.error('分析產品錯誤:', error);
        res.status(500).json({ success: false, error: error.message || '分析失敗' });
    }
});

// 查詢真實廠商資料
async function queryManufacturers(category, analysis) {
    try {
        // 從資料庫查詢廠商
        const { data: manufacturers, error } = await supabase
            .from('manufacturers')
            .select('*')
            .eq('status', 'active')
            .contains('production_capabilities', [category]);

        if (error) {
            console.error('查詢廠商失敗:', error);
            return generateMockManufacturers(category, analysis);
        }

        if (!manufacturers || manufacturers.length === 0) {
            // 如果沒有特定分類的廠商，查詢通用廠商
            const { data: generalMfrs } = await supabase
                .from('manufacturers')
                .select('*')
                .eq('status', 'active')
                .limit(5);

            manufacturers.push(...(generalMfrs || []));
        }

        // 計算匹配度
        return manufacturers.map(mfr => {
            let matchScore = 70; // 基礎分數

            // 根據能力加分
            if (mfr.production_capabilities) {
                const capabilities = Array.isArray(mfr.production_capabilities) 
                    ? mfr.production_capabilities 
                    : [];
                if (capabilities.includes(category)) matchScore += 15;
            }

            // 根據評分加分
            if (mfr.rating >= 4.5) matchScore += 10;
            if (mfr.rating >= 4.7) matchScore += 5;

            return {
                id: mfr.id,
                name: mfr.name,
                specialty: mfr.specialty,
                experience: mfr.experience,
                rating: mfr.rating,
                location: mfr.location,
                capabilities: mfr.production_capabilities,
                matchScore: Math.min(matchScore, 95)
            };
        }).sort((a, b) => b.matchScore - a.matchScore);

    } catch (e) {
        console.error('查詢廠商異常:', e);
        return generateMockManufacturers(category, analysis);
    }
}

// 模擬廠商推薦（備援）
function generateMockManufacturers(category, analysis) {
    const mockData = {
        furniture: [
            { name: '木工坊訂製', specialty: '實木家具訂製', experience: 15, rating: 4.8, location: '台北市' },
            { name: '現代傢俱工作室', specialty: '現代風格家具', experience: 8, rating: 4.6, location: '新北市' }
        ],
        decoration: [
            { name: '藝術裝飾工坊', specialty: '手工裝飾品', experience: 10, rating: 4.7, location: '台中市' },
            { name: '創意設計室', specialty: '客製化裝飾', experience: 6, rating: 4.5, location: '高雄市' }
        ],
        default: [
            { name: '全能訂製工坊', specialty: '各類產品訂製', experience: 12, rating: 4.6, location: '台北市' },
            { name: '精工製作所', specialty: '精密訂製', experience: 9, rating: 4.4, location: '桃園市' }
        ]
    };

    const manufacturers = mockData[category] || mockData.default;
    
    return manufacturers.map((mfr, idx) => ({
        id: `mfr-${Date.now()}-${idx}`,
        ...mfr,
        matchScore: Math.floor(75 + Math.random() * 20) // 75-95% 匹配度
    }));
}

// ============================================
// 客製產品 API (Custom Products)
// ============================================

// POST /api/custom-products - 儲存客製產品需求
app.post('/api/custom-products', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: '未授權：缺少 token' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            console.warn('POST /api/custom-products 401:', authError ? authError.message : 'no user');
            return res.status(401).json({ error: '未授權：token 無效' });
        }

        const { title, description, category, category_key, subcategory_key, reference_image_url, ai_generated_image_url, analysis_json, show_on_homepage, generation_prompt, generation_seed, reference_sources } = req.body;

        if (!title || !description) {
            console.warn('POST /api/custom-products 400: 缺少 title/description');
            return res.status(400).json({ error: '標題與描述為必填欄位' });
        }

        const mainCategoryVal = (category_key != null && String(category_key).trim()) ? String(category_key).trim() : (category != null && String(category).trim()) ? String(category).trim() : null;
        const subCategoryVal = (subcategory_key != null && String(subcategory_key).trim()) ? String(subcategory_key).trim() : null;

        console.log('POST /api/custom-products 儲存中 owner_id=%s title=%s category=%s sub=%s', user.id, (title || '').substring(0, 40), mainCategoryVal, subCategoryVal);

        let finalAnalysisJson = analysis_json && typeof analysis_json === 'object' ? analysis_json : null;
        if (show_on_homepage === true) {
            finalAnalysisJson = Object.assign({}, finalAnalysisJson || {}, { show_on_homepage: true });
        }
        const promptVal = (generation_prompt != null && String(generation_prompt).trim()) ? String(generation_prompt).trim() : null;
        const seedVal = (generation_seed != null && generation_seed !== '' && Number.isInteger(Number(generation_seed))) ? Number(generation_seed) : null;
        const insertPayload = {
            owner_id: user.id,
            title,
            description,
            category: mainCategoryVal,
            subcategory_key: subCategoryVal,
            reference_image_url: reference_image_url || null,
            ai_generated_image_url: ai_generated_image_url || null,
            analysis_json: finalAnalysisJson && Object.keys(finalAnalysisJson).length ? finalAnalysisJson : null,
            status: 'draft',
            generation_prompt: promptVal,
            generation_seed: seedVal,
            show_on_homepage: true
        };
        const lineage = await customProductLineage.computeCustomProductLineage(
            supabase,
            user.id,
            reference_sources
        );
        insertPayload.generator_manufacturer_id = lineage.generator_manufacturer_id;
        insertPayload.has_self_vendor_reference = lineage.has_self_vendor_reference;
        insertPayload.is_vendor_self_serve = lineage.is_vendor_self_serve;
        insertPayload.data_lineage_json = lineage.data_lineage_json;
        if (lineage.reference_sources) insertPayload.reference_sources = lineage.reference_sources;
        const uiLocale = (req.body.ui_locale || req.body.lang || req.query.lang || '').trim() || null;
        mergeDesignerRegionIntoPayload(insertPayload, req, uiLocale);

        async function doInsert(payload) {
            return supabase.from('custom_products').insert(payload).select().single();
        }
        let { data, error } = await doInsert(insertPayload);
        if (error && error.code === '42703') {
            ({ data, error } = await doInsert(stripInternalCustomProductInsertColumns(insertPayload)));
        }

        if (!error && data && data.id && ai_generated_image_url) {
            enrichCustomProductSemantics(data.id, user.id, {
                imageUrl: ai_generated_image_url,
                generationPrompt: promptVal,
                title,
                categoryKey: mainCategoryVal
            }).catch(() => {});
        }

        if (error) {
            console.error('POST /api/custom-products 儲存失敗:', error.message, error);
            return res.status(500).json({ error: error.message });
        }

        console.log('POST /api/custom-products 儲存成功 id=%s owner_id=%s self_serve=%s', data.id, user.id, lineage.is_vendor_self_serve);
        res.json({ success: true, product: customProductLineage.stripInternalCustomProductFields(data) });
    } catch (e) {
        console.error('POST /api/custom-products 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/custom-products - 取得使用者的客製產品列表
// ?summary=1：只回傳是否有資料（輕量，僅 id），有資料再抓完整列表與圖
app.get('/api/custom-products', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: '未授權：缺少 token' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: '未授權：token 無效' });
        }

        const summaryOnly = req.query.summary === '1' || req.query.summary === 'true';
        const selectFields = summaryOnly ? 'id' : '*';

        const { data, error } = await supabase
            .from('custom_products')
            .select(selectFields)
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('查詢客製產品失敗:', error);
            return res.status(500).json({ error: error.message });
        }

        const list = data || [];
        if (summaryOnly) {
            return res.json({ success: true, hasItems: list.length > 0, count: list.length, products: list });
        }
        const ownerDisplay = (user.user_metadata && user.user_metadata.full_name) || user.email || '';
        const ownerEmail = user.email || '';
        const productsWithOwner = list.map(p => customProductLineage.stripInternalCustomProductFields({
            ...p,
            owner_email: ownerEmail,
            owner_display: ownerDisplay
        }));
        res.json({ success: true, products: productsWithOwner });
    } catch (e) {
        console.error('GET /api/custom-products 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/custom-products/for-homepage - 首頁媒體牆用（公開，分頁）
// 若尚未執行 migration（無 show_on_homepage 欄位）則回傳空列表，避免首頁顯示「無法載入」
app.get('/api/custom-products/for-homepage', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const offset = (page - 1) * limit;

    try {
        const { data: items, error } = await supabase
            .from('custom_products')
            .select('id, title, category, ai_generated_image_url, reference_image_url, created_at')
            .eq('show_on_homepage', true)
            .not('ai_generated_image_url', 'eq', null)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.warn('查詢首頁媒體牆失敗（若尚未執行 migration 請執行 docs/add-custom-products-show-on-homepage.sql）:', error.message);
            res.set('Cache-Control', 'public, max-age=60');
            return res.status(200).json({ items: [], total: 0, page, limit });
        }

        const { count, error: countErr } = await supabase
            .from('custom_products')
            .select('*', { count: 'exact', head: true })
            .eq('show_on_homepage', true)
            .not('ai_generated_image_url', 'eq', null);

        const total = countErr ? (items || []).length : (count ?? 0);
        const list = (items || []).map(p => ({
            id: p.id,
            title: p.title,
            category: p.category,
            image_url: p.ai_generated_image_url || p.reference_image_url,
            created_at: p.created_at
        }));

        res.set('Cache-Control', 'public, max-age=120');
        res.json({ items: list, total, page, limit });
    } catch (e) {
        console.error('GET /api/custom-products/for-homepage 異常:', e);
        res.set('Cache-Control', 'public, max-age=60');
        res.status(200).json({ items: [], total: 0, page, limit });
    }
});

// GET /api/custom-products/for-makers — 訂製需求列表（製作方依分類篩選，供「聯絡訂製者」用）
// Query: category_key（必填）, subcategory_key（選填）, page, per_page
app.get('/api/custom-products/for-makers', async (req, res) => {
    try {
        const authHeader = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!authHeader) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const category_key = req.query.category_key || req.query.categoryKey;
        const subcategory_key = req.query.subcategory_key || req.query.subcategoryKey;
        const per_page = Math.min(Math.max(parseInt(req.query.per_page, 10) || 12, 1), 50);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const offset = (page - 1) * per_page;

        if (!category_key) return res.status(400).json({ error: '請提供 category_key' });

        let query = supabase
            .from('custom_products')
            .select('id, title, description, category, subcategory_key, ai_generated_image_url, reference_image_url, owner_id, created_at', { count: 'exact' })
            .not('ai_generated_image_url', 'is', null)
            .eq('open_for_manufacturing', true)
            .eq('manufacturing_status', 'open')
            .eq('category', category_key);

        if (subcategory_key) {
            query = query.or('subcategory_key.eq.' + subcategory_key + ',subcategory_key.is.null');
        }

        const { data: items, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + per_page - 1);

        if (error) return res.status(500).json({ error: '查詢失敗' });

        const list = (items || []).map(p => ({
            id: p.id,
            title: p.title,
            description: p.description || '',
            category: p.category,
            subcategory_key: p.subcategory_key || null,
            image_url: p.ai_generated_image_url || p.reference_image_url,
            owner_id: p.owner_id,
            created_at: p.created_at
        }));

        res.json({ items: list, total: count ?? list.length, page, per_page });
    } catch (e) {
        console.error('GET /api/custom-products/for-makers 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/custom-products/:id/manufacturing — 設計者切換開放廠商搜尋 / 標記已完成
// body: { open_for_manufacturing?: bool, manufacturing_status?: 'open'|'completed'|'closed' }
app.patch('/api/custom-products/:id/manufacturing', express.json(), async (req, res) => {
    try {
        const token = (req.headers.authorization || '').replace(/^\s*Bearer\s+/i, '');
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) return res.status(401).json({ error: '登入已過期' });

        const { id } = req.params;
        // 確認是本人的資產
        const { data: item, error: findErr } = await supabase
            .from('custom_products').select('id, owner_id').eq('id', id).maybeSingle();
        if (findErr || !item) return res.status(404).json({ error: '找不到資產' });
        if (item.owner_id !== user.id) return res.status(403).json({ error: '無權限' });

        const patch = {};
        if (req.body.open_for_manufacturing !== undefined)
            patch.open_for_manufacturing = !!req.body.open_for_manufacturing;
        if (['open', 'completed', 'closed'].includes(req.body.manufacturing_status))
            patch.manufacturing_status = req.body.manufacturing_status;
        // 標記已完成時同步關閉搜尋
        if (patch.manufacturing_status === 'completed' || patch.manufacturing_status === 'closed')
            patch.open_for_manufacturing = false;

        if (Object.keys(patch).length === 0)
            return res.status(400).json({ error: '無有效欄位' });

        const { data: updated, error: upErr } = await supabase
            .from('custom_products').update(patch).eq('id', id)
            .select('id, open_for_manufacturing, manufacturing_status').single();
        if (upErr) return res.status(500).json({ error: '更新失敗' });
        res.json({ ok: true, ...updated });
    } catch (e) {
        console.error('PATCH /api/custom-products/:id/manufacturing:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/media-wall - 首頁媒體牆三類型混合（不設比例，每類型各取 perPage）
// 「一頁」= 一次請求回傳的筆數：由 query per_page（預設 48，上限 100）與 page（第 1 頁為最新）決定；前端「載入更多」即請求 page=2,3…
// 回傳單一陣列，每筆含 type('user_design'|'comparison'|'collection'), size('1x1'|'2x2'), 與對應欄位
// ?per_page=48&page=1&q=關鍵字&tag=標籤1,標籤2&category_key=主分類&subcategory_key=子分類&layout_type=（可疊加）
app.get('/api/media-wall', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(100, Math.max(10, parseInt(req.query.per_page, 10) || 48));
    const offset = (page - 1) * perPage;
    const searchQ = (req.query.q && String(req.query.q).trim()) || '';
    const tagFilters = parseMediaWallTagFilters(req.query.tag);
    const filterCategoryKey = (req.query.category_key && String(req.query.category_key).trim()) || '';
    const filterSubcategoryKey = (req.query.subcategory_key && String(req.query.subcategory_key).trim()) || '';
    const filterLayoutType = (req.query.layout_type && String(req.query.layout_type).trim()) || '';
    const layoutOnly = ['user_design', 'comparison', 'collection', 'series'].includes(filterLayoutType) ? filterLayoutType : null;

    const out = [];
    const hasCategoryFilter = !!(filterCategoryKey || filterSubcategoryKey);
    const clientFilterActive = !!(searchQ || tagFilters.length);
    // 有 q 或 tag 時多取一批，再與分類／類型條件 AND 後分頁
    const searchPool = clientFilterActive ? Math.min(100, Math.max(offset + perPage * 2, perPage * 2)) : 0;
    const dbOffset = clientFilterActive ? 0 : offset;
    const nUserLimit = (layoutOnly === 'user_design' || layoutOnly === null) ? (clientFilterActive ? searchPool : perPage) : 0;
    const nComparisonLimit = (layoutOnly === 'comparison' || layoutOnly === null) ? (clientFilterActive ? searchPool : perPage) : 0;
    const nSeriesLimit = (layoutOnly === 'series' || layoutOnly === 'collection') ? (clientFilterActive ? searchPool : perPage) : 0;
    // 混合模式時 1x2 只取少數，避免壓過 1x1；篩選「系列／資料夾」時才取滿一頁
    const nCollectionLimit = (layoutOnly === 'series' || layoutOnly === 'collection')
        ? Math.max(1, Math.floor((clientFilterActive ? searchPool : perPage) / 2))
        : (layoutOnly === null ? (clientFilterActive ? Math.min(12, Math.max(6, Math.floor(searchPool / 8))) : 6) : 0);

    try {
        {
        // 主分類篩選時：custom_products.category 可能存「主分類 key」或「子分類 key」（表單只送一個欄位），故需包含該主分類下所有子分類 key
        let categoryKeysToMatch = filterCategoryKey ? [filterCategoryKey] : null;
        if (filterCategoryKey) {
            try {
                const { data: subRows } = await supabase
                    .from('custom_product_subcategories')
                    .select('key')
                    .eq('category_key', filterCategoryKey);
                if (subRows && subRows.length) {
                    categoryKeysToMatch = [filterCategoryKey, ...subRows.map(r => r.key).filter(Boolean)];
                }
            } catch (_) {}
        }

        // 用戶設計：只查「有圖」且允許顯示在首頁的；可依 category / subcategory_key 篩選
        let userRows = [];
        if (!layoutOnly || layoutOnly === 'user_design') {
        let userQuery = supabase
            .from('custom_products')
            .select('id, title, category, subcategory_key, ai_generated_image_url, reference_image_url, created_at, owner_id, analysis_json, generation_prompt, generation_seed, show_on_homepage, ai_tags, image_semantics_json')
            .not('ai_generated_image_url', 'eq', null)
            .or('show_on_homepage.eq.true,show_on_homepage.is.null');
        if (categoryKeysToMatch && categoryKeysToMatch.length) userQuery = userQuery.in('category', categoryKeysToMatch);
        else if (filterCategoryKey) userQuery = userQuery.eq('category', filterCategoryKey);
        if (filterSubcategoryKey) userQuery = userQuery.eq('subcategory_key', filterSubcategoryKey);
        userQuery = userQuery.order('created_at', { ascending: false }).range(dbOffset, dbOffset + (hasCategoryFilter && !clientFilterActive ? perPage : nUserLimit) - 1);
        const userRes = await userQuery;
        if (!userRes.error) userRows = userRes.data || [];
        if (userRes.error && userRes.error.code !== '42703') console.warn('GET /api/media-wall 用戶設計查詢失敗:', userRes.error.message);
        if (userRes.error && /column.*show_on_homepage|column.*subcategory_key|42703/i.test(userRes.error.message || userRes.error.code)) {
            let fallbackQuery = supabase
                .from('custom_products')
                .select('id, title, category, ai_generated_image_url, reference_image_url, created_at, owner_id, analysis_json, generation_prompt, generation_seed')
                .not('ai_generated_image_url', 'eq', null);
            if (categoryKeysToMatch && categoryKeysToMatch.length) fallbackQuery = fallbackQuery.in('category', categoryKeysToMatch);
            else if (filterCategoryKey) fallbackQuery = fallbackQuery.eq('category', filterCategoryKey);
            fallbackQuery = fallbackQuery.order('created_at', { ascending: false }).range(dbOffset, dbOffset + (hasCategoryFilter && !clientFilterActive ? perPage : nUserLimit) - 1);
            const fallback = await fallbackQuery;
            userRows = (fallback.data && fallback.data.length) ? fallback.data : [];
            if (filterSubcategoryKey && userRows.length) userRows = userRows.filter(p => (p.subcategory_key || '') === filterSubcategoryKey);
        }
        let ownerDisplayMap = {};
        if (userRows && userRows.length) {
            const ownerIds = [...new Set(userRows.map(p => p.owner_id).filter(Boolean))];
            if (ownerIds.length > 0) {
                try {
                    const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', ownerIds);
                    if (profs) profs.forEach(pr => { ownerDisplayMap[pr.id] = (pr.full_name && pr.full_name.trim()) || pr.email || ''; });
                } catch (_) {}
            }
            // 照抄 GET /api/custom-products 的 product 形狀；確保 analysis_json 為物件，且 generation_seed 從 analysis_json 帶出
            userRows.forEach(p => {
                let aj = p.analysis_json;
                if (typeof aj === 'string') try { aj = JSON.parse(aj); } catch (_) { aj = null; }
                const seed = p.generation_seed ?? (aj && (aj.generation_seed ?? aj.seed));
                const userItem = attachDisplayTags({
                    ...p,
                    analysis_json: aj || null,
                    generation_seed: seed != null && seed !== '' ? seed : null,
                    type: 'user_design',
                    size: '1x1',
                    title: p.title || '未命名',
                    image_url: p.ai_generated_image_url || p.reference_image_url,
                    link: '/custom/gallery.html',
                    inspiration_url: p.id ? `/inspiration/user_design/${p.id}` : null,
                    owner_display: ownerDisplayMap[p.owner_id] || null,
                    category_key: p.category || null,
                    subcategory_key: p.subcategory_key || null
                });
                out.push(userItem);
            });
        }
        }

        // 廠商對比：有分類篩選時只回傳該分類的對比圖，無篩選時回傳 show_on_media_wall 的項目（需 category_key 欄位請執行 docs/add-manufacturer-portfolio-category-fields.sql）
        // 篩選「對照圖」時只查有 image_url_before 的項目，沒傳對照圖的不能出現在對照圖區
        let compRows = [];
        if (!layoutOnly || layoutOnly === 'comparison') {
        const compSelect = 'id, manufacturer_id, title, image_url, image_url_before, design_highlight, tags, ai_tags, image_semantics_json, description, show_on_media_wall, category_key, subcategory_key, series_image_valid_until, before_image_valid_until, series_image_urls, created_at';
        if (hasCategoryFilter && categoryKeysToMatch && categoryKeysToMatch.length) {
            let compQuery = supabase
                .from('manufacturer_portfolio')
                .select(compSelect)
                .eq('show_on_media_wall', true)
                .in('category_key', categoryKeysToMatch)
                .order('created_at', { ascending: false })
                .range(dbOffset, dbOffset + nComparisonLimit - 1);
            if (layoutOnly === 'comparison') compQuery = compQuery.not('image_url_before', 'is', null);
            if (filterSubcategoryKey) compQuery = compQuery.eq('subcategory_key', filterSubcategoryKey);
            const compRes = await compQuery;
            if (!compRes.error) compRows = compRes.data || [];
            if (compRes.error && compRes.error.code !== '42703') console.warn('GET /api/media-wall 廠商對比（依分類）查詢:', compRes.error.message);
        } else {
            let compQuery = supabase
                .from('manufacturer_portfolio')
                .select(compSelect)
                .eq('show_on_media_wall', true)
                .order('created_at', { ascending: false })
                .range(dbOffset, dbOffset + nComparisonLimit - 1);
            if (layoutOnly === 'comparison') compQuery = compQuery.not('image_url_before', 'is', null);
            const compRes = await compQuery;
            if (!compRes.error) compRows = compRes.data || [];
            if (compRes.error && compRes.error.code !== '42703') console.warn('GET /api/media-wall 廠商對比查詢:', compRes.error.message);
            if (compRes.error && /column.*show_on_media_wall|column.*category_key|42703/i.test(compRes.error.message || compRes.error.code)) {
                let fallbackQuery = supabase
                    .from('manufacturer_portfolio')
                    .select('id, manufacturer_id, title, image_url, image_url_before, design_highlight, series_image_valid_until, before_image_valid_until, series_image_urls')
                    .order('created_at', { ascending: false })
                    .range(dbOffset, dbOffset + nComparisonLimit - 1);
                if (layoutOnly === 'comparison') fallbackQuery = fallbackQuery.not('image_url_before', 'is', null);
                const fallback = await fallbackQuery;
                compRows = fallback.data || [];
            }
        }
        }
        if (compRows && compRows.length) {
            // Batch-fetch manufacturer user_id so the lightbox can offer in-app contact
            const compMfrIds = [...new Set(compRows.map(p => p.manufacturer_id).filter(Boolean))];
            let compMfrMap = {};
            if (compMfrIds.length) {
                const { data: compMfrs } = await supabase
                    .from('manufacturers')
                    .select('id, user_id')
                    .in('id', compMfrIds)
                    .eq('is_active', true);
                (compMfrs || []).forEach(m => { compMfrMap[m.id] = m.user_id || null; });
            }
            const nowIso = new Date().toISOString();
            compRows.forEach(p => {
                const seriesExpired = p.series_image_valid_until && p.series_image_valid_until < nowIso;
                const imageUrl = seriesExpired ? null : (p.image_url || null);
                // 舊圖（設計圖）一律回傳，不因 before_image_valid_until 過期而隱藏，否則首頁對照圖左半不顯示
                const imageUrlBefore = (p.image_url_before || null);
                const seriesUrls = (Array.isArray(p.series_image_urls) && p.series_image_urls.length) ? (seriesExpired ? [] : p.series_image_urls) : (imageUrl ? [imageUrl] : []);
                // 有 image_url_before 才是對照圖（設計圖+作品圖）；否則為系列圖（多張或單張）
                const itemType = imageUrlBefore ? 'comparison' : 'series';
                const mfrUserId = compMfrMap[p.manufacturer_id] || null;
                const payload = attachDisplayTags({
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
                    created_at: p.created_at || null
                });
                if (itemType === 'comparison') payload.image_url_before = imageUrlBefore;
                if (itemType === 'series' && seriesUrls.length) payload.series_image_urls = seriesUrls;
                // 篩選「對照圖」時只回傳真正的對照圖（有設計圖），不把系列圖塞進對照圖區
                if (layoutOnly === 'comparison' && itemType !== 'comparison') return;
                out.push(payload);
            });
        }
        // 沒有對比圖時不顯示對比（不塞 demo），每種類型都要有分類
        }

        // 系列圖專用：篩選「系列圖」或「資料夾」時皆查 image_url_before 為 null 的廠商作品（與資料夾整合為同一種）
        let seriesRows = [];
        if ((layoutOnly === 'series' || layoutOnly === 'collection') && nSeriesLimit > 0) {
            try {
                const seriesSelect = 'id, manufacturer_id, title, image_url, design_highlight, tags, ai_tags, image_semantics_json, description, show_on_media_wall, category_key, subcategory_key, series_image_valid_until, series_image_urls, created_at';
                if (hasCategoryFilter && categoryKeysToMatch && categoryKeysToMatch.length) {
                    let seriesQuery = supabase
                        .from('manufacturer_portfolio')
                        .select(seriesSelect)
                        .eq('show_on_media_wall', true)
                        .is('image_url_before', null)
                        .in('category_key', categoryKeysToMatch)
                        .order('created_at', { ascending: false })
                        .range(dbOffset, dbOffset + nSeriesLimit - 1);
                    if (filterSubcategoryKey) seriesQuery = seriesQuery.eq('subcategory_key', filterSubcategoryKey);
                    const seriesRes = await seriesQuery;
                    if (!seriesRes.error) seriesRows = seriesRes.data || [];
                    if (seriesRes.error && /column.*show_on_media_wall|column.*category_key|42703/i.test(String(seriesRes.error.message || seriesRes.error.code))) {
                        let fallbackQuery = supabase
                            .from('manufacturer_portfolio')
                            .select('id, manufacturer_id, title, image_url, design_highlight, series_image_valid_until, series_image_urls')
                            .is('image_url_before', null)
                            .order('created_at', { ascending: false })
                            .range(dbOffset, dbOffset + nSeriesLimit - 1);
                        const fallbackRes = await fallbackQuery;
                        seriesRows = (fallbackRes.data || []).map(r => ({ ...r, tags: [], description: null, category_key: null, subcategory_key: null }));
                    }
                } else {
                    const seriesRes = await supabase
                        .from('manufacturer_portfolio')
                        .select(seriesSelect)
                        .eq('show_on_media_wall', true)
                        .is('image_url_before', null)
                        .order('created_at', { ascending: false })
                        .range(dbOffset, dbOffset + nSeriesLimit - 1);
                    if (!seriesRes.error) seriesRows = seriesRes.data || [];
                    if (seriesRes.error && /column.*show_on_media_wall|column.*category_key|42703/i.test(String(seriesRes.error.message || seriesRes.error.code))) {
                        const fallbackRes = await supabase
                            .from('manufacturer_portfolio')
                            .select('id, manufacturer_id, title, image_url, design_highlight, series_image_valid_until, series_image_urls')
                            .is('image_url_before', null)
                            .order('created_at', { ascending: false })
                            .range(dbOffset, dbOffset + nSeriesLimit - 1);
                        seriesRows = (fallbackRes.data || []).map(r => ({ ...r, tags: [], description: null, category_key: null, subcategory_key: null }));
                    }
                }
            } catch (seriesErr) {
                console.warn('GET /api/media-wall 系列圖查詢:', seriesErr && seriesErr.message);
            }
        }
        if (seriesRows && seriesRows.length) {
            const seriesMfrIds = [...new Set(seriesRows.map(p => p.manufacturer_id).filter(Boolean))];
            let seriesMfrMap = {};
            if (seriesMfrIds.length) {
                const { data: seriesMfrs } = await supabase
                    .from('manufacturers')
                    .select('id, user_id')
                    .in('id', seriesMfrIds)
                    .eq('is_active', true);
                (seriesMfrs || []).forEach(m => { seriesMfrMap[m.id] = m.user_id || null; });
            }
            const nowIso = new Date().toISOString();
            seriesRows.forEach(p => {
                const seriesExpired = p.series_image_valid_until && p.series_image_valid_until < nowIso;
                const imageUrl = seriesExpired ? null : (p.image_url || null);
                const seriesUrls = (Array.isArray(p.series_image_urls) && p.series_image_urls.length) ? (seriesExpired ? [] : p.series_image_urls) : (imageUrl ? [imageUrl] : []);
                const mfrUserId = seriesMfrMap[p.manufacturer_id] || null;
                out.push(attachDisplayTags({
                    type: 'series',
                    size: '1x2',
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
                    inspiration_url: p.id ? `/inspiration/series/${p.id}` : null,
                    created_at: p.created_at || null,
                    series_image_urls: seriesUrls
                }));
            });
        }

        // 資料夾：與系列圖整合為同一種，回傳 type=series；篩選「系列圖」或「資料夾」時皆會查
        let collRows = [];
        if (!layoutOnly || layoutOnly === 'collection' || layoutOnly === 'series') {
        const collLimit = hasCategoryFilter ? Math.min(nCollectionLimit * 3, 30) : nCollectionLimit;
        if (collLimit > 0) {
            const collRes = await supabase
                .from('media_collections')
                .select('id, title, slug, cover_image_url, image_urls, description, category_keys, manufacturer_id, created_at')
                .eq('is_active', true)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: false })
                .range(dbOffset, dbOffset + collLimit - 1);
            let raw = (collRes.data || []);
            let canFilterByCategory = true;
            if (collRes.error && /column|42703/i.test(String(collRes.error.message || collRes.error.code))) {
                const simple = await supabase.from('media_collections').select('id, title, slug, cover_image_url, description, created_at').eq('is_active', true).order('sort_order', { ascending: true }).order('created_at', { ascending: false }).range(dbOffset, dbOffset + collLimit - 1);
                raw = (simple.data || []).map(r => ({ ...r, manufacturer_id: null }));
                canFilterByCategory = false;
            }
            if (hasCategoryFilter && filterCategoryKey) {
                if (!canFilterByCategory || !raw.length) {
                    collRows = [];
                } else {
                    // 只顯示 category_keys 含有該主分類 key 的資料夾；沒設分類的資料夾一律不顯示
                    collRows = raw.filter(function (p) {
                        const keys = p.category_keys;
                        if (!keys || !Array.isArray(keys) || keys.length === 0) return false;
                        return keys.indexOf(filterCategoryKey) !== -1;
                    }).slice(0, nCollectionLimit);
                }
            } else {
                collRows = raw.slice(0, nCollectionLimit);
            }
        }
        }
        // Batch-fetch manufacturer user_id for collections that have manufacturer_id
        const collMfrIds = [...new Set(collRows.map(p => p.manufacturer_id).filter(Boolean))];
        let collMfrMap = {};
        if (collMfrIds.length) {
            const { data: collMfrs } = await supabase
                .from('manufacturers')
                .select('id, user_id')
                .in('id', collMfrIds)
                .eq('is_active', true);
            (collMfrs || []).forEach(m => { collMfrMap[m.id] = m.user_id || null; });
        }
        // 資料夾（media_collections）用 type=collection，與廠商系列圖 type=series 區分，前端篩選「系列圖／資料夾」才正確
        collRows.forEach(p => {
            const cover = p.cover_image_url || null;
            const imageUrls = (p.image_urls && Array.isArray(p.image_urls) && p.image_urls.length > 0) ? p.image_urls : (cover ? [cover] : []);
            const mfrId = p.manufacturer_id || null;
            const mfrUserId = collMfrMap[mfrId] || null;
            out.push({
                type: 'collection',
                size: '1x2',
                id: p.id,
                title: p.title || '系列',
                slug: p.slug,
                cover_image_url: cover,
                series_image_urls: imageUrls,
                description: p.description || null,
                manufacturer_id: mfrId,
                manufacturer_user_id: mfrUserId,
                link: mfrId ? '/vendor-profile.html?id=' + encodeURIComponent(mfrId) : (p.slug ? '/custom/collection.html?slug=' + encodeURIComponent(p.slug) : '/custom/gallery.html'),
                inspiration_url: p.id ? `/inspiration/collection/${p.id}` : null,
                created_at: p.created_at || null,
                category_keys: (p.category_keys && Array.isArray(p.category_keys)) ? p.category_keys : []
            });
        });

        // 防呆：API 回傳絕不把廠商作品當設計圖（設計圖只准 AI 生成寫入 custom_products，廠商圖絕不當設計圖）
        out.forEach(function (item) {
            if (item.manufacturer_id && item.type === 'user_design') {
                item.type = (item.image_url_before ? 'comparison' : 'series');
                if (item.type === 'series' && (!item.series_image_urls || !item.series_image_urls.length) && item.image_url) {
                    item.series_image_urls = [item.image_url];
                }
            }
        });
        // 篩選類型時只回傳該類型：設計圖＝僅 AI 生成；對照圖／系列圖／資料夾＝依 type 篩選（勿對 const out 重新賦值）
        let items = out;
        if (layoutOnly === 'user_design') {
            items = out.filter(function (item) { return item.type === 'user_design' && !item.manufacturer_id; });
        } else if (layoutOnly === 'comparison') {
            items = out.filter(function (item) { return item.type === 'comparison'; });
        } else if (layoutOnly === 'series') {
            items = out.filter(function (item) { return item.type === 'series'; });
        } else if (layoutOnly === 'collection') {
            items = out.filter(function (item) { return item.type === 'collection'; });
        }

        if (clientFilterActive) {
            if (tagFilters.length) {
                items = items.filter(function (item) { return mediaWallItemMatchesTagFilters(item, tagFilters); });
            }
            if (searchQ) {
                const qLower = searchQ.toLowerCase();
                items = items.filter(function (item) { return mediaWallItemSearchHaystack(item).includes(qLower); });
            }
            items.sort(function (a, b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0); });
            items = items.slice(offset, offset + perPage);
        }

        res.set('Cache-Control', 'public, max-age=120');
        res.json({ items: items, page, per_page: perPage, filtered: clientFilterActive, tags: tagFilters });
    } catch (e) {
        console.error('GET /api/media-wall 異常:', e);
        res.set('Cache-Control', 'public, max-age=60');
        res.status(200).json({ items: [], page, per_page: perPage });
    }
});

// 首頁靈感牆刪除/隱藏：與 GET /api/me/profile 共用查詢（id 優先，再以 email 對應舊列）
/** 首頁靈感牆刪除／隱藏：僅 profiles.role = admin */
function profileCanDeleteMediaWall(profile) {
    if (!profile) return false;
    return String(profile.role || '').trim().toLowerCase() === 'admin';
}

async function resolveProfileForAuthUser(user) {
    if (!user?.id) return { profile: null, error: null };
    const normEmail = String(user.email || '').trim().toLowerCase();
    async function loadById(uid) {
        let { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
        if (error && error.code === '42703' && String(error.message || '').includes('can_delete_media_wall')) {
            const retry = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
            data = retry.data;
            error = retry.error;
        }
        return { data, error };
    }
    let { data: profile, error } = await loadById(user.id);
    let byEmail = null;
    if (normEmail) {
        const emailRes = await supabase.from('profiles').select('*').eq('email', normEmail).maybeSingle();
        if (!emailRes.error) byEmail = emailRes.data;
    }
    if (!profile && byEmail) {
        profile = { ...byEmail, id: user.id };
        error = null;
    } else if (
        profile && byEmail && normEmail
        && String(byEmail.email || '').trim().toLowerCase() === normEmail
        && profileCanDeleteMediaWall(byEmail) && !profileCanDeleteMediaWall(profile)
    ) {
        // Google 登入 id 與舊 Email 註冊列不同時，同 email 的管理員權限對齊
        profile = { ...byEmail, id: user.id };
    }
    if (profile && profile.can_delete_media_wall == null) profile.can_delete_media_wall = false;
    return { profile, error };
}

async function requireMediaWallDelete(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: '未授權' });
        return null;
    }
    const token = authHeader.replace(/^\s*Bearer\s+/i, '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        res.status(401).json({ error: 'token 無效' });
        return null;
    }
    const { profile, error: profErr } = await resolveProfileForAuthUser(user);
    if (profErr) {
        console.error('requireMediaWallDelete profile:', profErr);
        res.status(500).json({ error: '查詢權限失敗' });
        return null;
    }
    if (!profileCanDeleteMediaWall(profile)) {
        res.status(403).json({
            error: '僅管理員可操作首頁靈感牆刪除／隱藏',
            hint: '請確認 Supabase profiles 中此帳號 role 為 admin（見 docs/fix-admin-media-wall-delete.sql）。'
        });
        return null;
    }
    return user;
}

// PATCH /api/admin/media-wall-item — 管理員在首頁關閉/開啟個別項目顯示
app.patch('/api/admin/media-wall-item', express.json(), async (req, res) => {
    try {
        const adminUser = await requireMediaWallDelete(req, res);
        if (!adminUser) return;
        const { type, id, show } = req.body || {};
        if (!type || !id || typeof show !== 'boolean') {
            return res.status(400).json({ error: '請提供 type（user_design|comparison|collection）、id、show（boolean）' });
        }
        const tid = String(type).toLowerCase();
        if (tid === 'user_design') {
            const { error } = await supabase.from('custom_products').update({ show_on_homepage: show }).eq('id', id);
            if (error) {
                if (/column.*show_on_homepage/i.test(error.message)) return res.status(503).json({ error: '請先執行 docs/add-custom-products-show-on-homepage.sql' });
                return res.status(500).json({ error: error.message });
            }
        } else if (tid === 'comparison' || tid === 'series') {
            const { error } = await supabase.from('manufacturer_portfolio').update({ show_on_media_wall: show }).eq('id', id);
            if (error) {
                if (/column.*show_on_media_wall/i.test(error.message)) return res.status(503).json({ error: '請先執行媒體牆說明文件中 manufacturer_portfolio.show_on_media_wall 的 SQL' });
                return res.status(500).json({ error: error.message });
            }
        } else if (tid === 'collection') {
            const { error } = await supabase.from('media_collections').update({ is_active: show }).eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
        } else {
            return res.status(400).json({ error: 'type 須為 user_design、comparison、series 或 collection' });
        }
        res.json({ success: true, show });
    } catch (e) {
        console.error('PATCH /api/admin/media-wall-item 異常:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/admin/media-wall-item — 管理員永久移除項目（user_design 刪除資料；comparison/collection 僅隱藏）
app.delete('/api/admin/media-wall-item', express.json(), async (req, res) => {
    try {
        const adminUser = await requireMediaWallDelete(req, res);
        if (!adminUser) return;
        const type = (req.body && req.body.type) || req.query.type;
        const id = (req.body && req.body.id) || req.query.id;
        if (!type || !id) {
            return res.status(400).json({ error: '請提供 type（user_design|comparison|series|collection）與 id' });
        }
        const tid = String(type).toLowerCase();
        if (tid === 'user_design') {
            const { error } = await supabase.from('custom_products').delete().eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, deleted: true });
        }
        if (tid === 'comparison' || tid === 'series') {
            const { error } = await supabase.from('manufacturer_portfolio').update({ show_on_media_wall: false }).eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, deleted: false, hidden: true });
        }
        if (tid === 'collection') {
            const { error } = await supabase.from('media_collections').update({ is_active: false }).eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, deleted: false, hidden: true });
        }
        return res.status(400).json({ error: 'type 須為 user_design、comparison、series 或 collection' });
    } catch (e) {
        console.error('DELETE /api/admin/media-wall-item 異常:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/media-wall-item/:type/:id — 單一靈感牆作品（供獨立 URL 頁與 lightbox 使用）
const MEDIA_WALL_ITEM_TYPES = ['user_design', 'comparison', 'series', 'collection'];
app.get('/api/media-wall-item/:type/:id', async (req, res) => {
    const type = (req.params.type || '').trim();
    const id = (req.params.id || '').trim();
    if (!MEDIA_WALL_ITEM_TYPES.includes(type) || !id) {
        return res.status(400).json({ error: 'type 須為 user_design、comparison、series、collection，且 id 必填' });
    }
    try {
        if (type === 'user_design') {
            const { data: row, error } = await supabase
                .from('custom_products')
                .select('id, title, category, subcategory_key, ai_generated_image_url, reference_image_url, created_at, owner_id, analysis_json, generation_prompt, generation_seed, show_on_homepage, ai_tags, image_semantics_json')
                .eq('id', id)
                .maybeSingle();
            if (error || !row) return res.status(404).json({ error: '找不到該作品' });
            if (!row.ai_generated_image_url && !row.reference_image_url) return res.status(404).json({ error: '找不到該作品' });
            let ownerDisplay = '';
            if (row.owner_id) {
                const { data: prof } = await supabase.from('profiles').select('full_name, email').eq('id', row.owner_id).maybeSingle();
                if (prof) ownerDisplay = (prof.full_name && prof.full_name.trim()) || prof.email || '';
            }
            let aj = row.analysis_json;
            if (typeof aj === 'string') try { aj = JSON.parse(aj); } catch (_) { aj = null; }
            const seed = row.generation_seed ?? (aj && (aj.generation_seed ?? aj.seed));
            const item = attachDisplayTags({
                ...row,
                analysis_json: aj || null,
                generation_seed: seed != null && seed !== '' ? seed : null,
                type: 'user_design',
                size: '1x1',
                title: row.title || '未命名',
                image_url: row.ai_generated_image_url || row.reference_image_url,
                link: '/custom/gallery.html',
                inspiration_url: `/inspiration/user_design/${id}`,
                owner_display: ownerDisplay || null,
                category_key: row.category || null,
                subcategory_key: row.subcategory_key || null
            });
            return res.set('Cache-Control', 'public, max-age=120').json({ item });
        }
        if (type === 'comparison' || type === 'series') {
            const { data: row, error } = await supabase
                .from('manufacturer_portfolio')
                .select('id, manufacturer_id, title, image_url, image_url_before, design_highlight, tags, ai_tags, image_semantics_json, description, show_on_media_wall, category_key, subcategory_key, series_image_valid_until, series_image_urls, before_image_valid_until, min_order_quantity')
                .eq('id', id)
                .maybeSingle();
            if (error || !row) return res.status(404).json({ error: '找不到該作品' });
            const isComparison = !!row.image_url_before;
            if (type === 'comparison' && !isComparison) return res.status(404).json({ error: '找不到該對照圖' });
            if (type === 'series' && isComparison) return res.status(404).json({ error: '找不到該系列圖' });
            let mfrUserId = null;
            if (row.manufacturer_id) {
                const { data: mfr } = await supabase.from('manufacturers').select('user_id').eq('id', row.manufacturer_id).eq('is_active', true).maybeSingle();
                if (mfr) mfrUserId = mfr.user_id || null;
            }
            const nowIso = new Date().toISOString();
            const seriesExpired = row.series_image_valid_until && row.series_image_valid_until < nowIso;
            const imageUrl = seriesExpired ? null : (row.image_url || null);
            const imageUrlBefore = row.image_url_before || null;
            const seriesUrls = (Array.isArray(row.series_image_urls) && row.series_image_urls.length) ? (seriesExpired ? [] : row.series_image_urls) : (imageUrl ? [imageUrl] : []);
            const item = attachDisplayTags({
                type: type,
                size: '1x1',
                id: row.id,
                manufacturer_id: row.manufacturer_id,
                manufacturer_user_id: mfrUserId,
                title: row.title || '廠商作品',
                image_url: imageUrl,
                design_highlight: row.design_highlight || null,
                tags: Array.isArray(row.tags) ? row.tags : [],
                ai_tags: Array.isArray(row.ai_tags) ? row.ai_tags : [],
                image_semantics_json: row.image_semantics_json || null,
                description: row.description || null,
                category_key: row.category_key || null,
                subcategory_key: row.subcategory_key || null,
                link: row.manufacturer_id ? '/vendor-profile.html?id=' + encodeURIComponent(row.manufacturer_id) : '/custom/gallery.html',
                inspiration_url: `/inspiration/${type}/${id}`,
                min_order_quantity: (row.min_order_quantity != null && Number.isFinite(Number(row.min_order_quantity))) ? Number(row.min_order_quantity) : null
            });
            if (type === 'comparison') item.image_url_before = imageUrlBefore;
            if (type === 'series' && seriesUrls.length) item.series_image_urls = seriesUrls;
            return res.set('Cache-Control', 'public, max-age=120').json({ item });
        }
        if (type === 'collection') {
            const { data: row, error } = await supabase
                .from('media_collections')
                .select('id, title, slug, cover_image_url, image_urls, description, category_keys, manufacturer_id')
                .eq('id', id)
                .eq('is_active', true)
                .maybeSingle();
            if (error || !row) return res.status(404).json({ error: '找不到該系列' });
            let mfrUserId = null;
            if (row.manufacturer_id) {
                const { data: mfr } = await supabase.from('manufacturers').select('user_id').eq('id', row.manufacturer_id).eq('is_active', true).maybeSingle();
                if (mfr) mfrUserId = mfr.user_id || null;
            }
            const cover = row.cover_image_url || null;
            const imageUrls = (row.image_urls && Array.isArray(row.image_urls) && row.image_urls.length) ? row.image_urls : (cover ? [cover] : []);
            const item = {
                type: 'collection',
                size: '1x2',
                id: row.id,
                title: row.title || '系列',
                slug: row.slug,
                cover_image_url: cover,
                series_image_urls: imageUrls,
                description: row.description || null,
                manufacturer_id: row.manufacturer_id || null,
                manufacturer_user_id: mfrUserId,
                link: row.manufacturer_id ? '/vendor-profile.html?id=' + encodeURIComponent(row.manufacturer_id) : (row.slug ? '/custom/collection.html?slug=' + encodeURIComponent(row.slug) : '/custom/gallery.html'),
                category_keys: Array.isArray(row.category_keys) ? row.category_keys : []
            };
            return res.set('Cache-Control', 'public, max-age=120').json({ item });
        }
        return res.status(400).json({ error: '不支援的 type' });
    } catch (e) {
        console.error('GET /api/media-wall-item 異常:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// ---------- 靈感牆資料夾編輯（1800 方案專用） ----------
const MEDIA_FOLDER_PLAN_KEY = '1800'; // 方案代碼，具此方案或管理員可編輯 media_collections

async function canEditMediaCollections(userId) {
    if (!userId) return false;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
    if (profile?.role === 'admin' || profile?.role === 'tester') return true;
    const now = new Date().toISOString();
    const { data: rows } = await supabase
        .from('user_subscriptions')
        .select('id, subscription_plans(plan_key)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('end_date', now);
    return (rows || []).some(r => r.subscription_plans?.plan_key === MEDIA_FOLDER_PLAN_KEY);
}

async function requireMediaFolderEditor(req, res) {
    const user = await getCurrentUser(req, res);
    if (!user) return null;
    const allowed = await canEditMediaCollections(user.id);
    if (!allowed) {
        res.status(403).json({ error: '僅 1800 方案或管理員可編輯靈感牆資料夾' });
        return null;
    }
    return user;
}

// GET /api/me/can-edit-media-folders — 是否可編輯靈感牆資料夾（1800 方案或管理員）
app.get('/api/me/can-edit-media-folders', async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const allowed = await canEditMediaCollections(user.id);
        res.json({ allowed });
    } catch (e) {
        console.error('GET /api/me/can-edit-media-folders:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// 系列圖上傳：600 點／次，付點數者可顯示一個月
const POINTS_PORTFOLIO_SERIES = 600;

// GET /api/me/can-upload-portfolio-series — 可否上傳系列圖（1800／測試員免費；否則付 600 點，顯示一個月）
app.get('/api/me/can-upload-portfolio-series', async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const free = await canEditMediaCollections(user.id);
        if (free) return res.json({ allowed: true, payPoints: 0 });
        const { data: cred } = await supabase.from('user_credits').select('balance').eq('user_id', user.id).maybeSingle();
        const balance = (cred && cred.balance) ? cred.balance : 0;
        res.json({ allowed: balance >= POINTS_PORTFOLIO_SERIES, payPoints: POINTS_PORTFOLIO_SERIES });
    } catch (e) {
        console.error('GET /api/me/can-upload-portfolio-series:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// 扣 600 點並回傳新餘額；不足則回傳 null
async function deductPortfolioSeriesPoints(userId) {
    const { data: row } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', userId).maybeSingle();
    const current = (row && row.balance) ? row.balance : 0;
    if (current < POINTS_PORTFOLIO_SERIES) return null;
    const balanceAfter = current - POINTS_PORTFOLIO_SERIES;
    const totalSpent = (row ? (row.total_spent || 0) : 0) + POINTS_PORTFOLIO_SERIES;
    const now = new Date().toISOString();
    if (row) {
        const { error: upErr } = await supabase.from('user_credits').update({ balance: balanceAfter, total_spent: totalSpent, updated_at: now }).eq('user_id', userId);
        if (upErr) return null;
    } else {
        const { error: insErr } = await supabase.from('user_credits').insert({ user_id: userId, balance: balanceAfter, total_earned: 0, total_spent: POINTS_PORTFOLIO_SERIES, updated_at: now });
        if (insErr) return null;
    }
    await supabase.from('credit_transactions').insert({
        user_id: userId,
        type: 'consumed',
        amount: -POINTS_PORTFOLIO_SERIES,
        balance_after: balanceAfter,
        source: 'portfolio_series',
        description: '廠商作品系列圖上傳（顯示一個月）',
        metadata: {}
    });
    return balanceAfter;
}

// 對照圖上傳：300/900/1800 方案或測試員免費（有組數上限）；否則付 400 點，顯示一個月
const PORTFOLIO_BEFORE_PLAN_KEYS = ['300', '900', '1800'];
// 各方案對照圖組數上限：300→3 組、900→10 組、1800→30 組；測試員/管理員比照 30 組
const PORTFOLIO_BEFORE_QUOTA = { '300': 3, '900': 10, '1800': 30 };
const PORTFOLIO_BEFORE_QUOTA_DEFAULT = 30;

async function canUploadPortfolioBeforeFree(userId) {
    if (!userId) return false;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
    if (profile?.role === 'admin' || profile?.role === 'tester') return true;
    const now = new Date().toISOString();
    const { data: rows } = await supabase
        .from('user_subscriptions')
        .select('id, subscription_plans(plan_key)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('end_date', now);
    return (rows || []).some(r => PORTFOLIO_BEFORE_PLAN_KEYS.includes(r.subscription_plans?.plan_key));
}

/** 回傳該用戶對照圖免費額度：{ limit, planKey }，無方案則 limit 0 */
async function getPortfolioBeforeQuota(userId) {
    if (!userId) return { limit: 0, planKey: null };
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
    if (profile?.role === 'admin' || profile?.role === 'tester') return { limit: PORTFOLIO_BEFORE_QUOTA_DEFAULT, planKey: 'tester' };
    const now = new Date().toISOString();
    const { data: rows } = await supabase
        .from('user_subscriptions')
        .select('id, subscription_plans(plan_key)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('end_date', now);
    const planKey = (rows && rows[0] && rows[0].subscription_plans) ? rows[0].subscription_plans.plan_key : null;
    const limit = (planKey && PORTFOLIO_BEFORE_QUOTA[planKey] !== undefined) ? PORTFOLIO_BEFORE_QUOTA[planKey] : 0;
    return { limit, planKey };
}

const POINTS_PORTFOLIO_BEFORE = 400;

// GET /api/me/can-upload-portfolio-before — 可否上傳對照圖（300/900/1800/測試員免費有額度；否則付 400 點，顯示一個月）
app.get('/api/me/can-upload-portfolio-before', async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const free = await canUploadPortfolioBeforeFree(user.id);
        const { limit: quotaLimit, planKey } = await getPortfolioBeforeQuota(user.id);
        let quotaUsed = 0;
        const { data: mfr } = await supabase.from('manufacturers').select('id').eq('user_id', user.id).maybeSingle();
        if (mfr && quotaLimit > 0) {
            const { count } = await supabase.from('manufacturer_portfolio')
                .select('*', { count: 'exact', head: true })
                .eq('manufacturer_id', mfr.id)
                .not('image_url_before', 'is', null);
            quotaUsed = typeof count === 'number' ? count : 0;
        }
        if (free) {
            const allowed = quotaUsed < quotaLimit;
            return res.json({ allowed, payPoints: 0, quotaLimit, quotaUsed });
        }
        const { data: cred } = await supabase.from('user_credits').select('balance').eq('user_id', user.id).maybeSingle();
        const balance = (cred && cred.balance) ? cred.balance : 0;
        res.json({ allowed: balance >= POINTS_PORTFOLIO_BEFORE, payPoints: POINTS_PORTFOLIO_BEFORE, quotaLimit: 0, quotaUsed: 0 });
    } catch (e) {
        console.error('GET /api/me/can-upload-portfolio-before:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

async function deductPortfolioBeforePoints(userId) {
    const { data: row } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', userId).maybeSingle();
    const current = (row && row.balance) ? row.balance : 0;
    if (current < POINTS_PORTFOLIO_BEFORE) return null;
    const balanceAfter = current - POINTS_PORTFOLIO_BEFORE;
    const totalSpent = (row ? (row.total_spent || 0) : 0) + POINTS_PORTFOLIO_BEFORE;
    const now = new Date().toISOString();
    if (row) {
        const { error: upErr } = await supabase.from('user_credits').update({ balance: balanceAfter, total_spent: totalSpent, updated_at: now }).eq('user_id', userId);
        if (upErr) return null;
    } else {
        const { error: insErr } = await supabase.from('user_credits').insert({ user_id: userId, balance: balanceAfter, total_earned: 0, total_spent: POINTS_PORTFOLIO_BEFORE, updated_at: now });
        if (insErr) return null;
    }
    await supabase.from('credit_transactions').insert({
        user_id: userId,
        type: 'consumed',
        amount: -POINTS_PORTFOLIO_BEFORE,
        balance_after: balanceAfter,
        source: 'portfolio_before',
        description: '廠商作品對照圖上傳（顯示一個月）',
        metadata: {}
    });
    return balanceAfter;
}

function normalizeMediaCollectionRow(row) {
    if (!row) return row;
    const out = { ...row };
    if (out.title == null && out.name != null) out.title = out.name;
    return out;
}

// GET /api/media-collections — 列表（需先執行 docs/fix-media-collections-for-api.sql）
app.get('/api/media-collections', async (req, res) => {
    try {
        const editor = await requireMediaFolderEditor(req, res);
        if (!editor) return;
        const { data, error } = await supabase
            .from('media_collections')
            .select('id, title, slug, cover_image_url, description, sort_order, is_active, category_keys, created_at')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (error) {
            console.error('GET /api/media-collections:', error);
            return res.status(500).json({ error: error.message });
        }
        res.json({ items: (data || []).map(normalizeMediaCollectionRow) });
    } catch (e) {
        console.error('GET /api/media-collections 異常:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/media-collections/:id
app.get('/api/media-collections/:id', async (req, res) => {
    try {
        const editor = await requireMediaFolderEditor(req, res);
        if (!editor) return;
        const { data, error } = await supabase
            .from('media_collections')
            .select('id, title, slug, cover_image_url, description, sort_order, is_active, category_keys, created_at')
            .eq('id', req.params.id)
            .single();
        if (error) {
            if (error.code === 'PGRST116') return res.status(404).json({ error: '找不到該資料夾' });
            return res.status(500).json({ error: error.message });
        }
        res.json(normalizeMediaCollectionRow(data));
    } catch (e) {
        console.error('GET /api/media-collections/:id:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// PUT /api/media-collections/:id — 更新（僅 1800 方案或管理員）
app.put('/api/media-collections/:id', express.json(), async (req, res) => {
    try {
        const editor = await requireMediaFolderEditor(req, res);
        if (!editor) return;
        const body = req.body || {};
        const updates = {};
        if (body.title !== undefined) updates.title = String(body.title).trim() || null;
        if (body.slug !== undefined) updates.slug = String(body.slug).trim() || null;
        if (body.cover_image_url !== undefined) updates.cover_image_url = body.cover_image_url == null ? null : String(body.cover_image_url).trim();
        if (body.description !== undefined) updates.description = body.description == null ? null : String(body.description).trim();
        if (body.sort_order !== undefined) updates.sort_order = parseInt(body.sort_order, 10);
        if (body.is_active !== undefined) updates.is_active = !!body.is_active;
        if (body.category_keys !== undefined) updates.category_keys = Array.isArray(body.category_keys) ? body.category_keys.filter(Boolean).map(String) : [];
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: '請提供要更新的欄位' });
        let result = await supabase.from('media_collections').update(updates).eq('id', req.params.id).select().single();
        if (result.error && /column.*title|42703/i.test(result.error.message || result.error.code)) {
            if (updates.title !== undefined) {
                updates.name = updates.title;
                delete updates.title;
            }
            result = await supabase.from('media_collections').update(updates).eq('id', req.params.id).select().single();
        }
        const { data, error } = result;
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: '該 slug 已被使用' });
            return res.status(500).json({ error: error.message });
        }
        res.json(normalizeMediaCollectionRow(data));
    } catch (e) {
        console.error('PUT /api/media-collections/:id:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/media-collections — 新增（僅 1800 方案或管理員）
app.post('/api/media-collections', express.json(), async (req, res) => {
    try {
        const editor = await requireMediaFolderEditor(req, res);
        if (!editor) return;
        const body = req.body || {};
        const titleVal = (body.title && String(body.title).trim()) || '';
        const slug = (body.slug && String(body.slug).trim()) || '';
        if (!titleVal) return res.status(400).json({ error: '請填寫標題' });
        const categoryKeys = Array.isArray(body.category_keys) ? body.category_keys.filter(Boolean).map(String) : [];
        let row = {
            title: titleVal,
            slug: slug || null,
            cover_image_url: body.cover_image_url == null ? null : String(body.cover_image_url).trim(),
            description: body.description == null ? null : String(body.description).trim(),
            sort_order: parseInt(body.sort_order, 10) || 0,
            is_active: body.is_active !== false,
            category_keys: categoryKeys
        };
        let result = await supabase.from('media_collections').insert(row).select().single();
        if (result.error && /column.*title|42703/i.test(result.error.message || result.error.code)) {
            row = {
                name: titleVal,
                slug: row.slug,
                cover_image_url: row.cover_image_url,
                description: row.description,
                sort_order: row.sort_order,
                is_active: row.is_active,
                category_keys: row.category_keys
            };
            result = await supabase.from('media_collections').insert(row).select().single();
        }
        const { data, error } = result;
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: '該 slug 已被使用' });
            return res.status(500).json({ error: error.message });
        }
        res.status(201).json(normalizeMediaCollectionRow(data));
    } catch (e) {
        console.error('POST /api/media-collections:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/custom-products/:id - 取得單一客製產品詳細資訊
app.get('/api/custom-products/:id', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: '未授權：缺少 token' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: '未授權：token 無效' });
        }

        const { data, error } = await supabase
            .from('custom_products')
            .select('*')
            .eq('id', req.params.id)
            .eq('owner_id', user.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: '產品不存在或無權限' });
            }
            console.error('查詢客製產品失敗:', error);
            return res.status(500).json({ error: error.message });
        }

        const ownerDisplay = (user.user_metadata && user.user_metadata.full_name) || user.email || '';
        const ownerEmail = user.email || '';
        res.json({
            success: true,
            product: {
                ...data,
                owner_email: ownerEmail,
                owner_display: ownerDisplay
            }
        });
    } catch (e) {
        console.error('GET /api/custom-products/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/custom-products/:id - 更新客製產品（僅基底欄位；show_on_homepage 需先執行 add-custom-products-show-on-homepage.sql）
app.patch('/api/custom-products/:id', express.json(), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: '未授權：缺少 token' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: '未授權：token 無效' });
        }

        const { data: product, error: productError } = await supabase
            .from('custom_products')
            .select('id')
            .eq('id', req.params.id)
            .eq('owner_id', user.id)
            .single();

        if (productError || !product) {
            return res.status(404).json({ error: '產品不存在或無權限' });
        }

        const allowed = ['title', 'description', 'category', 'category_key', 'subcategory_key', 'status', 'show_on_homepage'];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                if (key === 'show_on_homepage') updates[key] = !!req.body[key];
                else if (key === 'category_key') updates.category = req.body[key];
                else if (key === 'subcategory_key') updates.subcategory_key = req.body[key];
                else updates[key] = req.body[key];
            }
        }
        // show_on_homepage：body 可能未被解析，改為同時接受 query（需先執行 add-custom-products-show-on-homepage.sql）
        if (typeof req.query.show_on_homepage !== 'undefined') {
            updates.show_on_homepage = req.query.show_on_homepage === 'true' || req.query.show_on_homepage === '1';
        }
        if (typeof req.body.show_on_homepage !== 'undefined') {
            updates.show_on_homepage = !!req.body.show_on_homepage;
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: '無可更新欄位' });
        }
        // 只有付費會員才可將圖片設為不公開（show_on_homepage: false）
        if (updates.show_on_homepage === false) {
            const isPaid = await hasActivePaidSubscription(user.id);
            if (!isPaid) {
                return res.status(403).json({ error: '需付費訂閱才能將設計圖設為不公開' });
            }
        }

        const { data, error } = await supabase
            .from('custom_products')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) {
            console.error('更新客製產品失敗:', error);
            const msg = (error.message || '');
            if (/column.*show_on_homepage|show_on_homepage.*does not exist/i.test(msg)) {
                return res.status(503).json({ error: '資料庫尚未新增 show_on_homepage 欄位，請在 Supabase 執行 docs/add-custom-products-show-on-homepage.sql' });
            }
            return res.status(500).json({ error: error.message });
        }
        res.json({ success: true, product: data });
    } catch (e) {
        console.error('PATCH /api/custom-products/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/custom-products/:id/manufacturers — 依產品分類取得製作方列表（與找製作方同邏輯，不寫入 DB）
app.get('/api/custom-products/:id/manufacturers', async (req, res) => {
    try {
        const authHeader = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!authHeader) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: product, error: productError } = await supabase
            .from('custom_products')
            .select('id, category, subcategory_key, owner_id, analysis_json, title, description')
            .eq('id', req.params.id)
            .eq('owner_id', user.id)
            .single();

        if (productError || !product) return res.status(404).json({ error: '產品不存在或無權限' });

        const category = (product.category && String(product.category).trim()) ? String(product.category).trim() : inferProductCategory(product);
        const per_page = Math.min(parseInt(req.query.per_page, 10) || 20, 50);

        let manufacturers = [];
        let fromSub = [];
        let fromMain = [];

        if (category && category !== 'default') {
            const { data: mainList, error: eMain } = await supabase
                .from('manufacturers')
                .select('id, name, description, location, rating, contact_json, capabilities, verified, categories, user_id')
                .eq('is_active', true)
                .contains('categories', [category]);
            if (!eMain && mainList) manufacturers = mainList;
        }
        if (manufacturers.length === 0) {
            const mocks = generateMockManufacturersForCustomProduct(category, product.analysis_json || {});
            return res.json({ manufacturers: mocks, from_match: false });
        }

        const ids = manufacturers.map(m => m.id);
        let portfolioByMfr = {};
        if (ids.length > 0) {
            const { data: portfolios } = await supabase
                .from('manufacturer_portfolio')
                .select('id, manufacturer_id, title, image_url, image_url_before, design_highlight, tags, sort_order, min_order_quantity')
                .in('manufacturer_id', ids)
                .order('sort_order', { ascending: true });
            (portfolios || []).forEach(p => {
                if (!portfolioByMfr[p.manufacturer_id]) portfolioByMfr[p.manufacturer_id] = [];
                portfolioByMfr[p.manufacturer_id].push({ id: p.id, title: p.title, image_url: p.image_url, image_url_before: p.image_url_before || null, design_highlight: p.design_highlight || null, tags: p.tags || [], min_order_quantity: (p.min_order_quantity != null && Number.isFinite(Number(p.min_order_quantity))) ? Number(p.min_order_quantity) : null });
            });
        }

        const list = manufacturers.slice(0, per_page).map(mfr => ({
            id: mfr.id,
            name: mfr.name,
            specialty: mfr.description || mfr.name,
            rating: mfr.rating,
            location: mfr.location,
            capabilities: mfr.capabilities,
            contact: mfr.contact_json,
            verified: mfr.verified,
            user_id: mfr.user_id || null,
            portfolio: portfolioByMfr[mfr.id] || [],
            matchScore: 100,
            matchReasons: { category_match: true }
        })).sort((a, b) => (b.rating || 0) - (a.rating || 0));

        res.json({ manufacturers: list, from_match: true });
    } catch (e) {
        console.error('GET /api/custom-products/:id/manufacturers 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/custom-products/:id/match - 執行廠商媒合
app.post('/api/custom-products/:id/match', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: '未授權：缺少 token' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: '未授權：token 無效' });
        }

        // 驗證產品擁有權
        const { data: product, error: productError } = await supabase
            .from('custom_products')
            .select('*')
            .eq('id', req.params.id)
            .eq('owner_id', user.id)
            .single();

        if (productError || !product) {
            return res.status(404).json({ error: '產品不存在或無權限' });
        }

        // 更新產品狀態為 analyzing
        await supabase
            .from('custom_products')
            .update({ status: 'analyzing' })
            .eq('id', req.params.id);

        // 執行媒合邏輯
        const matches = await matchManufacturers(product);

        // 儲存媒合結果（使用 service role 繞過 RLS）
        const matchRecords = matches.map(m => ({
            custom_product_id: product.id,
            manufacturer_id: m.id,
            match_score: m.matchScore,
            match_reasons: m.matchReasons || {},
            status: 'pending'
        }));

        const { error: insertError } = await supabase
            .from('custom_product_matches')
            .insert(matchRecords);

        if (insertError) {
            console.error('儲存媒合結果失敗:', insertError);
        }

        // 更新產品狀態為 matched
        await supabase
            .from('custom_products')
            .update({ status: 'matched' })
            .eq('id', req.params.id);

        res.json({ success: true, matches });
    } catch (e) {
        console.error('POST /api/custom-products/:id/match 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/custom-products/:id/contact - 聯繫廠商
app.post('/api/custom-products/:id/contact', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: '未授權：缺少 token' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: '未授權：token 無效' });
        }

        const { manufacturer_id } = req.body;
        if (!manufacturer_id) {
            return res.status(400).json({ error: '缺少廠商 ID' });
        }

        // 驗證產品擁有權
        const { data: product, error: productError } = await supabase
            .from('custom_products')
            .select('*')
            .eq('id', req.params.id)
            .eq('owner_id', user.id)
            .single();

        if (productError || !product) {
            return res.status(404).json({ error: '產品不存在或無權限' });
        }

        // 更新媒合記錄狀態為 contacted
        const { error: updateError } = await supabase
            .from('custom_product_matches')
            .update({ status: 'contacted' })
            .eq('custom_product_id', req.params.id)
            .eq('manufacturer_id', manufacturer_id);

        if (updateError) {
            console.error('更新聯繫狀態失敗:', updateError);
            return res.status(500).json({ error: updateError.message });
        }

        // 更新產品狀態
        await supabase
            .from('custom_products')
            .update({ status: 'contacted' })
            .eq('id', req.params.id);

        res.json({ success: true, message: '已記錄聯繫狀態' });
    } catch (e) {
        console.error('POST /api/custom-products/:id/contact 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// 從產品標題／描述／分析推斷分類（未填分類時用，避免西裝出現 3D 列印等）
function inferProductCategory(product) {
    const raw = (product.category || '').toString().trim();
    if (raw) return raw;
    const title = (product.title || '').toString();
    const desc = (product.description || '').toString();
    const analysis = product.analysis_json && typeof product.analysis_json === 'object' ? JSON.stringify(product.analysis_json) : '';
    const text = (title + ' ' + desc + ' ' + analysis).toLowerCase();
    if (/西裝|服飾|服裝|衣服|tshirt|shirt|suit|dress|apparel/.test(text)) return 'apparel';
    if (/家具|傢俱|木工|沙發|furniture/.test(text)) return 'furniture';
    if (/運動|sports/.test(text)) return 'sports_goods';
    return 'default';
}

// 訂製品廠商：分類符合即可瀏覽，不做深度媒合
async function matchManufacturers(product) {
    try {
        const category = inferProductCategory(product);

        let query = supabase
            .from('manufacturers')
            .select('*')
            .eq('is_active', true);

        if (category && category !== 'default') {
            query = query.contains('categories', [category]);
        }

        const { data: manufacturers, error } = await query;

        if (error) {
            console.error('查詢廠商失敗:', error);
            return generateMockManufacturersForCustomProduct(category, product.analysis_json || {});
        }

        if (!manufacturers || manufacturers.length === 0) {
            return generateMockManufacturersForCustomProduct(category, product.analysis_json || {});
        }

        // 分類符合即列入，不計算深度媒合分數；僅依評分排序供瀏覽
        return manufacturers.map(mfr => ({
            id: mfr.id,
            name: mfr.name,
            specialty: mfr.description || mfr.name,
            rating: mfr.rating,
            location: mfr.location,
            capabilities: mfr.capabilities,
            contact: mfr.contact_json,
            matchScore: 100,
            matchReasons: { category_match: true }
        })).sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } catch (e) {
        console.error('媒合廠商異常:', e);
        return generateMockManufacturersForCustomProduct(product.category, product.analysis_json || {});
    }
}

// GET /api/me/profile — 當前登入用戶的 profiles 資料（由後端代查，避免前端直連 Supabase 造成 CORS/502）
app.get('/api/me/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || req.headers['x-auth-token'];
        const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { profile, error: profErr } = await resolveProfileForAuthUser(user);
        if (profErr) {
            console.error('GET /api/me/profile:', profErr);
            return res.status(500).json({ error: '查詢失敗' });
        }
        if (profile) {
            const out = { ...profile, id: user.id, email: profile.email || user.email || '' };
            if (out.can_delete_media_wall == null) out.can_delete_media_wall = false;
            out.media_wall_manage = profileCanDeleteMediaWall(profile);
            return res.json(out);
        }
        res.json({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || '',
            role: 'user',
            can_delete_media_wall: false,
            media_wall_manage: false
        });
    } catch (e) {
        console.error('GET /api/me/profile 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/me/contact-info — 當前登入用戶的聯絡資訊（聯絡資訊設定頁所儲存）
app.get('/api/me/contact-info', async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const { data, error } = await supabase
            .from('contact_info')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
        if (error) {
            if (error.code === '42P01') return res.json({}); // 表不存在
            console.error('GET /api/me/contact-info:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        res.json(data || {});
    } catch (e) {
        console.error('GET /api/me/contact-info 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ─────────────────────────────────────────────────────────────
// 媒體牆收藏 API  /api/me/favorites
// ─────────────────────────────────────────────────────────────

// GET /api/me/favorites — 取得登入用戶的媒體牆收藏清單
app.get('/api/me/favorites', async (req, res) => {
    try {
        const token = (req.headers.authorization || '').replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { data, error } = await supabase
            .from('media_wall_favorites')
            .select('item_id, item_data, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: '查詢失敗' });

        // 補充最新的 manufacturer_user_id（item_data 可能是舊版沒有此欄位）
        const rows = data || [];
        const mfrIdsForFavs = [...new Set(rows.map(r => r.item_data?.manufacturer_id).filter(Boolean))];
        let mfrUserIdMap = {};
        if (mfrIdsForFavs.length > 0) {
            const { data: mfrs } = await supabase.from('manufacturers').select('id, user_id').in('id', mfrIdsForFavs);
            (mfrs || []).forEach(m => { mfrUserIdMap[m.id] = m.user_id || null; });
        }

        res.json({ favorites: rows.map(r => {
            const item = r.item_data || {};
            if (item.manufacturer_id && !item.manufacturer_user_id) {
                item.manufacturer_user_id = mfrUserIdMap[item.manufacturer_id] || null;
            }
            return { id: r.item_id, item, savedAt: new Date(r.created_at).getTime() };
        }) });
    } catch (e) {
        console.error('GET /api/me/favorites:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/me/favorites — 加入/移除收藏（toggle）
app.post('/api/me/favorites', express.json(), async (req, res) => {
    try {
        const token = (req.headers.authorization || '').replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { item_id, item_data } = req.body || {};
        if (!item_id) return res.status(400).json({ error: '缺少 item_id' });
        // 檢查是否已存在
        const { data: existing } = await supabase
            .from('media_wall_favorites')
            .select('id')
            .eq('user_id', user.id)
            .eq('item_id', String(item_id))
            .maybeSingle();
        if (existing) {
            // 已存在 → 移除
            await supabase.from('media_wall_favorites').delete().eq('user_id', user.id).eq('item_id', String(item_id));
            return res.json({ action: 'removed', item_id });
        } else {
            // 不存在 → 新增
            await supabase.from('media_wall_favorites').insert({ user_id: user.id, item_id: String(item_id), item_data: item_data || {} });
            return res.json({ action: 'added', item_id });
        }
    } catch (e) {
        console.error('POST /api/me/favorites:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/me/favorites/:item_id — 直接移除指定收藏
app.delete('/api/me/favorites/:item_id', async (req, res) => {
    try {
        const token = (req.headers.authorization || '').replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) return res.status(401).json({ error: '登入已過期或無效' });
        await supabase.from('media_wall_favorites').delete().eq('user_id', user.id).eq('item_id', req.params.item_id);
        res.json({ ok: true });
    } catch (e) {
        console.error('DELETE /api/me/favorites:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/me/manufacturer — 登入後取得「我的廠商」（同一帳號即為廠商，自動對應一筆廠商資料）
app.get('/api/me/manufacturer', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || req.headers['x-auth-token'];
        const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const selectWithLogo = 'id, name, description, location, categories, contact_json, logo_url, vendor_source, expires_at';
        const selectWithoutLogo = 'id, name, description, location, categories, contact_json, vendor_source, expires_at';
        let resq = await supabase.from('manufacturers').select(selectWithLogo).eq('user_id', user.id).maybeSingle();
        if (resq.error) {
            const msg = (resq.error.message || '').toLowerCase();
            if (msg.includes('logo_url') || msg.includes('vendor_source') || msg.includes('expires_at') || msg.includes('column') || msg.includes('does not exist')) {
                resq = await supabase.from('manufacturers').select('id, name, description, location, categories, contact_json').eq('user_id', user.id).maybeSingle();
                if (!resq.error && resq.data) {
                    resq.data.logo_url = null;
                    resq.data.vendor_source = null;
                    resq.data.expires_at = null;
                }
            }
        }
        if (resq.error) {
            console.error('GET /api/me/manufacturer:', resq.error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        const mfr = resq.data;
        if (!mfr) return res.status(404).json({ error: '尚未建立廠商資料', code: 'NO_MANUFACTURER' });
        res.json(mfr);
    } catch (e) {
        console.error('GET /api/me/manufacturer 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/me/manufacturer — 登入廠商「建立我的廠商資料」（第一次使用時填寫，不需管理員綁定）
app.post('/api/me/manufacturer', express.json(), async (req, res) => {
    try {
        const authHeader = req.headers.authorization || req.headers['x-auth-token'];
        const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { data: existing } = await supabase.from('manufacturers').select('id').eq('user_id', user.id).maybeSingle();
        if (existing) return res.status(400).json({ error: '您已有廠商資料，請直接管理作品' });
        const body = req.body || {};
        const name = (body.name || '').trim();
        if (!name) return res.status(400).json({ error: '請填寫廠商名稱' });
        const contact_json = body.contact_json || {
            email: body.email || user.email || '',
            phone: body.phone || '',
            line_id: body.line_id || '',
            url: body.url || body.website || ''
        };
        const { data: inserted, error } = await supabase
            .from('manufacturers')
            .insert({
                user_id: user.id,
                name,
                description: (body.description || '').trim() || null,
                location: (body.location || '').trim() || null,
                contact_json
            })
            .select('id, name, description, location, contact_json')
            .single();
        if (error) {
            console.error('POST /api/me/manufacturer:', error);
            return res.status(500).json({ error: '建立失敗' });
        }
        res.status(201).json(inserted);
    } catch (e) {
        console.error('POST /api/me/manufacturer 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/me/manufacturer — 更新廠商資料（名稱、描述、地點、contact_json 含社群帳號）
app.patch('/api/me/manufacturer', express.json(), async (req, res) => {
    try {
        const authHeader = req.headers.authorization || req.headers['x-auth-token'];
        const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { data: mfr } = await supabase.from('manufacturers').select('id, contact_json, vendor_source').eq('user_id', user.id).maybeSingle();
        if (!mfr) return res.status(404).json({ error: '尚未建立廠商資料' });
        if (await rejectSeedVendorSelfServiceWrite(user.id, mfr, res)) return;
        const body = req.body || {};
        const updates = {};
        if (body.name !== undefined && body.name.trim()) updates.name = body.name.trim();
        if (body.description !== undefined) updates.description = body.description.trim() || null;
        if (body.location !== undefined) updates.location = body.location.trim() || null;
        if (body.categories !== undefined) updates.categories = body.categories;
        if (body.logo_url !== undefined) updates.logo_url = (body.logo_url && String(body.logo_url).trim()) ? String(body.logo_url).trim() : null;
        // 合併 contact_json（只更新帶進來的欄位）
        const SOCIAL_KEYS = ['email','phone','line_id','url','facebook','instagram','threads','twitter','whatsapp','youtube','linkedin'];
        const existing = mfr.contact_json || {};
        let contactPatch = {};
        if (body.contact_json && typeof body.contact_json === 'object') {
            SOCIAL_KEYS.forEach(k => {
                if (body.contact_json[k] !== undefined) contactPatch[k] = body.contact_json[k];
            });
        }
        if (Object.keys(contactPatch).length > 0) {
            updates.contact_json = Object.assign({}, existing, contactPatch);
        }
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: '無可更新的欄位' });
        const { data: updated, error } = await supabase
            .from('manufacturers')
            .update(updates)
            .eq('id', mfr.id)
            .select('id, name, description, location, contact_json')
            .single();
        if (error) {
            console.error('PATCH /api/me/manufacturer:', error);
            return res.status(500).json({ error: '更新失敗' });
        }
        res.json(updated);
    } catch (e) {
        console.error('PATCH /api/me/manufacturer 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/service-areas — 前台讀取服務地區（公開）
// 回傳新三層結構：
//   countries[]  → 台灣 & 海外國家（頂層）
//     .children  → 台灣縣市（葉） or 海外州/地區
//       .children → 海外城市（葉）
//   taiwan_groups → 台灣縣市按北/中/南/東/離島分組（供前台分組顯示用）
app.get('/api/service-areas', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('service_areas')
            .select('code, name_zh, name_en, group_code, group_zh, group_en, sort_order, parent_code, area_type')
            .eq('is_active', true)
            .order('sort_order').order('code');
        if (error) throw error;
        const rows = data || [];

        // 建立 parent→children map
        const childMap = {};
        rows.forEach(r => {
            const p = r.parent_code || '__root__';
            if (!childMap[p]) childMap[p] = [];
            childMap[p].push(r);
        });

        function mapNode(r) {
            const node = { code: r.code, zh: r.name_zh, en: r.name_en, type: r.area_type || 'country' };
            const kids = childMap[r.code] || [];
            if (kids.length) node.children = kids.map(mapNode);
            return node;
        }

        // 頂層國家列表（parent_code IS NULL）
        const topRows = childMap['__root__'] || [];

        // 台灣：抓取並加 group_code 分組資訊（供前台按北中南東離島顯示）
        const twRow = topRows.find(r => r.code === 'TW');
        const twNode = twRow ? mapNode(twRow) : null;
        if (twNode) {
            // 在台灣的 children 中加上 group_code，前台可用來分組
            const twCities = childMap['TW'] || [];
            twNode.children = twCities.map(c => ({
                code: c.code, zh: c.name_zh, en: c.name_en,
                type: 'tw_city', group_code: c.group_code
            }));
        }

        // 海外國家
        const overseasNodes = topRows
            .filter(r => r.code !== 'TW')
            .map(mapNode);

        // 同時保留舊版 groups 格式（兼容 area-codes.js fallback）
        const TW_GROUP_META = {
            'TW-N': { zh:'北部', en:'North Taiwan' },
            'TW-C': { zh:'中部', en:'Central Taiwan' },
            'TW-S': { zh:'南部', en:'South Taiwan' },
            'TW-E': { zh:'東部', en:'East Taiwan' },
            'TW-O': { zh:'離島', en:'Outlying Islands' }
        };
        const twGrouped = {};
        (childMap['TW'] || []).forEach(c => {
            const gk = c.group_code;
            if (!twGrouped[gk]) {
                const m = TW_GROUP_META[gk] || { zh: gk, en: gk };
                twGrouped[gk] = { code: gk, zh: m.zh, en: m.en, cities: [] };
            }
            twGrouped[gk].cities.push({ code: c.code, zh: c.name_zh, en: c.name_en });
        });
        const TW_ORDER = ['TW-N','TW-C','TW-S','TW-E','TW-O'];
        const taiwanGroups = TW_ORDER.filter(k => twGrouped[k]).map(k => twGrouped[k]);

        const overseasGroup = {
            code: 'OVERSEAS', zh: '海外', en: 'Overseas',
            cities: overseasNodes.map(n => {
                const c = { code: n.code, zh: n.zh, en: n.en };
                if (n.children && n.children.length) c.cities = n.children.map(s => {
                    const sc = { code: s.code, zh: s.zh, en: s.en };
                    if (s.children && s.children.length) sc.cities = s.children.map(ct => ({ code: ct.code, zh: ct.zh, en: ct.en }));
                    return sc;
                });
                return c;
            })
        };

        res.json({
            countries: twNode ? [twNode, ...overseasNodes] : overseasNodes,
            taiwan_groups: taiwanGroups,
            // groups：舊版相容格式，area-codes.js 繼續可用
            groups: [...taiwanGroups, ...(overseasGroup.cities.length ? [overseasGroup] : [])]
        });
    } catch (e) {
        console.error('GET /api/service-areas 異常:', e);
        res.status(500).json({ countries: [], taiwan_groups: [], groups: [] });
    }
});

// ── Admin 服務地區 CRUD ────────────────────────────────────────

// GET /api/admin/service-areas — 回傳完整階層（含 name_i18n）
app.get('/api/admin/service-areas', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const { data, error } = await supabase
            .from('service_areas')
            .select('id, code, name_zh, name_en, name_i18n, group_code, group_zh, group_en, sort_order, is_active, parent_code, area_type')
            .order('sort_order').order('code');
        if (error) throw error;
        res.json({ areas: data || [] });
    } catch (e) {
        console.error('GET /api/admin/service-areas:', e);
        res.status(500).json({ error: '查詢失敗' });
    }
});

// POST /api/admin/service-areas — 新增（支援 parent_code + area_type）
app.post('/api/admin/service-areas', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const { code, name_zh, name_en, group_code, group_zh, group_en, sort_order, parent_code, area_type } = req.body || {};
        if (!code || !name_zh || !name_en) return res.status(400).json({ error: '請填寫 code、中文名、英文名' });
        const row = {
            code: code.trim().toUpperCase(),
            name_zh: name_zh.trim(), name_en: name_en.trim(),
            group_code: (group_code||'OVERSEAS').trim().toUpperCase(),
            group_zh: (group_zh||'').trim(), group_en: (group_en||'').trim(),
            sort_order: parseInt(sort_order)||0,
            parent_code: parent_code ? parent_code.trim().toUpperCase() : null,
            area_type: area_type || 'country'
        };
        const { data, error } = await supabase.from('service_areas').insert(row).select().single();
        if (error) throw error;
        res.json({ area: data });
    } catch (e) {
        const msg = (e.code === '23505') ? 'code 已存在' : (e.message || '新增失敗');
        res.status(400).json({ error: msg });
    }
});

// PUT /api/admin/service-areas/:code — 更新（含 name_i18n 多語系）
app.put('/api/admin/service-areas/:code', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const orig = decodeURIComponent(req.params.code);
        const { name_zh, name_en, sort_order, is_active, name_i18n } = req.body || {};
        const update = {};
        if (name_zh !== undefined) update.name_zh = name_zh.trim();
        if (name_en !== undefined) update.name_en = name_en.trim();
        if (sort_order !== undefined) update.sort_order = parseInt(sort_order)||0;
        if (is_active !== undefined) update.is_active = Boolean(is_active);
        if (name_i18n !== undefined && typeof name_i18n === 'object') update.name_i18n = name_i18n;
        const { error } = await supabase.from('service_areas').update(update).eq('code', orig);
        if (error) throw error;
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ error: e.message || '更新失敗' });
    }
});

// DELETE /api/admin/service-areas/:code — 刪除
app.delete('/api/admin/service-areas/:code', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const orig = decodeURIComponent(req.params.code);
        const { error } = await supabase.from('service_areas').delete().eq('code', orig);
        if (error) throw error;
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ error: e.message || '刪除失敗' });
    }
});

// ── 結束 Admin 服務地區 CRUD ───────────────────────────────────

// GET /api/manufacturers — 依分類取得廠商清單（訂製品設計者「找製作方」用）
// Query: category（單一分類，舊版相容） 或 category_key + subcategory_key（子分類優先，不足一頁用主分類填滿）
// 當有 category_key 時：先查 subcategory_key 符合的製作方，不足 per_page 時用 category_key 補滿一頁（子分類排前、去重）
app.get('/api/manufacturers', async (req, res) => {
    try {
        const category = req.query.category;
        const category_key = req.query.category_key || req.query.categoryKey;
        const subcategory_key = req.query.subcategory_key || req.query.subcategoryKey;
        const q = (req.query.q || '').trim();
        const per_page = Math.min(Math.max(parseInt(req.query.per_page || req.query.perPage, 10) || 12, 1), 50);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

        const internalPreview = await getRequestInternalPreviewFlag(req);
        const baseSelect = 'id, name, description, location, rating, contact_json, capabilities, verified, categories, user_id, logo_url, vendor_source, expires_at, seed_public_released_at, is_active';
        let manufacturers = [];
        let fromSub = [];
        let fromMain = [];

        function filterMfrListForAudience(list) {
            return (list || []).filter(function (m) {
                if (internalPreview) return m.is_active !== false;
                return manufacturerVisibleToPublicAudience(m);
            });
        }

        if (category_key || subcategory_key) {
            const expiresFilter = manufacturerVisibleExpiresFilter();
            if (subcategory_key) {
                let subQ = supabase.from('manufacturers').select(baseSelect).eq('is_active', true).contains('categories', [subcategory_key]);
                try { subQ = subQ.or(expiresFilter); } catch (_) {}
                const { data: subList, error: eSub } = await subQ;
                if (!eSub && subList) fromSub = subList;
            }
            const subIds = new Set(fromSub.map(m => m.id));
            if (category_key) {
                let mainQ = supabase.from('manufacturers').select(baseSelect).eq('is_active', true).contains('categories', [category_key]);
                try { mainQ = mainQ.or(expiresFilter); } catch (_) {}
                const { data: mainList, error: eMain } = await mainQ;
                if (!eMain && mainList) fromMain = mainList.filter(m => !subIds.has(m.id));
            }
            manufacturers = filterMfrListForAudience([...fromSub, ...fromMain]);
            // 關鍵字過濾
            if (q) {
                const ql = q.toLowerCase();
                manufacturers = manufacturers.filter(m =>
                    (m.name || '').toLowerCase().includes(ql) ||
                    (m.description || '').toLowerCase().includes(ql)
                );
            }
            const start = (page - 1) * per_page;
            manufacturers = manufacturers.slice(start, start + per_page);
        } else if (category && category !== 'default') {
            let catQ = supabase.from('manufacturers').select(baseSelect).eq('is_active', true).contains('categories', [category]);
            try { catQ = catQ.or(manufacturerVisibleExpiresFilter()); } catch (_) {}
            const { data, error } = await catQ;
            if (error) {
                console.error('GET /api/manufacturers 查詢失敗:', error);
                return res.status(500).json({ error: '查詢廠商失敗' });
            }
            manufacturers = filterMfrListForAudience(data || []);
            if (q) {
                const ql = q.toLowerCase();
                manufacturers = manufacturers.filter(m =>
                    (m.name || '').toLowerCase().includes(ql) ||
                    (m.description || '').toLowerCase().includes(ql)
                );
            }
            const start = (page - 1) * per_page;
            manufacturers = manufacturers.slice(start, start + per_page);
        } else {
            let query = supabase.from('manufacturers').select(baseSelect).eq('is_active', true).order('rating', { ascending: false });
            try { query = query.or(manufacturerVisibleExpiresFilter()); } catch (_) {}
            if (q) {
                query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
            }
            const { data, error } = await query;
            if (error) {
                if (error.code === '42703') {
                    const fallbackSelect = 'id, name, description, location, rating, contact_json, capabilities, verified, categories, user_id, logo_url, is_active, expires_at';
                    let q2 = supabase.from('manufacturers').select(fallbackSelect).eq('is_active', true).order('rating', { ascending: false });
                    try { q2 = q2.or(manufacturerVisibleExpiresFilter()); } catch (_) {}
                    const r2 = await q2;
                    if (r2.error) {
                        console.error('GET /api/manufacturers 查詢失敗:', r2.error);
                        return res.status(500).json({ error: '查詢廠商失敗' });
                    }
                    manufacturers = filterMfrListForAudience((r2.data || []).map(function (m) {
                        return { ...m, vendor_source: null, seed_public_released_at: null };
                    }));
                } else {
                    console.error('GET /api/manufacturers 查詢失敗:', error);
                    return res.status(500).json({ error: '查詢廠商失敗' });
                }
            } else {
                manufacturers = filterMfrListForAudience(data || []);
            }
            const start = (page - 1) * per_page;
            manufacturers = manufacturers.slice(start, start + per_page);
        }

        const ids = manufacturers.map(m => m.id);
        let portfolioByMfr = {};
        if (ids.length > 0) {
            const { data: portfolios } = await supabase
                .from('manufacturer_portfolio')
                .select('id, manufacturer_id, title, image_url, image_url_before, design_highlight, tags, sort_order, min_order_quantity')
                .in('manufacturer_id', ids)
                .order('sort_order', { ascending: true });
            (portfolios || []).forEach(p => {
                if (!portfolioByMfr[p.manufacturer_id]) portfolioByMfr[p.manufacturer_id] = [];
                portfolioByMfr[p.manufacturer_id].push({ id: p.id, title: p.title, image_url: p.image_url, image_url_before: p.image_url_before || null, design_highlight: p.design_highlight || null, tags: p.tags || [], min_order_quantity: (p.min_order_quantity != null && Number.isFinite(Number(p.min_order_quantity))) ? Number(p.min_order_quantity) : null });
            });
        }

        const list = manufacturers.map(mfr => ({
            id: mfr.id,
            name: mfr.name,
            specialty: mfr.description || mfr.name,
            rating: mfr.rating,
            location: mfr.location,
            capabilities: mfr.capabilities,
            contact: mfr.contact_json,
            verified: mfr.verified,
            categories: mfr.categories || [],
            user_id: mfr.user_id || null,
            logo_url: mfr.logo_url || null,
            portfolio: portfolioByMfr[mfr.id] || []
        })).sort((a, b) => (b.rating || 0) - (a.rating || 0));

        res.json({ manufacturers: list });
    } catch (e) {
        console.error('GET /api/manufacturers 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/manufacturers/:id — 單一廠商詳情（vendor-profile.html 用）
// 不篩 is_active：從靈感牆對照圖/系列圖點進來的廠商應能開啟詳情頁；若已過 expires_at 則 404
app.get('/api/manufacturers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const internalPreview = await getRequestInternalPreviewFlag(req);
        const fullSelect = 'id, name, description, location, rating, contact_json, capabilities, verified, categories, user_id, logo_url, is_active, expires_at, vendor_source, seed_public_released_at';
        let resq = await supabase.from('manufacturers').select(fullSelect).eq('id', id).maybeSingle();

        if (resq.error) {
            console.warn('GET /api/manufacturers/:id 完整查詢失敗:', resq.error.code, resq.error.message);
            resq = await supabase.from('manufacturers').select('id, name, description, location, contact_json, categories, expires_at').eq('id', id).maybeSingle();
            if (!resq.error && resq.data) {
                resq.data.rating = null;
                resq.data.capabilities = null;
                resq.data.verified = null;
                resq.data.is_active = true;
                resq.data.user_id = null;
                resq.data.logo_url = null;
            }
        }
        if (resq.error) {
            console.error('GET /api/manufacturers/:id 查詢失敗:', resq.error);
            return res.status(500).json({ error: '查詢失敗', detail: resq.error.message });
        }
        const mfr = resq.data;
        if (!mfr) return res.status(404).json({ error: '廠商不存在' });
        if (!internalPreview && !manufacturerVisibleToPublicAudience(mfr)) {
            if (manufacturerIsSeedVendor(mfr) && !manufacturerSeedPublicReleased(mfr)) {
                return res.status(404).json({ error: '此廠商尚未對外開放展示。' });
            }
            if (mfr.is_active === false) return res.status(404).json({ error: '此廠商已下架。' });
            return res.status(404).json({ error: '找不到廠商' });
        }
        if (mfr.expires_at && new Date(mfr.expires_at) <= new Date()) {
            if (!internalPreview) {
                return res.status(404).json({ error: '此廠商已過公開期。如需繼續曝光請至挖貝升級付費方案。' });
            }
        }

        let portfolio = [];
        const portRes = await supabase
            .from('manufacturer_portfolio')
            .select('id, title, description, image_url, image_url_before, design_highlight, tags, category_key, subcategory_key, sort_order, min_order_quantity')
            .eq('manufacturer_id', id)
            .order('sort_order', { ascending: true });
        if (portRes.error) {
            console.warn('GET /api/manufacturers/:id portfolio 查詢失敗:', portRes.error.message);
        } else {
            portfolio = portRes.data || [];
        }

        res.json({
            id: mfr.id,
            name: mfr.name,
            specialty: mfr.description || '',
            rating: mfr.rating,
            location: mfr.location,
            capabilities: mfr.capabilities,
            contact: mfr.contact_json || {},
            verified: mfr.verified,
            categories: mfr.categories || [],
            user_id: mfr.user_id || null,
            logo_url: mfr.logo_url || null,
            portfolio
        });
    } catch (e) {
        console.error('GET /api/manufacturers/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤', detail: e.message });
    }
});

// GET /api/manufacturer-portfolio — 廠商作品圖列表（圖庫找廠商、從圖庫選擇、純文字搜廠商圖）
// Query: manufacturer_id（單一廠商）, category（依廠商分類篩選）, keyword / q（搜尋 title、tags）
/** @param {unknown} raw @param {{ forUpdate?: boolean }} [opts] */
function parseManufacturerPortfolioMinOrderQty(raw, opts) {
    const forUpdate = opts && opts.forUpdate;
    if (raw === undefined) {
        if (forUpdate) return { omit: true };
        return { value: null };
    }
    if (raw === null) return { value: null };
    const s = String(raw).trim();
    if (s === '' || s.toLowerCase() === 'null') return { value: null };
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 1) return { error: '最小可訂製數量須為 1 以上的整數，或留空表示未填寫' };
    return { value: n };
}

const MANUFACTURER_PORTFOLIO_SELECT_FULL = 'id, manufacturer_id, title, description, image_url, image_url_before, design_highlight, tags, sort_order, created_at, category_key, subcategory_key, category_type, series_image_valid_until, before_image_valid_until, series_image_urls, show_on_media_wall, min_order_quantity';
const MANUFACTURER_PORTFOLIO_SELECT_BASE = 'id, manufacturer_id, title, description, image_url, image_url_before, design_highlight, tags, sort_order, created_at';

app.get('/api/manufacturer-portfolio', async (req, res) => {
    try {
        const { manufacturer_id, category, keyword, q } = req.query;
        const search = keyword || q;

        let portfolioQuery = supabase.from('manufacturer_portfolio').select(MANUFACTURER_PORTFOLIO_SELECT_FULL);
        if (manufacturer_id) portfolioQuery = portfolioQuery.eq('manufacturer_id', manufacturer_id);
        if (category && category !== 'default') {
            let mfrQ = supabase.from('manufacturers').select('id').eq('is_active', true).contains('categories', [category]);
            try { mfrQ = mfrQ.or(manufacturerVisibleExpiresFilter()); } catch (_) {}
            const { data: mfrIds } = await mfrQ;
            const ids = (mfrIds || []).map(m => m.id);
            if (ids.length === 0) return res.json({ items: [] });
            portfolioQuery = portfolioQuery.in('manufacturer_id', ids);
        }
        portfolioQuery = portfolioQuery.order('sort_order', { ascending: true }).order('created_at', { ascending: false });

        let { data: items, error } = await portfolioQuery;

        if (error) {
            console.warn('GET /api/manufacturer-portfolio 完整欄位失敗，改查基礎欄位（請執行 docs/manufacturer-portfolio-add-all-missing-columns.sql 補齊）:', error.message);
            portfolioQuery = supabase.from('manufacturer_portfolio').select(MANUFACTURER_PORTFOLIO_SELECT_BASE);
            if (manufacturer_id) portfolioQuery = portfolioQuery.eq('manufacturer_id', manufacturer_id);
            if (category && category !== 'default') {
                let mfrQ2 = supabase.from('manufacturers').select('id').eq('is_active', true).contains('categories', [category]);
                try { mfrQ2 = mfrQ2.or(manufacturerVisibleExpiresFilter()); } catch (_) {}
                const { data: mfrIds2 } = await mfrQ2;
                const ids2 = (mfrIds2 || []).map(m => m.id);
                if (ids2.length === 0) return res.json({ items: [] });
                portfolioQuery = portfolioQuery.in('manufacturer_id', ids2);
            }
            portfolioQuery = portfolioQuery.order('sort_order', { ascending: true }).order('created_at', { ascending: false });
            const ret = await portfolioQuery;
            error = ret.error;
            items = ret.data || [];
        }

        if (error) {
            console.error('GET /api/manufacturer-portfolio 失敗:', error);
            return res.status(500).json({ error: '查詢作品圖失敗' });
        }

        let list = items || [];
        if (search && String(search).trim()) {
            const k = String(search).trim().toLowerCase();
            list = list.filter(p => {
                const titleMatch = (p.title || '').toLowerCase().includes(k);
                const tagsMatch = Array.isArray(p.tags) && p.tags.some(t => String(t).toLowerCase().includes(k));
                const highlightMatch = (p.design_highlight || '').toLowerCase().includes(k);
                return titleMatch || tagsMatch || highlightMatch;
            });
        }

        const mfrIds = [...new Set(list.map(p => p.manufacturer_id).filter(Boolean))];
        let mfrMap = {};
        if (mfrIds.length > 0) {
            const { data: mfrs } = await supabase.from('manufacturers').select('id, name, location, categories, contact_json, user_id').in('id', mfrIds);
            (mfrs || []).forEach(m => { mfrMap[m.id] = m; });
        }

        const now = new Date();
        const result = list.map(p => {
            const seriesExpired = p.series_image_valid_until && now > new Date(p.series_image_valid_until);
            const beforeExpired = p.before_image_valid_until && now > new Date(p.before_image_valid_until);
            const seriesUrls = (Array.isArray(p.series_image_urls) && p.series_image_urls.length) ? p.series_image_urls : (p.image_url ? [p.image_url] : []);
            return {
                id: p.id,
                manufacturer_id: p.manufacturer_id,
                manufacturer_name: mfrMap[p.manufacturer_id]?.name || '',
                manufacturer_location: mfrMap[p.manufacturer_id]?.location || '',
                manufacturer_contact: mfrMap[p.manufacturer_id]?.contact_json || null,
                manufacturer_user_id: mfrMap[p.manufacturer_id]?.user_id || null,
                categories: mfrMap[p.manufacturer_id]?.categories || [],
                title: p.title,
                description: p.description,
                image_url: seriesExpired ? null : (p.image_url || null),
                series_image_urls: seriesExpired ? [] : seriesUrls,
                image_url_before: beforeExpired ? null : (p.image_url_before || null),
                design_highlight: p.design_highlight || null,
                tags: p.tags || [],
                sort_order: p.sort_order,
                category_key: p.category_key || null,
                subcategory_key: p.subcategory_key || null,
                category_type: p.category_type || null,
                show_on_media_wall: p.show_on_media_wall !== false,
                min_order_quantity: (p.min_order_quantity != null && Number.isFinite(Number(p.min_order_quantity))) ? Number(p.min_order_quantity) : null
            };
        });

        if (result.length === 0) {
            console.warn('GET /api/manufacturer-portfolio 回傳 0 筆。若首頁媒體牆有廠商作品，請確認 .env 已設 SUPABASE_SERVICE_ROLE_KEY 並在 Supabase 執行過 docs/seed-manufacturers-and-portfolio.sql');
        }
        res.json({ items: result });
    } catch (e) {
        console.error('GET /api/manufacturer-portfolio 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/manufacturers/:id/portfolio — 上傳廠商作品圖（系列圖＝1800 方案；對照圖＝所有人）
app.post('/api/manufacturers/:id/portfolio', upload.fields([{ name: 'image', maxCount: 10 }, { name: 'image_before', maxCount: 1 }]), async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const manufacturerId = req.params.id;
        const body = req.body || {};
        const { title, description, design_highlight, tags: tagsParam, image_url: bodyImageUrl, image_url_before: bodyImageUrlBefore, category_key: bodyCategoryKey, subcategory_key: bodySubcategoryKey, category_type: bodyCategoryType, show_on_media_wall: bodyShowOnMediaWall } = body;
        const moqPost = parseManufacturerPortfolioMinOrderQty(body.min_order_quantity);
        if (moqPost.error) return res.status(400).json({ error: moqPost.error });
        const tags = Array.isArray(tagsParam) ? tagsParam : (typeof tagsParam === 'string' && tagsParam ? tagsParam.split(/[,，\s]+/).filter(Boolean) : []);
        const categoryKey = (bodyCategoryKey != null && String(bodyCategoryKey).trim()) ? String(bodyCategoryKey).trim() : null;
        const subcategoryKey = (bodySubcategoryKey != null && String(bodySubcategoryKey).trim()) ? String(bodySubcategoryKey).trim() : null;
        const categoryType = (bodyCategoryType === 'remake') ? 'remake' : 'custom';

        const files = req.files || {};
        const mainFiles = (files.image && Array.isArray(files.image)) ? files.image : [];
        const mainFile = mainFiles[0] || null;
        const beforeFile = (files.image_before && files.image_before[0]) || null;

        const { data: mfr } = await supabase.from('manufacturers').select('id, user_id, vendor_source').eq('id', manufacturerId).single();
        if (!mfr) return res.status(404).json({ error: '找不到該廠商' });
        const isAdmin = await isAdminUserId(user.id);
        if (mfr.user_id !== user.id && !isAdmin) return res.status(403).json({ error: '僅廠商本人或管理員可上傳作品' });
        if (await rejectSeedVendorSelfServiceWrite(user.id, mfr, res)) return;

        const canUploadSeriesFree = await canEditMediaCollections(user.id);
        const canUploadBeforeFree = await canUploadPortfolioBeforeFree(user.id);
        if (!isAdmin && mainFile && !canUploadSeriesFree && !beforeFile) {
            const balanceAfter = await deductPortfolioSeriesPoints(user.id);
            if (balanceAfter === null) {
                return res.status(403).json({ error: '系列圖需 1800 方案、測試員或付 600 點（點數不足）' });
            }
        }
        if (mainFiles.length === 0 && !beforeFile && !bodyImageUrl) {
            return res.status(400).json({ error: '請上傳系列圖（多張可），或對照圖前、後兩張' });
        }

        let imageUrl = bodyImageUrl;
        let seriesImageUrls = [];
        if (mainFiles.length > 0) {
            for (const f of mainFiles) {
                const { publicUrl } = await uploadToSupabaseStorage('custom-products', `manufacturer/${manufacturerId}`, f);
                seriesImageUrls.push(publicUrl);
            }
            imageUrl = seriesImageUrls[0];
        } else if (beforeFile && !canUploadSeriesFree) {
            const { publicUrl } = await uploadToSupabaseStorage('custom-products', `manufacturer/${manufacturerId}`, beforeFile);
            imageUrl = publicUrl;
        }

        let imageUrlBefore = bodyImageUrlBefore || null;
        let beforeFileUsedAsBefore = false;
        if (beforeFile && canUploadSeriesFree) {
            const { publicUrl } = await uploadToSupabaseStorage('custom-products', `manufacturer/${manufacturerId}`, beforeFile);
            imageUrlBefore = publicUrl;
            beforeFileUsedAsBefore = true;
        } else if (beforeFile && mainFile) {
            const { publicUrl } = await uploadToSupabaseStorage('custom-products', `manufacturer/${manufacturerId}`, beforeFile);
            imageUrlBefore = publicUrl;
            beforeFileUsedAsBefore = true;
        }
        if (!isAdmin && beforeFileUsedAsBefore && !canUploadBeforeFree) {
            const balanceAfter = await deductPortfolioBeforePoints(user.id);
            if (balanceAfter === null) {
                return res.status(403).json({ error: '對照圖需 300/900/1800 方案、測試員或付 400 點（點數不足）' });
            }
        }
        if (beforeFileUsedAsBefore && canUploadBeforeFree) {
            const { limit: quotaLimit } = await getPortfolioBeforeQuota(user.id);
            const { count } = await supabase.from('manufacturer_portfolio')
                .select('*', { count: 'exact', head: true })
                .eq('manufacturer_id', manufacturerId)
                .not('image_url_before', 'is', null);
            const current = typeof count === 'number' ? count : 0;
            if (quotaLimit > 0 && current >= quotaLimit) {
                return res.status(403).json({ error: '對照圖組數已達方案上限（300→3 組、900→10 組、1800→30 組）' });
            }
        }

        const oneMonthFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        // 對照圖＝一筆作品：設計圖存 image_url_before、作品圖存 image_url，絕不分開存兩筆
        const insertPayload = {
            manufacturer_id: manufacturerId,
            title: title || null,
            description: description || null,
            design_highlight: design_highlight || null,
            image_url: imageUrl,
            image_url_before: imageUrlBefore,
            tags: tags.length ? tags : [],
            category_key: categoryKey,
            subcategory_key: subcategoryKey,
            category_type: categoryType,
            show_on_media_wall: bodyShowOnMediaWall !== false && bodyShowOnMediaWall !== 'false' && bodyShowOnMediaWall !== 0,
            min_order_quantity: moqPost.value
        };
        if (mainFiles.length > 0 && !canUploadSeriesFree) insertPayload.series_image_valid_until = oneMonthFromNow;
        // 健康邏輯：純系列才寫 series_image_urls，且 image_url_before 必為 null；對照圖不寫 series_image_urls
        if (seriesImageUrls.length > 0 && !beforeFileUsedAsBefore) insertPayload.series_image_urls = seriesImageUrls;
        if (!beforeFileUsedAsBefore) insertPayload.image_url_before = null;
        if (beforeFileUsedAsBefore && !canUploadBeforeFree) insertPayload.before_image_valid_until = oneMonthFromNow;

        const { data: inserted, error } = await supabase
            .from('manufacturer_portfolio')
            .insert(insertPayload)
            .select('id, manufacturer_id, title, description, design_highlight, image_url, image_url_before, tags, sort_order, category_key, subcategory_key, created_at, min_order_quantity')
            .single();

        if (error) {
            console.error('POST /api/manufacturers/:id/portfolio 失敗:', error);
            return res.status(500).json({ error: '新增作品圖失敗' });
        }
        res.status(201).json(inserted);
    } catch (e) {
        console.error('POST /api/manufacturers/:id/portfolio 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/manufacturers/:manufacturerId/portfolio/reorder — 拖曳排序後批次更新 sort_order（廠商頁作品集順序）
app.post('/api/manufacturers/:manufacturerId/portfolio/reorder', express.json(), async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const { manufacturerId } = req.params;
        const { data: mfrRow } = await supabase.from('manufacturers').select('user_id, vendor_source').eq('id', manufacturerId).single();
        if (!mfrRow) return res.status(404).json({ error: '找不到該廠商' });
        const isAdmin = await isAdminUserId(user.id);
        if (mfrRow.user_id !== user.id && !isAdmin) return res.status(403).json({ error: '僅廠商本人或管理員可調整作品順序' });
        if (await rejectSeedVendorSelfServiceWrite(user.id, mfrRow, res)) return;
        const order = req.body && req.body.order;
        if (!Array.isArray(order) || !order.length) {
            return res.status(400).json({ error: '請提供 order 陣列（作品 id 順序）' });
        }
        const ids = order.map((id) => String(id).trim()).filter(Boolean);
        const { data: existing } = await supabase
            .from('manufacturer_portfolio')
            .select('id')
            .eq('manufacturer_id', manufacturerId);
        const allowed = new Set((existing || []).map((r) => r.id));
        if (!ids.every((id) => allowed.has(id))) {
            return res.status(400).json({ error: 'order 含有不屬於此廠商的作品' });
        }
        for (let i = 0; i < ids.length; i++) {
            const { error } = await supabase
                .from('manufacturer_portfolio')
                .update({ sort_order: i, updated_at: new Date().toISOString() })
                .eq('id', ids[i])
                .eq('manufacturer_id', manufacturerId);
            if (error) return res.status(500).json({ error: '排序儲存失敗' });
        }
        const { data: items, error: listErr } = await supabase
            .from('manufacturer_portfolio')
            .select(MANUFACTURER_PORTFOLIO_SELECT_BASE)
            .eq('manufacturer_id', manufacturerId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (listErr) return res.status(500).json({ error: '讀取作品失敗' });
        res.json({ success: true, items: items || [] });
    } catch (e) {
        console.error('POST /api/manufacturers/:manufacturerId/portfolio/reorder:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PUT /api/manufacturers/:id/portfolio/:portfolioId — 更新廠商作品（作品重點、主圖／第二張圖）
app.put('/api/manufacturers/:manufacturerId/portfolio/:portfolioId', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'image_before', maxCount: 1 }]), async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const { manufacturerId, portfolioId } = req.params;
        const body = req.body || {};
        const { title, description, design_highlight, tags: tagsParam, image_url: bodyImageUrl, image_url_before: bodyImageUrlBefore, category_key: bodyCategoryKey, subcategory_key: bodySubcategoryKey, category_type: bodyCategoryType, show_on_media_wall: bodyShowOnMediaWall, upload_type: bodyUploadType } = body;
        const moqPut = parseManufacturerPortfolioMinOrderQty(body.min_order_quantity, { forUpdate: true });
        if (moqPut.error) return res.status(400).json({ error: moqPut.error });
        const tags = Array.isArray(tagsParam) ? tagsParam : (typeof tagsParam === 'string' && tagsParam ? tagsParam.split(/[,，\s]+/).filter(Boolean) : []);

        const files = req.files || {};
        const mainFile = (files.image && files.image[0]) || null;
        const beforeFile = (files.image_before && files.image_before[0]) || null;

        const canUploadSeriesFree = await canEditMediaCollections(user.id);
        const canUploadBeforeFree = await canUploadPortfolioBeforeFree(user.id);
        if (mainFile && !canUploadSeriesFree) {
            const balanceAfter = await deductPortfolioSeriesPoints(user.id);
            if (balanceAfter === null) {
                return res.status(403).json({ error: '系列圖（主圖）需 1800 方案、測試員或付 600 點（點數不足）' });
            }
        }
        if (beforeFile && !canUploadBeforeFree) {
            const balanceAfter = await deductPortfolioBeforePoints(user.id);
            if (balanceAfter === null) {
                return res.status(403).json({ error: '對照圖需 300/900/1800 方案、測試員或付 400 點（點數不足）' });
            }
        }

        const { data: mfrPut } = await supabase.from('manufacturers').select('user_id, vendor_source').eq('id', manufacturerId).single();
        if (!mfrPut) return res.status(404).json({ error: '找不到該廠商' });
        const isAdminPut = await isAdminUserId(user.id);
        if (mfrPut.user_id !== user.id && !isAdminPut) return res.status(403).json({ error: '僅廠商本人或管理員可編輯作品' });
        if (await rejectSeedVendorSelfServiceWrite(user.id, mfrPut, res)) return;

        const { data: row } = await supabase.from('manufacturer_portfolio').select('id, image_url, image_url_before').eq('id', portfolioId).eq('manufacturer_id', manufacturerId).single();
        if (!row) return res.status(404).json({ error: '找不到該作品' });

        if (beforeFile && canUploadBeforeFree && !row.image_url_before) {
            const { limit: quotaLimit } = await getPortfolioBeforeQuota(user.id);
            const { count } = await supabase.from('manufacturer_portfolio')
                .select('*', { count: 'exact', head: true })
                .eq('manufacturer_id', manufacturerId)
                .not('image_url_before', 'is', null);
            const current = typeof count === 'number' ? count : 0;
            if (quotaLimit > 0 && current >= quotaLimit) {
                return res.status(403).json({ error: '對照圖組數已達方案上限（300→3 組、900→10 組、1800→30 組）' });
            }
        }

        const updates = {
            updated_at: new Date().toISOString(),
            ...(title !== undefined && { title: title || null }),
            ...(description !== undefined && { description: description || null }),
            ...(design_highlight !== undefined && { design_highlight: design_highlight || null }),
            ...(tags && { tags: tags.length ? tags : [] })
        };
        if (bodyCategoryKey !== undefined) updates.category_key = (bodyCategoryKey != null && String(bodyCategoryKey).trim()) ? String(bodyCategoryKey).trim() : null;
        if (bodySubcategoryKey !== undefined) updates.subcategory_key = (bodySubcategoryKey != null && String(bodySubcategoryKey).trim()) ? String(bodySubcategoryKey).trim() : null;
        if (bodyCategoryType !== undefined) updates.category_type = (bodyCategoryType === 'remake') ? 'remake' : 'custom';
        if (bodyShowOnMediaWall !== undefined) updates.show_on_media_wall = (bodyShowOnMediaWall !== false && bodyShowOnMediaWall !== 'false' && bodyShowOnMediaWall !== 0);
        if (!moqPut.omit) updates.min_order_quantity = moqPut.value;

        if (mainFile) {
            const { publicUrl } = await uploadToSupabaseStorage('custom-products', `manufacturer/${manufacturerId}`, mainFile);
            updates.image_url = publicUrl;
            if (!canUploadSeriesFree) {
                updates.series_image_valid_until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            }
        } else if (bodyImageUrl !== undefined) updates.image_url = bodyImageUrl || row.image_url;

        if (beforeFile) {
            const { publicUrl } = await uploadToSupabaseStorage('custom-products', `manufacturer/${manufacturerId}`, beforeFile);
            updates.image_url_before = publicUrl;
            if (!canUploadBeforeFree) {
                updates.before_image_valid_until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            }
        } else if (bodyImageUrlBefore !== undefined) updates.image_url_before = bodyImageUrlBefore || null;
        // 健康邏輯：編輯時若為「系列」且未上傳設計圖，明確清除 image_url_before，避免混成對照圖
        else if (String(bodyUploadType || '').toLowerCase() === 'series') updates.image_url_before = null;

        const { data: updated, error } = await supabase.from('manufacturer_portfolio').update(updates).eq('id', portfolioId).select('id, manufacturer_id, title, description, design_highlight, image_url, image_url_before, tags, sort_order, min_order_quantity').single();
        if (error) {
            console.error('PUT /api/manufacturers/:id/portfolio/:portfolioId 失敗:', error);
            return res.status(500).json({ error: '更新失敗' });
        }
        res.json(updated);
    } catch (e) {
        console.error('PUT /api/manufacturers/:id/portfolio/:portfolioId 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/manufacturers/:manufacturerId/portfolio/:portfolioId — 刪除廠商作品圖
app.delete('/api/manufacturers/:manufacturerId/portfolio/:portfolioId', async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const { manufacturerId, portfolioId } = req.params;
        const { data: mfrDel } = await supabase.from('manufacturers').select('user_id, vendor_source').eq('id', manufacturerId).single();
        if (!mfrDel) return res.status(404).json({ error: '找不到該廠商' });
        const isAdminDel = await isAdminUserId(user.id);
        if (mfrDel.user_id !== user.id && !isAdminDel) return res.status(403).json({ error: '僅廠商本人或管理員可刪除作品' });
        if (await rejectSeedVendorSelfServiceWrite(user.id, mfrDel, res)) return;
        const { data: row } = await supabase.from('manufacturer_portfolio').select('id').eq('id', portfolioId).eq('manufacturer_id', manufacturerId).single();
        if (!row) return res.status(404).json({ error: '找不到該作品' });
        const { error } = await supabase.from('manufacturer_portfolio').delete().eq('id', portfolioId);
        if (error) {
            console.error('DELETE /api/manufacturers/:id/portfolio/:portfolioId 失敗:', error);
            return res.status(500).json({ error: '刪除失敗' });
        }
        res.status(204).send();
    } catch (e) {
        console.error('DELETE /api/manufacturers/:id/portfolio/:portfolioId 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ---------- 廠商自訂分類（獨立於網站 category_key）----------
function slugifyVendorCatalogGroupName(name) {
    const s = String(name || '').trim().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u4e00-\u9fff-]+/g, '')
        .slice(0, 48);
    return s || 'group';
}

function parseCatalogGroupIdsFromBody(body) {
    const ids = new Set();
    const raw = body && body.catalog_group_ids;
    if (raw) {
        try {
            const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (Array.isArray(arr)) arr.forEach((id) => { if (id) ids.add(String(id).trim()); });
        } catch (_) {}
    }
    const single = body && (body.catalog_group_id || '').trim();
    if (single) ids.add(single);
    return [...ids];
}

/** 材料自訂分類名稱（供 AI 優化／生圖附錄，取代 material_key） */
async function vendorCatalogGroupNamesByIds(manufacturerId, groupIds) {
    const ids = [...new Set((groupIds || []).map((id) => String(id).trim()).filter(Boolean))];
    if (!ids.length || !manufacturerId) return '';
    let { data: groups, error } = await supabase
        .from('vendor_catalog_groups')
        .select('id, name, asset_kind')
        .eq('manufacturer_id', manufacturerId)
        .in('id', ids);
    if (error && error.code === '42703') {
        ({ data: groups } = await supabase
            .from('vendor_catalog_groups')
            .select('id, name')
            .eq('manufacturer_id', manufacturerId)
            .in('id', ids));
    }
    return (groups || [])
        .filter((g) => vendorCatalogGroupRowAssetKind(g) === 'material')
        .map((g) => String(g.name || '').trim())
        .filter(Boolean)
        .join('、');
}

async function vendorCatalogGroupsTableReady() {
    const { error } = await supabase.from('vendor_catalog_groups').select('id').limit(1);
    return !error || error.code !== '42P01';
}

async function getAssetIdsForCatalogGroup(catalogGroupId, manufacturerId) {
    if (!catalogGroupId) return { assetIds: null, error: null };
    const { data: grp, error: grpErr } = await supabase
        .from('vendor_catalog_groups')
        .select('id, manufacturer_id')
        .eq('id', catalogGroupId)
        .maybeSingle();
    if (grpErr && grpErr.code === '42P01') return { assetIds: null, error: 'no_table' };
    if (grpErr) throw grpErr;
    if (!grp) return { assetIds: [], error: 'not_found' };
    if (manufacturerId && grp.manufacturer_id !== manufacturerId) return { assetIds: [], error: 'mismatch' };
    const { data: links, error: linkErr } = await supabase
        .from('vendor_asset_group_links')
        .select('asset_id')
        .eq('group_id', catalogGroupId);
    if (linkErr && linkErr.code === '42P01') return { assetIds: null, error: 'no_table' };
    if (linkErr) throw linkErr;
    return { assetIds: (links || []).map((r) => r.asset_id), group: grp };
}

function normalizeVendorCatalogGroupKindFilter(q) {
    const k = String(q || '').trim().toLowerCase();
    if (k === 'material' || k === 'prototype' || k === 'part') return k;
    return null;
}

async function buildVendorCatalogGroupsPayload(manufacturerId, assetKindFilter) {
    const kindFilter = normalizeVendorCatalogGroupKindFilter(assetKindFilter);
    let { data: groups, error } = await supabase
        .from('vendor_catalog_groups')
        .select('id, manufacturer_id, name, slug, parent_id, sort_order, asset_kind, created_at, updated_at')
        .eq('manufacturer_id', manufacturerId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
    if (error && error.code === '42703') {
        ({ data: groups, error } = await supabase
            .from('vendor_catalog_groups')
            .select('id, manufacturer_id, name, slug, parent_id, sort_order, created_at, updated_at')
            .eq('manufacturer_id', manufacturerId)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true }));
    }
    if (error) throw error;
    let list = groups || [];
    if (kindFilter) {
        list = list.filter((g) => vendorCatalogGroupRowAssetKind(g) === kindFilter);
    }
    const groupIds = list.map((g) => g.id);
    let countMap = {};
    if (groupIds.length) {
        const { data: links } = await supabase.from('vendor_asset_group_links').select('group_id, asset_id').in('group_id', groupIds);
        const assetIds = [...new Set((links || []).map((l) => l.asset_id).filter(Boolean))];
        const assetKindById = {};
        if (assetIds.length) {
            const { data: assets } = await supabase.from('vendor_assets').select('id, asset_kind').in('id', assetIds);
            (assets || []).forEach((a) => { assetKindById[a.id] = normalizeVendorAssetKind(a.asset_kind); });
        }
        (links || []).forEach((l) => {
            const ak = assetKindById[l.asset_id] || 'prototype';
            if (kindFilter && ak !== kindFilter) return;
            countMap[l.group_id] = (countMap[l.group_id] || 0) + 1;
        });
    }
    const byId = {};
    list.forEach((g) => {
        byId[g.id] = { ...g, asset_count: countMap[g.id] || 0, children: [] };
    });
    const roots = [];
    list.forEach((g) => {
        const node = byId[g.id];
        if (g.parent_id && byId[g.parent_id]) byId[g.parent_id].children.push(node);
        else roots.push(node);
    });
    function flatten(nodes, depth, out) {
        nodes.sort((a, b) => (a.sort_order - b.sort_order) || String(a.name).localeCompare(String(b.name), 'zh-Hant'));
        nodes.forEach((n) => {
            const pad = depth > 0 ? '\u3000'.repeat(Math.min(depth, 3)) : '';
            out.push({
                id: n.id,
                name: n.name,
                slug: n.slug,
                parent_id: n.parent_id,
                sort_order: n.sort_order,
                asset_count: n.asset_count,
                asset_kind: vendorCatalogGroupRowAssetKind(n),
                depth,
                label: pad + n.name + (n.asset_count ? ` (${n.asset_count})` : '')
            });
            if (n.children && n.children.length) flatten(n.children, depth + 1, out);
        });
    }
    const flat = [];
    flatten(roots, 0, flat);
    return { tree: roots, flat };
}

async function setVendorAssetCatalogGroups(assetId, manufacturerId, groupIds) {
    if (!(await vendorCatalogGroupsTableReady())) return;
    const ids = [...new Set((groupIds || []).map((id) => String(id).trim()).filter(Boolean))];
    if (ids.length) {
        const { data: assetRow } = await supabase.from('vendor_assets').select('asset_kind').eq('id', assetId).maybeSingle();
        const assetKind = normalizeVendorAssetKind(assetRow && assetRow.asset_kind);
        let { data: owned, error: ownErr } = await supabase
            .from('vendor_catalog_groups')
            .select('id, asset_kind')
            .eq('manufacturer_id', manufacturerId)
            .in('id', ids);
        if (ownErr && ownErr.code === '42703') {
            ({ data: owned } = await supabase
                .from('vendor_catalog_groups')
                .select('id')
                .eq('manufacturer_id', manufacturerId)
                .in('id', ids));
        }
        const allowed = new Set((owned || []).filter((g) => vendorCatalogGroupRowAssetKind(g) === assetKind).map((g) => g.id));
        const valid = ids.filter((id) => allowed.has(id));
        await supabase.from('vendor_asset_group_links').delete().eq('asset_id', assetId);
        if (valid.length) {
            await supabase.from('vendor_asset_group_links').insert(valid.map((group_id) => ({ asset_id: assetId, group_id })));
        }
    } else {
        await supabase.from('vendor_asset_group_links').delete().eq('asset_id', assetId);
    }
}

async function attachCatalogGroupIdsToAssets(items) {
    if (!(await vendorCatalogGroupsTableReady()) || !items || !items.length) return items;
    const assetIds = items.map((r) => r.id).filter(Boolean);
    if (!assetIds.length) return items;
    const { data: links, error: linkErr } = await supabase
        .from('vendor_asset_group_links')
        .select('asset_id, group_id')
        .in('asset_id', assetIds);
    if (linkErr && linkErr.code === '42P01') return items;
    if (linkErr) throw linkErr;
    const groupIds = [...new Set((links || []).map((l) => l.group_id).filter(Boolean))];
    const groupsById = {};
    if (groupIds.length) {
        let { data: groups, error: grpErr } = await supabase
            .from('vendor_catalog_groups')
            .select('id, name, parent_id, asset_kind')
            .in('id', groupIds);
        if (grpErr && grpErr.code === '42703') {
            ({ data: groups, error: grpErr } = await supabase
                .from('vendor_catalog_groups')
                .select('id, name, parent_id')
                .in('id', groupIds));
        }
        if (grpErr) throw grpErr;
        (groups || []).forEach((g) => {
            const name = (g.name != null) ? String(g.name).trim() : '';
            if (g.id && name) groupsById[g.id] = { id: g.id, name, parent_id: g.parent_id || null, asset_kind: g.asset_kind };
        });
    }
    const map = {};
    (links || []).forEach((l) => {
        if (!map[l.asset_id]) map[l.asset_id] = [];
        const g = groupsById[l.group_id];
        if (g) map[l.asset_id].push(g);
    });
    return items.map((r) => {
        const itemKind = normalizeVendorAssetKind(r.asset_kind);
        const cats = (map[r.id] || []).filter((g) => vendorCatalogGroupRowAssetKind(g) === itemKind);
        return {
            ...r,
            catalog_group_ids: cats.map((g) => g.id),
            catalog_groups: cats.map((g) => ({ id: g.id, name: g.name, parent_id: g.parent_id }))
        };
    });
}

// GET /api/me/vendor-catalog-groups — 廠商自己的分類樹
app.get('/api/me/vendor-catalog-groups', async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        if (!(await vendorCatalogGroupsTableReady())) {
            return res.json({ tree: [], flat: [], message: '請執行 docs/add-vendor-catalog-groups.sql' });
        }
        const assetKindQ = (req.query.asset_kind || '').trim().toLowerCase();
        const assetKindFilter = normalizeVendorCatalogGroupKindFilter(assetKindQ);
        let hasAssetKindColumn = true;
        const probe = await supabase.from('vendor_catalog_groups').select('asset_kind').limit(1);
        if (probe.error && probe.error.code === '42703') hasAssetKindColumn = false;
        if ((assetKindFilter === 'material' || assetKindFilter === 'part') && !hasAssetKindColumn) {
            return res.json({
                tree: [],
                flat: [],
                asset_kind_split_unavailable: true,
                message: '請執行 docs/add-vendor-catalog-groups-asset-kind.sql'
            });
        }
        const payload = await buildVendorCatalogGroupsPayload(manufacturerId, assetKindFilter);
        res.json({ ...payload, asset_kind_split_unavailable: false });
    } catch (e) {
        console.error('GET /api/me/vendor-catalog-groups:', e);
        res.status(500).json({ error: '查詢失敗' });
    }
});

// POST /api/me/vendor-catalog-groups — 新增分類
app.post('/api/me/vendor-catalog-groups', express.json(), async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        if (!(await vendorCatalogGroupsTableReady())) {
            return res.status(500).json({ error: '請執行 docs/add-vendor-catalog-groups.sql' });
        }
        const body = req.body || {};
        const name = (body.name || '').trim();
        if (!name) return res.status(400).json({ error: '請填寫分類名稱' });
        const parentId = (body.parent_id || '').trim() || null;
        if (parentId) {
            const { data: parent } = await supabase.from('vendor_catalog_groups').select('id').eq('id', parentId).eq('manufacturer_id', manufacturerId).maybeSingle();
            if (!parent) return res.status(400).json({ error: '上層分類不存在' });
        }
        let slug = (body.slug || '').trim() || slugifyVendorCatalogGroupName(name);
        const catalogKind = normalizeVendorAssetKind(body.asset_kind);
        const row = {
            manufacturer_id: manufacturerId,
            name,
            slug,
            parent_id: parentId,
            sort_order: (body.sort_order != null && !isNaN(body.sort_order)) ? parseInt(body.sort_order, 10) : 0,
            asset_kind: catalogKind
        };
        let { data, error } = await supabase.from('vendor_catalog_groups').insert(row).select().single();
        if (error && error.code === '42703') {
            if (catalogKind === 'material') {
                return res.status(503).json({ error: '請先執行 docs/add-vendor-catalog-groups-asset-kind.sql，材料才能使用獨立分類' });
            }
            const fallback = { manufacturer_id: manufacturerId, name, slug, parent_id: parentId, sort_order: row.sort_order };
            ({ data, error } = await supabase.from('vendor_catalog_groups').insert(fallback).select().single());
        }
        if (error) {
            console.error('POST /api/me/vendor-catalog-groups:', error);
            return res.status(500).json({ error: '新增失敗' });
        }
        res.status(201).json(data);
    } catch (e) {
        console.error('POST /api/me/vendor-catalog-groups 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PUT /api/me/vendor-catalog-groups/:id
app.put('/api/me/vendor-catalog-groups/:id', express.json(), async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        const id = (req.params.id || '').trim();
        const body = req.body || {};
        const updates = { updated_at: new Date().toISOString() };
        if (body.name !== undefined) updates.name = (body.name || '').trim() || null;
        if (body.slug !== undefined) updates.slug = (body.slug || '').trim() || null;
        if (body.sort_order !== undefined) updates.sort_order = parseInt(body.sort_order, 10) || 0;
        if (body.parent_id !== undefined) {
            const pid = (body.parent_id || '').trim() || null;
            if (pid === id) return res.status(400).json({ error: '不可將自己設為上層' });
            if (pid) {
                const { data: parent } = await supabase.from('vendor_catalog_groups').select('id').eq('id', pid).eq('manufacturer_id', manufacturerId).maybeSingle();
                if (!parent) return res.status(400).json({ error: '上層分類不存在' });
            }
            updates.parent_id = pid;
        }
        const { data, error } = await supabase
            .from('vendor_catalog_groups')
            .update(updates)
            .eq('id', id)
            .eq('manufacturer_id', manufacturerId)
            .select()
            .single();
        if (error) return res.status(500).json({ error: '更新失敗' });
        if (!data) return res.status(404).json({ error: '找不到分類' });
        res.json(data);
    } catch (e) {
        console.error('PUT /api/me/vendor-catalog-groups:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/me/vendor-catalog-groups/reorder — 拖曳排序後批次更新 sort_order
app.post('/api/me/vendor-catalog-groups/reorder', express.json(), async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        if (!(await vendorCatalogGroupsTableReady())) {
            return res.status(500).json({ error: '請執行 docs/add-vendor-catalog-groups.sql' });
        }
        const order = req.body && req.body.order;
        if (!Array.isArray(order) || !order.length) {
            return res.status(400).json({ error: '請提供 order 陣列（分類 id 順序）' });
        }
        const ids = order.map((id) => String(id).trim()).filter(Boolean);
        const kindFilter = normalizeVendorCatalogGroupKindFilter(req.body.asset_kind);
        let { data: existing, error: existErr } = await supabase
            .from('vendor_catalog_groups')
            .select('id, asset_kind')
            .eq('manufacturer_id', manufacturerId);
        if (existErr && existErr.code === '42703') {
            ({ data: existing } = await supabase
                .from('vendor_catalog_groups')
                .select('id')
                .eq('manufacturer_id', manufacturerId));
        }
        const allowed = new Set((existing || []).filter((r) => {
            if (!kindFilter) return true;
            return vendorCatalogGroupRowAssetKind(r) === kindFilter;
        }).map((r) => r.id));
        if (!ids.every((id) => allowed.has(id))) {
            return res.status(400).json({ error: 'order 含有不屬於此廠商或此類型的分類' });
        }
        for (let i = 0; i < ids.length; i++) {
            const { error } = await supabase
                .from('vendor_catalog_groups')
                .update({ sort_order: i, updated_at: new Date().toISOString() })
                .eq('id', ids[i])
                .eq('manufacturer_id', manufacturerId);
            if (error) return res.status(500).json({ error: '排序儲存失敗' });
        }
        const payload = await buildVendorCatalogGroupsPayload(manufacturerId, kindFilter);
        res.json({ success: true, ...payload });
    } catch (e) {
        console.error('POST /api/me/vendor-catalog-groups/reorder:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/me/vendor-catalog-groups/:id
app.delete('/api/me/vendor-catalog-groups/:id', async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        const id = (req.params.id || '').trim();
        const { error } = await supabase.from('vendor_catalog_groups').delete().eq('id', id).eq('manufacturer_id', manufacturerId);
        if (error) return res.status(500).json({ error: '刪除失敗' });
        res.status(204).send();
    } catch (e) {
        console.error('DELETE /api/me/vendor-catalog-groups:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/manufacturers/:id/catalog-groups — 公開：廠商頁／素材庫依廠商分類瀏覽
app.get('/api/manufacturers/:id/catalog-groups', async (req, res) => {
    try {
        const manufacturerId = (req.params.id || '').trim();
        if (!manufacturerId) return res.status(400).json({ error: '缺少廠商 id' });
        if (!(await vendorCatalogGroupsTableReady())) {
            return res.json({ tree: [], flat: [], manufacturer_id: manufacturerId });
        }
        const { data: mfr } = await supabase.from('manufacturers').select('id, name, is_active').eq('id', manufacturerId).eq('is_active', true).maybeSingle();
        if (!mfr) return res.status(404).json({ error: '找不到廠商' });
        const assetKindQ = (req.query.asset_kind || '').trim().toLowerCase();
        const assetKindFilter = normalizeVendorCatalogGroupKindFilter(assetKindQ);
        const payload = await buildVendorCatalogGroupsPayload(manufacturerId, assetKindFilter);
        res.json({ ...payload, manufacturer_id: manufacturerId, manufacturer_name: mfr.name });
    } catch (e) {
        console.error('GET /api/manufacturers/:id/catalog-groups:', e);
        res.status(500).json({ error: '查詢失敗' });
    }
});

// ---------- 廠商素材庫（設計端參考圖來源；依設計當下分類載入；必顯示廠商名稱與連結）----------
// GET /api/vendor-assets — 設計端選圖用。分類素材池：必傳 category_key；個別廠商版型庫：可只傳 manufacturer_id
// 種子廠商：未同意公開前僅 admin/tester 可見；同意後僅 is_public 素材對一般使用者顯示
app.get('/api/vendor-assets', async (req, res) => {
    try {
        const internalPreview = await getRequestInternalPreviewFlag(req);
        const categoryKey = (req.query.category_key || '').trim() || null;
        const subcategoryKey = (req.query.subcategory_key || '').trim() || null;
        const styleKey = normalizeVendorStyleKey(req.query.style_key) || null;
        const materialKey = normalizeVendorMaterialKey(req.query.material_key) || null;
        const colorQ = (req.query.color || req.query.color_key || '').trim().toLowerCase() || null;
        let manufacturerId = (req.query.manufacturer_id || '').trim() || null;
        const manufacturerNameQ = (req.query.manufacturer_name || req.query.q || '').trim() || null;
        const serviceAreaCode = (req.query.service_area || '').trim() || null;
        const searchQ = (req.query.q || req.query.search || '').trim() || null;
        const assetKindQ = (req.query.asset_kind || '').trim().toLowerCase();
        const assetKindFilter = (assetKindQ === 'prototype' || assetKindQ === 'material' || assetKindQ === 'part') ? assetKindQ : null;
        const pageParams = parseVendorAssetsListPageParams(req.query);
        const manufacturersOnly = parseTruthyBody(req.query.manufacturers_only);
        const catalogGroupId = (req.query.catalog_group_id || '').trim() || null;
        const moqFilterRaw = (req.query.min_order_quantity != null ? String(req.query.min_order_quantity) : '').trim();
        const moqFilter = moqFilterRaw ? parseInt(moqFilterRaw, 10) : null;
        if (moqFilterRaw && (!Number.isFinite(moqFilter) || moqFilter < 1)) {
            return res.status(400).json({ error: 'min_order_quantity 須為 1 以上的整數' });
        }
        const customFilterKeys = normalizeCustomizationLevels(
            (req.query.customization_levels || '').trim().split(/[,，]/).filter(Boolean)
        );
        if (!categoryKey && !manufacturerId) return res.status(400).json({ error: '請傳入 category_key（分類素材池）或 manufacturer_id（個別廠商版型庫）' });

        let catalogGroupAssetIds = null;
        if (catalogGroupId) {
            const cg = await getAssetIdsForCatalogGroup(catalogGroupId, manufacturerId);
            if (cg.error === 'no_table') catalogGroupAssetIds = null;
            else if (cg.error === 'not_found' || cg.error === 'mismatch') return res.json({ items: [], manufacturers: [] });
            else {
                catalogGroupAssetIds = new Set(cg.assetIds || []);
                if (!manufacturerId && cg.group) manufacturerId = cg.group.manufacturer_id;
            }
        }

        const selectCols = 'id, manufacturer_id, category_key, subcategory_key, title, description, image_url, gallery_images, usage_type, sort_order, style_key, material_key, color_key, asset_kind, part_key, ai_tags, image_semantics_json, min_order_quantity, customization_levels';
        async function runQuery(cols) {
            let q = supabase
                .from('vendor_assets')
                .select(cols)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: false });
            if (!internalPreview) q = q.eq('is_public', true);
            if (categoryKey) q = q.eq('category_key', categoryKey);
            if (subcategoryKey && assetKindFilter !== 'material') q = q.eq('subcategory_key', subcategoryKey);
            if (styleKey) q = q.eq('style_key', styleKey);
            if (materialKey && assetKindFilter !== 'material') q = q.eq('material_key', materialKey);
            if (manufacturerId) q = q.eq('manufacturer_id', manufacturerId);
            if (assetKindFilter && cols.includes('asset_kind')) q = q.eq('asset_kind', assetKindFilter);
            return q;
        }
        let { data: rows, error } = await runQuery(selectCols);
        if (error && error.code === '42703') {
            const legacyCols = selectCols.split(',').map((c) => c.trim()).filter((c) => c && c !== 'part_key' && c !== 'asset_kind' && c !== 'color_key' && c !== 'min_order_quantity' && c !== 'customization_levels').join(', ');
            ({ data: rows, error } = await runQuery(legacyCols));
        }
        if (error) {
            if (error.code === '42P01') return res.status(200).json({ items: [], manufacturers: [], message: '尚未建立廠商素材表，請執行 docs/vendor-assets-schema.sql' });
            console.error('GET /api/vendor-assets 失敗:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        let list = rows || [];
        if (assetKindFilter && list.length && list[0].asset_kind == null) {
            list = list.filter((r) => normalizeVendorAssetKind(r.asset_kind) === assetKindFilter);
        }
        if (subcategoryKey && !assetKindFilter) {
            list = list.filter((r) => {
                const rk = normalizeVendorAssetKind(r.asset_kind);
                if (rk === 'material') return true;
                return (r.subcategory_key || '') === subcategoryKey;
            });
        }
        if (colorQ) list = list.filter((r) => vendorAssetMatchesColor(r, colorQ));
        const mfrIds = [...new Set(list.map(r => r.manufacturer_id).filter(Boolean))];
        let mfrMap = {};
        if (mfrIds.length) {
            let mfrQ = supabase.from('manufacturers').select('id, name, logo_url, vendor_source, contact_json, location, user_id, is_active, expires_at, seed_public_released_at').in('id', mfrIds);
            if (!internalPreview) mfrQ = mfrQ.eq('is_active', true);
            const { data: mfrs } = await mfrQ;
            (mfrs || []).forEach(m => { mfrMap[m.id] = m; });
        }
        if (manufacturerNameQ) {
            list = list.filter((r) => manufacturerNameMatches(mfrMap[r.manufacturer_id], manufacturerNameQ));
        }
        if (serviceAreaCode) {
            list = list.filter((r) => manufacturerMatchesServiceArea(mfrMap[r.manufacturer_id], serviceAreaCode));
        }
        if (searchQ) {
            list = list.filter((r) => vendorAssetMatchesSearch(r, mfrMap[r.manufacturer_id], searchQ));
        }
        if (catalogGroupAssetIds) {
            list = list.filter((r) => catalogGroupAssetIds.has(r.id));
        }
        if (moqFilter != null) {
            list = list.filter((r) => vendorAssetMatchesMoqFilter(r, moqFilter));
        }
        if (customFilterKeys.length) {
            list = list.filter((r) => vendorAssetMatchesCustomizationFilter(r, customFilterKeys));
        }
        list = list.filter(function (r) {
            const mfr = mfrMap[r.manufacturer_id];
            if (!mfr) return false;
            if (internalPreview) return true;
            return vendorAssetVisibleToPublicAudience(mfr, r);
        });
        const lang = (req.query.lang || '').trim();
        const manufacturers = [...new Set(list.map(r => r.manufacturer_id).filter(Boolean))].map((id) => ({
            id,
            name: (mfrMap[id] && mfrMap[id].name) ? mfrMap[id].name : '廠商',
            logo_url: (mfrMap[id] && mfrMap[id].logo_url) ? mfrMap[id].logo_url : null,
            profile_url: '/vendor-profile.html?id=' + encodeURIComponent(id)
        })).sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hant'));
        if (manufacturersOnly) {
            return res.json({ manufacturers });
        }
        const items = list.map(r => {
            const kind = normalizeVendorAssetKind(r.asset_kind);
            const pk = kind === 'material' ? null : (r.part_key || null);
            const mapped = mapVendorAssetForApi(r, lang);
            const protoMeta = enrichVendorAssetPrototypeFields(r, lang);
            return {
                id: r.id,
                manufacturer_id: r.manufacturer_id,
                category_key: r.category_key,
                subcategory_key: r.subcategory_key,
                title: r.title,
                description: r.description,
                image_url: r.image_url,
                gallery_images: mapped.gallery_images,
                image_urls: mapped.image_urls,
                image_count: mapped.image_count,
                usage_type: r.usage_type,
                sort_order: r.sort_order,
                style_key: r.style_key || null,
                style_label: r.style_key ? vendorStyleKeyLabel(r.style_key, lang) : null,
                material_key: kind === 'material' ? null : (r.material_key || null),
                material_label: kind === 'material' ? null : (r.material_key ? vendorMaterialKeyLabel(r.material_key, lang) : null),
                color_key: r.color_key || null,
                color_label: r.color_key ? vendorColorKeyLabel(r.color_key, lang) : null,
                asset_kind: kind,
                part_key: pk,
                min_order_quantity: protoMeta.min_order_quantity,
                customization_levels: protoMeta.customization_levels,
                customization_level_labels: protoMeta.customization_level_labels,
                manufacturer_name: (mfrMap[r.manufacturer_id] && mfrMap[r.manufacturer_id].name) ? mfrMap[r.manufacturer_id].name : '廠商',
                manufacturer_logo_url: (mfrMap[r.manufacturer_id] && mfrMap[r.manufacturer_id].logo_url) ? mfrMap[r.manufacturer_id].logo_url : null,
                manufacturer_profile_url: r.manufacturer_id ? '/vendor-profile.html?id=' + encodeURIComponent(r.manufacturer_id) : null,
                manufacturer_location: (mfrMap[r.manufacturer_id] && mfrMap[r.manufacturer_id].location) ? mfrMap[r.manufacturer_id].location : '',
                manufacturer_user_id: (mfrMap[r.manufacturer_id] && mfrMap[r.manufacturer_id].user_id) ? mfrMap[r.manufacturer_id].user_id : null,
                manufacturer_contact: (mfrMap[r.manufacturer_id] && mfrMap[r.manufacturer_id].contact_json) ? mfrMap[r.manufacturer_id].contact_json : null,
                ai_tags: r.ai_tags || []
            };
        });
        let itemsOut = items;
        if (items.length && (await vendorCatalogGroupsTableReady())) {
            itemsOut = await attachCatalogGroupIdsToAssets(items);
        }
        const paged = paginateVendorAssetList(itemsOut, pageParams);
        res.json({
            items: paged.items,
            total: paged.total,
            limit: paged.limit,
            offset: paged.offset,
            manufacturers,
            catalog_group_id: catalogGroupId || null
        });
    } catch (e) {
        console.error('GET /api/vendor-assets 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/me/vendor-assets — 廠商自己的素材列表（需登入且已建立廠商資料）
app.get('/api/me/vendor-assets', async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        try {
            await syncMembershipCatalogVisibility(user.id);
        } catch (syncErr) {
            console.warn('syncMembershipCatalogVisibility:', syncErr && syncErr.message);
        }
        const { data: mfr } = await supabase.from('manufacturers').select('id').eq('user_id', user.id).maybeSingle();
        if (!mfr) {
            return res.status(404).json({ error: '尚未建立廠商資料', code: 'NO_MANUFACTURER' });
        }
        const manufacturerId = mfr.id;
        const categoryKey = (req.query.category_key || '').trim() || null;
        const catalogGroupId = (req.query.catalog_group_id || '').trim() || null;
        const assetKindQ = (req.query.asset_kind || '').trim().toLowerCase();
        const assetKindFilter = normalizeVendorCatalogGroupKindFilter(assetKindQ);
        async function runList(selectCols) {
            let query = supabase
                .from('vendor_assets')
                .select(selectCols)
                .eq('manufacturer_id', manufacturerId)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: false });
            if (categoryKey) query = query.eq('category_key', categoryKey);
            if (assetKindFilter && selectCols.includes('asset_kind')) query = query.eq('asset_kind', assetKindFilter);
            return query;
        }
        let { data: list, error } = await runList(VENDOR_ASSET_SELECT_ME);
        if (error && error.code === '42703') {
            ({ data: list, error } = await runList(VENDOR_ASSET_SELECT_ME_LEGACY));
            if (list) list = list.map((row) => ({ ...row, asset_kind: row.asset_kind || 'prototype' }));
        }
        if (error) {
            if (error.code === '42P01') return res.json({ items: [] });
            console.error('GET /api/me/vendor-assets 失敗:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        if (assetKindFilter && list && list.length && list[0].asset_kind == null) {
            list = list.filter((row) => normalizeVendorAssetKind(row.asset_kind) === assetKindFilter);
        }
        if (catalogGroupId) {
            const cg = await getAssetIdsForCatalogGroup(catalogGroupId, manufacturerId);
            if (cg.assetIds) {
                const idSet = new Set(cg.assetIds);
                list = (list || []).filter((row) => idSet.has(row.id));
            }
        }
        list = await enrichVendorAssetsWithSupplierMeta(manufacturerId, list || []);
        if (list && list.length) list = await attachCatalogGroupIdsToAssets(list);
        const lang = resolveVendorAssetApiLang(req);
        const mapped = (list || []).map(function (row) { return mapVendorAssetForApi(row, lang); });
        /* 廠商後台依分頁在前端各 Tab 篩選；此處回傳完整列表，避免只取 12 筆導致原型／零件列表空白 */
        res.json({
            items: mapped,
            total: mapped.length,
            limit: mapped.length,
            offset: 0
        });
    } catch (e) {
        console.error('GET /api/me/vendor-assets 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/me/vendor-assets/upload-pricing — 上傳扣點說明（預覽標籤不扣點）
app.get('/api/me/vendor-assets/upload-pricing', async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        res.json({
            points_upload: await getPointsVendorAssetUpload(),
            points_optimize: await getPointsVendorAssetOptimize(),
            points_optimize_material: await getPointsVendorAssetMaterialOptimize(),
            points_description: await getPointsVendorAssetDescription(),
            optimize_includes_tags: true
        });
    } catch (e) {
        console.error('GET /api/me/vendor-assets/upload-pricing:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/me/vendor-assets/generate-tags — 上傳前預覽 AI 標籤（Gemini 讀圖）
app.post('/api/me/vendor-assets/generate-tags', upload.single('image'), async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        const seedUser = await getRequestUserFromAuthHeader(req);
        if (!seedUser) return res.status(401).json({ error: '請先登入' });
        if (await rejectSeedVendorSelfServiceWrite(seedUser.id, manufacturerId, res)) return;
        const file = await vendorAssetFileFromMulter(req.file);
        if (!file) return res.status(400).json({ error: '請上傳素材圖片' });
        const body = req.body || {};
        const ownerId = seedUser.id;
        const assetKindPreview = normalizeVendorAssetKind(body.asset_kind);
        const result = await runVendorAssetImageSemantics(file, {
            asset_kind: assetKindPreview,
            category_key: (body.category_key || '').trim(),
            title: (body.title || '').trim(),
            description: (body.description || '').trim()
        }, ownerId);
        const uiLocalePreview = resolveUiLocaleFromRequest(req);
        let subcategoryNamePreview = null;
        const categoryKeyPreview = (body.category_key || '').trim();
        const subcategoryKeyPreview = (body.subcategory_key || '').trim();
        if (assetKindPreview === 'prototype' && categoryKeyPreview && subcategoryKeyPreview) {
            subcategoryNamePreview = await lookupAiSubcategoryName(categoryKeyPreview, subcategoryKeyPreview);
        }
        const suggestedTitle = autoVendorAssetTitleFromSemantics(result.semantics, assetKindPreview, uiLocalePreview, {
            subcategoryName: subcategoryNamePreview
        });
        res.json({
            ai_tags: result.tags,
            image_semantics_json: result.semantics,
            description: result.description || null,
            suggested_title: suggestedTitle || null,
            model: result.model
        });
    } catch (e) {
        console.error('POST /api/me/vendor-assets/generate-tags:', e);
        res.status(503).json({ error: e.message || 'AI 標籤產生失敗，請稍後重試' });
    }
});

// POST /api/me/vendor-assets/generate-description — 編輯區讀圖產生簡短說明（扣點，預覽標籤不扣點）
app.post('/api/me/vendor-assets/generate-description', upload.single('image'), async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        const seedUser = await getRequestUserFromAuthHeader(req);
        if (!seedUser) return res.status(401).json({ error: '請先登入' });
        if (await rejectSeedVendorSelfServiceWrite(seedUser.id, manufacturerId, res)) return;
        const body = req.body || {};
        const assetId = (body.asset_id || '').trim();
        const file = req.file;
        let imageFile = file;
        let context = {
            asset_kind: normalizeVendorAssetKind(body.asset_kind),
            category_key: (body.category_key || '').trim(),
            title: (body.title || '').trim(),
            description: (body.description || '').trim()
        };
        if (!imageFile && assetId) {
            const { data: row, error: rowErr } = await fetchVendorAssetOwnedByManufacturer(
                assetId, manufacturerId, 'id, image_url, category_key, title, description, asset_kind'
            );
            if (rowErr) {
                console.error('generate-description select:', rowErr);
                return res.status(500).json({ error: '查詢失敗' });
            }
            if (!row || !row.image_url) return res.status(404).json({ error: '找不到該素材或無圖片' });
            context = {
                asset_kind: normalizeVendorAssetKind(row.asset_kind),
                category_key: context.category_key || row.category_key || '',
                title: context.title || row.title || '',
                description: context.description || row.description || '',
                image_url: row.image_url
            };
            const deps = getVisualSemanticsDeps();
            const resImg = await deps.fetch(row.image_url, { redirect: 'follow' });
            if (!resImg.ok) return res.status(503).json({ error: '無法讀取素材圖片' });
            const imgBuf = Buffer.from(await resImg.arrayBuffer());
            const imgMime = (resImg.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
            imageFile = await normalizeVendorUploadFile({
                buffer: imgBuf,
                mimetype: imgMime,
                originalname: 'asset.jpg'
            });
            const authHeader = req.headers.authorization || req.headers['x-auth-token'];
            const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
            let ownerId = null;
            if (token) {
                const { data: { user } } = await supabase.auth.getUser(token);
                ownerId = user?.id || null;
            }
            const result = await runVendorAssetImageSemantics(imageFile, context, ownerId);
            const description = result.description || visualSemantics.buildVendorAssetDescriptionFromSemantics(result.semantics);
            if (!description) return res.status(503).json({ error: '無法產生說明，請稍後重試' });
            const pointsRequired = await getPointsVendorAssetDescription();
            let isAdmin = false;
            if (ownerId) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', ownerId).maybeSingle();
                isAdmin = profile?.role === 'admin';
            }
            let balanceAfter = null;
            let pointsDeducted = 0;
            if (!isAdmin && ownerId && pointsRequired > 0) {
                const { balance, sufficient } = await checkUserCreditsBalance(ownerId, pointsRequired);
                if (!sufficient) {
                    return res.status(402).json({ error: '點數不足', balance, required: pointsRequired });
                }
                const consumed = await consumeUserCredits(
                    ownerId,
                    pointsRequired,
                    'vendor_asset_description',
                    '素材庫 AI 產生簡短說明',
                    { manufacturer_id: manufacturerId, vendor_asset_id: assetId }
                );
                if (!consumed.ok) {
                    return res.status(402).json({ error: consumed.error || '扣點失敗', balance: consumed.balance });
                }
                balanceAfter = consumed.balance_after;
                pointsDeducted = pointsRequired;
            }
            return res.json({
                description,
                product_description_zh: result.semantics?.product_description_zh || null,
                product_description_en: result.semantics?.product_description_en || null,
                points_deducted: pointsDeducted,
                balance_after: balanceAfter
            });
        }
        if (!imageFile) return res.status(400).json({ error: '請上傳圖片或提供素材 id' });
        imageFile = await vendorAssetFileFromMulter(imageFile);
        const authHeader = req.headers.authorization || req.headers['x-auth-token'];
        const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
        let ownerId = null;
        if (token) {
            const { data: { user } } = await supabase.auth.getUser(token);
            ownerId = user?.id || null;
        }
        const pointsRequired = await getPointsVendorAssetDescription();
        let isAdmin = false;
        if (ownerId) {
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', ownerId).maybeSingle();
            isAdmin = profile?.role === 'admin';
        }
        if (!isAdmin && ownerId && pointsRequired > 0) {
            const { balance, sufficient } = await checkUserCreditsBalance(ownerId, pointsRequired);
            if (!sufficient) {
                return res.status(402).json({ error: '點數不足', balance, required: pointsRequired });
            }
        }
        const result = await runVendorAssetImageSemantics(imageFile, context, ownerId);
        const description = result.description || vendorAssetDescriptionFromSemantics(result.semantics);
        if (!description) return res.status(503).json({ error: '無法產生說明，請稍後重試' });
        let balanceAfter = null;
        let pointsDeducted = 0;
        if (!isAdmin && ownerId && pointsRequired > 0) {
            const consumed = await consumeUserCredits(
                ownerId,
                pointsRequired,
                'vendor_asset_description',
                '素材庫 AI 產生簡短說明（編輯換圖）',
                { manufacturer_id: manufacturerId, vendor_asset_id: assetId || null }
            );
            if (!consumed.ok) {
                return res.status(402).json({ error: consumed.error || '扣點失敗', balance: consumed.balance });
            }
            balanceAfter = consumed.balance_after;
            pointsDeducted = pointsRequired;
        }
        res.json({
            description,
            product_description_zh: result.semantics?.product_description_zh || null,
            product_description_en: result.semantics?.product_description_en || null,
            points_deducted: pointsDeducted,
            balance_after: balanceAfter
        });
    } catch (e) {
        console.error('POST /api/me/vendor-assets/generate-description:', e);
        res.status(503).json({ error: e.message || 'AI 說明產生失敗，請稍後重試' });
    }
});

const vendorAssetCreateUpload = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'gallery', maxCount: PROTOTYPE_GALLERY_MAX_EXTRA }
]);

// POST /api/me/vendor-assets — 廠商上傳素材（需登入且已建立廠商資料）；種子廠商不得上傳
app.post('/api/me/vendor-assets', vendorAssetCreateUpload, async (req, res) => {
    try {
        const uploadUser = await assertCanUploadProductsAndAssets(req, res);
        if (!uploadUser) return;
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        if (await rejectSeedVendorSelfServiceWrite(uploadUser.id, manufacturerId, res)) return;
        const body = req.body || {};
        const categoryKey = (body.category_key || '').trim();
        if (!categoryKey) return res.status(400).json({ error: '請選擇主分類（category_key）' });
        const assetKind = normalizeVendorAssetKind(body.asset_kind);
        const subcategoryKey = assetKind === 'material' ? null : ((body.subcategory_key || '').trim() || null);
        const isPrototypeLike = assetKind === 'prototype' || assetKind === 'part';
        let title = (body.title || '').trim() || null;
        let description = (body.description || '').trim() || null;
        const uiLocaleCreate = resolveUiLocaleFromRequest(req);
        const styleKey = (body.style_key || '').trim() || null;
        const catalogGroupIdsEarly = parseCatalogGroupIdsFromBody(body);
        let materialCatalogHint = '';
        if (assetKind === 'material' && catalogGroupIdsEarly.length) {
            materialCatalogHint = await vendorCatalogGroupNamesByIds(manufacturerId, catalogGroupIdsEarly);
        }
        let prototypeMoqValue = null;
        let prototypeCustomizationLevels = [];
        if (assetKind === 'prototype') {
            const moqParsed = parseVendorAssetPrototypeMoq(body.min_order_quantity, { required: true });
            if (moqParsed.error) return res.status(400).json({ error: moqParsed.error });
            prototypeMoqValue = moqParsed.value;
            const clValid = validatePrototypeCustomizationLevels(body.customization_levels);
            if (clValid.error) return res.status(400).json({ error: clValid.error });
            prototypeCustomizationLevels = clValid.levels;
        }

        const fileFromFields = (req.files && req.files.image && req.files.image[0]) ? req.files.image[0] : req.file;
        let file = await vendorAssetFileFromMulter(fileFromFields);
        if (!file) return res.status(400).json({ error: '請上傳素材圖片' });
        const galleryUploadFiles = (isPrototypeLike && req.files && req.files.gallery) ? req.files.gallery : [];

        const wantsOptimize = parseTruthyBody(body.optimize_product_image);
        const pointsRequired = wantsOptimize
            ? await getPointsVendorAssetOptimizeForKind(assetKind)
            : await getPointsVendorAssetUpload();

        const authHeader = req.headers.authorization || req.headers['x-auth-token'];
        const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
        let ownerId = null;
        if (token) {
            const { data: { user } } = await supabase.auth.getUser(token);
            ownerId = user?.id || null;
        }
        let isAdmin = false;
        if (ownerId) {
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', ownerId).maybeSingle();
            isAdmin = profile?.role === 'admin';
        }
        if (!isAdmin && ownerId && pointsRequired > 0) {
            const { balance, sufficient } = await checkUserCreditsBalance(ownerId, pointsRequired);
            if (!sufficient) {
                return res.status(402).json({ error: '點數不足', balance, required: pointsRequired });
            }
        }

        let tags = parseAiTagsFromBody(body);
        let semanticsJson = null;
        let tagsSource = 'gemini';
        if (body.image_semantics_json) {
            try {
                semanticsJson = typeof body.image_semantics_json === 'string'
                    ? JSON.parse(body.image_semantics_json)
                    : body.image_semantics_json;
            } catch (_) {}
        }
        if (!tags || !tags.length) {
            try {
                const sem = await runVendorAssetImageSemantics(file, {
                    asset_kind: assetKind,
                    category_key: categoryKey,
                    title,
                    description,
                    material_catalog_hint: materialCatalogHint || undefined
                }, ownerId);
                tags = sem.tags;
                semanticsJson = sem.semantics;
                tagsSource = 'gemini';
                if (!description && sem.description) description = sem.description;
            } catch (semErr) {
                console.error('vendor-assets semantics:', semErr);
                return res.status(503).json({ error: semErr.message || 'AI 標籤產生失敗，請稍後重試' });
            }
        } else {
            tagsSource = semanticsJson ? 'gemini' : 'manual';
            if (!description && semanticsJson) {
                description = vendorAssetDescriptionFromSemantics(semanticsJson);
            }
            if (assetKind === 'material' && semanticsJson) {
                const fin = finalizeVendorAssetSemantics(semanticsJson, tags, assetKind);
                semanticsJson = fin.semantics;
                tags = fin.tags;
            }
        }
        if (!title && semanticsJson && (assetKind === 'material' || isPrototypeLike)) {
            let subcategoryNameCreate = null;
            if (assetKind === 'prototype' && subcategoryKey) {
                subcategoryNameCreate = await lookupAiSubcategoryName(categoryKey, subcategoryKey);
            }
            title = autoVendorAssetTitleFromSemantics(semanticsJson, assetKind, uiLocaleCreate, {
                subcategoryName: subcategoryNameCreate,
                materialCatalogHint
            });
        }

        let uploadFile = file;
        if (wantsOptimize) {
            try {
                const optimizeBackground = (body.optimize_background || body.background_color || '').trim() || 'white';
                const optimizedBuf = await optimizeVendorAssetImageWithFlux(
                    file.buffer, file.mimetype, title, assetKind,
                    assetKind === 'material' ? materialCatalogHint : ((body.material_key || '').trim() || null),
                    optimizeBackground
                );
                uploadFile = {
                    buffer: optimizedBuf,
                    mimetype: 'image/jpeg',
                    originalname: (file.originalname || 'image.jpg').replace(/\.[^.]+$/, '') + '.jpg'
                };
            } catch (optErr) {
                console.error('vendor-assets image optimize:', optErr);
                const mapped = vendorAssetOptimizeErrorResponse(optErr, assetKind);
                return res.status(mapped.status).json(mapped.body);
            }
        }

        const { publicUrl } = await uploadToSupabaseStorage('custom-products', `vendor-assets/${manufacturerId}`, uploadFile);
        let galleryImages = [];
        if (isPrototypeLike && galleryUploadFiles.length) {
            const maxExtra = Math.min(galleryUploadFiles.length, PROTOTYPE_GALLERY_MAX_EXTRA);
            galleryImages = await uploadVendorAssetGalleryFiles(manufacturerId, galleryUploadFiles.slice(0, maxExtra), 1);
        }
        const insertPayload = {
            manufacturer_id: manufacturerId,
            category_key: categoryKey,
            subcategory_key: subcategoryKey,
            title: title,
            description: description,
            image_url: publicUrl,
            gallery_images: galleryImages,
            usage_type: (body.usage_type || 'reference_only').trim() || 'reference_only',
            is_public: true,
            sort_order: (body.sort_order != null && !isNaN(body.sort_order)) ? parseInt(body.sort_order, 10) : 0,
            ai_tags: tags,
            ai_tags_generated_at: new Date().toISOString(),
            tags_source: tagsSource
        };
        if (semanticsJson) insertPayload.image_semantics_json = semanticsJson;
        if (styleKey) insertPayload.style_key = normalizeVendorStyleKey(styleKey);
        if (assetKind !== 'material') {
            const materialKey = (body.material_key || '').trim() || null;
            if (materialKey) insertPayload.material_key = normalizeVendorMaterialKey(materialKey);
        }
        const colorKeyBody = (body.color_key || '').trim() || null;
        const colorKeyDerived = normalizeVendorColorKey(colorKeyBody, semanticsJson) || deriveColorKeyFromSemantics(semanticsJson);
        if (colorKeyDerived) insertPayload.color_key = colorKeyDerived;
        insertPayload.asset_kind = assetKind;
        const partKeyNorm = normalizeVendorPartKey(body.part_key, assetKind);
        if (partKeyNorm) insertPayload.part_key = partKeyNorm;
        if (assetKind === 'prototype') {
            insertPayload.min_order_quantity = prototypeMoqValue;
            insertPayload.customization_levels = prototypeCustomizationLevels;
        } else if (assetKind === 'part') {
            insertPayload.min_order_quantity = null;
            insertPayload.customization_levels = [];
        }
        let galleryMigrationRequired = false;
        let prototypeMetaMigrationRequired = false;
        let inserted = null;
        let insertError = null;
        ({ data: inserted, error: insertError } = await supabase
            .from('vendor_assets')
            .insert(insertPayload)
            .select('id, manufacturer_id, category_key, subcategory_key, title, description, image_url, gallery_images, usage_type, sort_order, asset_kind, part_key, ai_tags, image_semantics_json, tags_source, created_at')
            .single());
        if (insertError && insertError.code === '42703' && String(insertError.message || '').includes('gallery_images')) {
            delete insertPayload.gallery_images;
            galleryMigrationRequired = galleryImages.length > 0;
            ({ data: inserted, error: insertError } = await supabase.from('vendor_assets').insert(insertPayload)
                .select('id, manufacturer_id, category_key, subcategory_key, title, description, image_url, usage_type, sort_order, asset_kind, part_key, ai_tags, image_semantics_json, tags_source, created_at')
                .single());
        }
        if (insertError && insertError.code === '42703' && (
            String(insertError.message || '').includes('min_order_quantity') ||
            String(insertError.message || '').includes('customization_levels')
        )) {
            delete insertPayload.min_order_quantity;
            delete insertPayload.customization_levels;
            prototypeMetaMigrationRequired = assetKind === 'prototype';
            ({ data: inserted, error: insertError } = await supabase.from('vendor_assets').insert(insertPayload)
                .select('id, manufacturer_id, category_key, subcategory_key, title, description, image_url, gallery_images, usage_type, sort_order, asset_kind, part_key, ai_tags, image_semantics_json, tags_source, created_at')
                .single());
        }
        if (insertError) {
            if (insertError.code === '42703' && String(insertError.message || '').includes('part_key')) {
                delete insertPayload.part_key;
                const retryPk = await supabase.from('vendor_assets').insert(insertPayload)
                    .select('id, manufacturer_id, category_key, subcategory_key, title, description, image_url, usage_type, sort_order, asset_kind, ai_tags, image_semantics_json, tags_source, created_at')
                    .single();
                if (!retryPk.error) {
                    return res.status(201).json({ ...retryPk.data, asset_kind: normalizeVendorAssetKind(body.asset_kind), part_key: null });
                }
            }
            if (insertError.code === '42703' && String(insertError.message || '').includes('asset_kind')) {
                delete insertPayload.asset_kind;
                delete insertPayload.part_key;
                const retry = await supabase.from('vendor_assets').insert(insertPayload)
                    .select('id, manufacturer_id, category_key, subcategory_key, title, description, image_url, usage_type, sort_order, ai_tags, image_semantics_json, tags_source, created_at').single();
                if (retry.error) {
                    return res.status(500).json({ error: '請先執行 docs/add-vendor-asset-kind.sql 新增 asset_kind 欄位' });
                }
                return res.status(201).json({ ...retry.data, asset_kind: normalizeVendorAssetKind(body.asset_kind) });
            }
            if (insertError.code === '42703') {
                return res.status(500).json({ error: '請先至管理後台「資料庫維護」執行「視覺語意庫」migration，或於 Supabase SQL Editor 執行 docs/add-digital-prototype-ai-tags.sql' });
            }
            console.error('POST /api/me/vendor-assets 失敗:', insertError);
            return res.status(500).json({ error: '新增素材失敗' });
        }
        await setVendorAssetCatalogGroups(inserted.id, manufacturerId, parseCatalogGroupIdsFromBody(body));
        await recordVisualSemanticsEvent({
            source_type: 'vendor_asset',
            source_id: inserted.id,
            image_url: publicUrl,
            text_input: null,
            semantics_kind: 'image',
            ai_tags: tags,
            semantics_json: semanticsJson,
            model: tagsSource === 'gemini' ? await getTaggingModelName() : null,
            prompt_version: visualSemantics.PROMPT_VERSION,
            owner_id: ownerId,
            category_key: categoryKey
        });
        let balanceAfter = null;
        if (!isAdmin && ownerId && pointsRequired > 0) {
            const consumed = await consumeUserCredits(
                ownerId,
                pointsRequired,
                wantsOptimize ? 'vendor_asset_optimize' : 'vendor_asset_upload',
                wantsOptimize
                    ? (assetKind === 'material'
                        ? `材料參考上傳＋材質圖優化（${pointsRequired} 點）`
                        : `數位原型上傳＋產品圖優化（${pointsRequired} 點）`)
                    : (assetKind === 'material'
                        ? `材料參考上傳（${pointsRequired} 點）`
                        : `數位原型上傳（${pointsRequired} 點）`),
                { manufacturer_id: manufacturerId, optimize: wantsOptimize, asset_kind: assetKind }
            );
            if (!consumed.ok) {
                console.warn('vendor-assets 扣點失敗（已上傳）:', consumed.error);
            } else {
                balanceAfter = consumed.balance_after;
            }
        }
        res.status(201).json({
            ...mapVendorAssetForApi(inserted),
            points_deducted: (!isAdmin && pointsRequired > 0) ? pointsRequired : 0,
            balance_after: balanceAfter,
            product_optimized: wantsOptimize,
            gallery_migration_required: galleryMigrationRequired,
            prototype_meta_migration_required: prototypeMetaMigrationRequired
        });
    } catch (e) {
        console.error('POST /api/me/vendor-assets 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/me/vendor-assets/:id/gallery-images — 數位原型新增多角度圖（不另扣點、不跑 AI）
app.post('/api/me/vendor-assets/:id/gallery-images', upload.array('images', PROTOTYPE_GALLERY_MAX_EXTRA), async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        const seedUser = await getRequestUserFromAuthHeader(req);
        if (!seedUser) return res.status(401).json({ error: '請先登入' });
        if (await rejectSeedVendorSelfServiceWrite(seedUser.id, manufacturerId, res)) return;
        const id = (req.params.id || '').trim();
        const { data: row, error: rowErr } = await fetchVendorAssetOwnedByManufacturer(
            id, manufacturerId, 'id, image_url, gallery_images, asset_kind'
        );
        if (rowErr) return res.status(500).json({ error: '查詢失敗' });
        if (!row) return res.status(404).json({ error: '找不到該素材' });
        if (normalizeVendorAssetKind(row.asset_kind) !== 'prototype') {
            return res.status(400).json({ error: '僅數位原型可新增多角度圖' });
        }
        const files = (req.files && req.files.length) ? req.files : [];
        if (!files.length) return res.status(400).json({ error: '請上傳至少一張圖片' });
        const existing = parseGalleryImages(row.gallery_images);
        const totalNow = getVendorAssetAllImageUrls(row).length;
        const room = PROTOTYPE_GALLERY_MAX_EXTRA + 1 - totalNow;
        if (room <= 0) {
            return res.status(400).json({ error: '已達多角度圖上限（封面＋' + PROTOTYPE_GALLERY_MAX_EXTRA + ' 張）' });
        }
        const toAdd = files.slice(0, room);
        const startSort = existing.length ? Math.max.apply(null, existing.map(function (g) { return g.sort_order; })) + 1 : 1;
        const newEntries = await uploadVendorAssetGalleryFiles(manufacturerId, toAdd, startSort);
        const merged = existing.concat(newEntries);
        const { data: updated, error } = await supabase.from('vendor_assets')
            .update({ gallery_images: merged, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('manufacturer_id', manufacturerId)
            .select('id, manufacturer_id, category_key, subcategory_key, title, description, image_url, gallery_images, usage_type, sort_order, asset_kind, part_key, ai_tags, image_semantics_json, tags_source, created_at, updated_at')
            .single();
        if (error) {
            if (error.code === '42703') {
                return res.status(500).json({ error: '請先執行 docs/add-vendor-asset-gallery-images.sql 新增多角度圖欄位' });
            }
            return res.status(500).json({ error: '更新失敗' });
        }
        res.json(mapVendorAssetForApi(updated));
    } catch (e) {
        console.error('POST /api/me/vendor-assets/:id/gallery-images:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/me/vendor-assets/:id/gallery-images — 刪除某一張多角度圖或封面（body.url 必填）
app.delete('/api/me/vendor-assets/:id/gallery-images', express.json(), async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        const seedUser = await getRequestUserFromAuthHeader(req);
        if (!seedUser) return res.status(401).json({ error: '請先登入' });
        if (await rejectSeedVendorSelfServiceWrite(seedUser.id, manufacturerId, res)) return;
        const id = (req.params.id || '').trim();
        const targetUrl = String((req.body && req.body.url) || '').trim();
        if (!targetUrl) return res.status(400).json({ error: '請提供 url' });
        const { data: row, error: rowErr } = await fetchVendorAssetOwnedByManufacturer(
            id, manufacturerId, 'id, image_url, gallery_images, asset_kind'
        );
        if (rowErr) return res.status(500).json({ error: '查詢失敗' });
        if (!row) return res.status(404).json({ error: '找不到該素材' });
        if (normalizeVendorAssetKind(row.asset_kind) !== 'prototype') {
            return res.status(400).json({ error: '僅數位原型可管理多角度圖' });
        }
        let cover = String(row.image_url || '').trim();
        let gallery = parseGalleryImages(row.gallery_images).filter(function (g) { return g.url !== targetUrl; });
        if (targetUrl === cover) {
            if (!gallery.length) {
                return res.status(400).json({ error: '至少需保留一張圖片，請改為上傳新封面或刪除整筆素材' });
            }
            cover = gallery[0].url;
            gallery = gallery.slice(1).map(function (g, i) { return { url: g.url, sort_order: i + 1 }; });
        }
        const { data: updated, error } = await supabase.from('vendor_assets')
            .update({ image_url: cover, gallery_images: gallery, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('manufacturer_id', manufacturerId)
            .select('id, manufacturer_id, category_key, subcategory_key, title, description, image_url, gallery_images, usage_type, sort_order, asset_kind, part_key, ai_tags, image_semantics_json, tags_source, created_at, updated_at')
            .single();
        if (error) {
            if (error.code === '42703') {
                return res.status(500).json({ error: '請先執行 docs/add-vendor-asset-gallery-images.sql' });
            }
            return res.status(500).json({ error: '更新失敗' });
        }
        res.json(mapVendorAssetForApi(updated));
    } catch (e) {
        console.error('DELETE /api/me/vendor-assets/:id/gallery-images:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/me/vendor-assets/:id — 上架／下架等輕量更新（僅本人廠商；種子廠商不得操作）
app.patch('/api/me/vendor-assets/:id', express.json(), async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        const seedUser = await getRequestUserFromAuthHeader(req);
        if (!seedUser) return res.status(401).json({ error: '請先登入' });
        if (await rejectSeedVendorSelfServiceWrite(seedUser.id, manufacturerId, res)) return;
        const id = (req.params.id || '').trim();
        const body = req.body || {};
        const updates = { updated_at: new Date().toISOString() };
        if (body.is_public !== undefined) updates.is_public = !!parseTruthyBody(body.is_public);
        if (Object.keys(updates).length <= 1) return res.status(400).json({ error: '無可更新的欄位' });
        const { data: updated, error } = await supabase
            .from('vendor_assets')
            .update(updates)
            .eq('id', id)
            .eq('manufacturer_id', manufacturerId)
            .select(VENDOR_ASSET_SELECT_ME)
            .single();
        if (error) {
            console.error('PATCH /api/me/vendor-assets/:id:', error);
            return res.status(500).json({ error: error.message || '更新失敗' });
        }
        if (!updated) return res.status(404).json({ error: '找不到該素材' });
        const lang = resolveVendorAssetApiLang(req);
        res.json(mapVendorAssetForApi(updated, lang));
    } catch (e) {
        console.error('PATCH /api/me/vendor-assets/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PUT /api/me/vendor-assets/:id — 更新廠商素材（僅本人廠商）；種子廠商不得編輯
app.put('/api/me/vendor-assets/:id', upload.single('image'), async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        const seedUser = await getRequestUserFromAuthHeader(req);
        if (!seedUser) return res.status(401).json({ error: '請先登入' });
        if (await rejectSeedVendorSelfServiceWrite(seedUser.id, manufacturerId, res)) return;
        const id = (req.params.id || '').trim();
        const body = req.body || {};
        const { data: row, error: rowErr } = await fetchVendorAssetOwnedByManufacturer(
            id, manufacturerId, 'id, image_url, category_key, title, description, asset_kind, material_key, min_order_quantity, customization_levels'
        );
        if (rowErr) {
            console.error('PUT /api/me/vendor-assets/:id select:', rowErr);
            return res.status(500).json({ error: '查詢失敗' });
        }
        if (!row) return res.status(404).json({ error: '找不到該素材' });

        const updates = { updated_at: new Date().toISOString() };
        if (body.category_key !== undefined) updates.category_key = (String(body.category_key || '').trim()) || row.category_key;
        const assetKindPut = normalizeVendorAssetKind(body.asset_kind !== undefined ? body.asset_kind : row.asset_kind);
        if (body.subcategory_key !== undefined) {
            updates.subcategory_key = assetKindPut === 'material'
                ? null
                : ((body.subcategory_key || '').trim() || null);
        }
        if (body.title !== undefined) updates.title = (body.title || '').trim() || null;
        if (body.description !== undefined) updates.description = (body.description || '').trim() || null;
        if (body.usage_type !== undefined) updates.usage_type = (body.usage_type || 'reference_only').trim() || 'reference_only';
        if (body.sort_order !== undefined) updates.sort_order = (body.sort_order != null && !isNaN(body.sort_order)) ? parseInt(body.sort_order, 10) : 0;
        if (body.is_public !== undefined) updates.is_public = !!parseTruthyBody(body.is_public);
        if (body.style_key !== undefined) updates.style_key = (body.style_key || '').trim() || null;
        if (body.material_key !== undefined) {
            updates.material_key = assetKindPut === 'material' ? null : ((body.material_key || '').trim() || null);
        }
        if (body.asset_kind !== undefined) updates.asset_kind = normalizeVendorAssetKind(body.asset_kind);
        const assetKindForPart = normalizeVendorAssetKind(updates.asset_kind || row.asset_kind);
        if (body.part_key !== undefined && (assetKindForPart === 'prototype' || assetKindForPart === 'part')) {
            updates.part_key = normalizeVendorPartKey(body.part_key, assetKindForPart);
        }
        const assetKind = normalizeVendorAssetKind(updates.asset_kind || row.asset_kind);
        const catalogGroupIdsPut = parseCatalogGroupIdsFromBody(body);
        let materialCatalogHintPut = '';
        if (assetKind === 'material' && catalogGroupIdsPut.length) {
            materialCatalogHintPut = await vendorCatalogGroupNamesByIds(manufacturerId, catalogGroupIdsPut);
        }
        if (assetKind === 'prototype') {
            const moqIn = body.min_order_quantity !== undefined ? body.min_order_quantity : row.min_order_quantity;
            const moqParsed = parseVendorAssetPrototypeMoq(moqIn, { required: true });
            if (moqParsed.error) return res.status(400).json({ error: moqParsed.error });
            updates.min_order_quantity = moqParsed.value;
            let levels;
            if (body.customization_levels !== undefined) {
                const clValid = validatePrototypeCustomizationLevels(body.customization_levels);
                if (clValid.error) return res.status(400).json({ error: clValid.error });
                levels = clValid.levels;
            } else {
                levels = sanitizeCustomizationLevelsForStorage(row.customization_levels);
            }
            if (!levels.length) return res.status(400).json({ error: '請至少選擇一項訂製程度' });
            updates.customization_levels = levels;
        }

        let file = req.file ? await vendorAssetFileFromMulter(req.file) : null;
        const wantsOptimize = parseTruthyBody(body.optimize_product_image);
        const titleForPrompt = updates.title !== undefined ? updates.title : row.title;
        const categoryKeyForTags = updates.category_key || row.category_key;
        let balanceAfter = null;
        let pointsDeducted = 0;

        if (file) {
            const pointsRequired = wantsOptimize
                ? await getPointsVendorAssetOptimizeForKind(assetKind)
                : await getPointsVendorAssetUpload();

            const authHeader = req.headers.authorization || req.headers['x-auth-token'];
            const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
            let ownerId = null;
            if (token) {
                const { data: { user } } = await supabase.auth.getUser(token);
                ownerId = user?.id || null;
            }
            let isAdmin = false;
            if (ownerId) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', ownerId).maybeSingle();
                isAdmin = profile?.role === 'admin';
            }
            if (!isAdmin && ownerId && pointsRequired > 0) {
                const { balance, sufficient } = await checkUserCreditsBalance(ownerId, pointsRequired);
                if (!sufficient) {
                    return res.status(402).json({ error: '點數不足', balance, required: pointsRequired });
                }
            }

            let tags = parseAiTagsFromBody(body);
            let semanticsJson = null;
            if (body.image_semantics_json) {
                try {
                    semanticsJson = typeof body.image_semantics_json === 'string'
                        ? JSON.parse(body.image_semantics_json)
                        : body.image_semantics_json;
                } catch (_) {}
            }
            if (!tags || !tags.length) {
                try {
                    const sem = await runVendorAssetImageSemantics(file, {
                        asset_kind: assetKind,
                        category_key: categoryKeyForTags,
                        title: titleForPrompt,
                        description: updates.description !== undefined ? updates.description : row.description,
                        material_catalog_hint: materialCatalogHintPut || undefined
                    }, ownerId);
                    tags = sem.tags;
                    semanticsJson = sem.semantics;
                } catch (semErr) {
                    console.error('PUT vendor-assets semantics:', semErr);
                    return res.status(503).json({ error: semErr.message || 'AI 標籤產生失敗，請稍後重試' });
                }
            } else if (assetKind === 'material' && semanticsJson) {
                const finPut = finalizeVendorAssetSemantics(semanticsJson, tags, assetKind);
                semanticsJson = finPut.semantics;
                tags = finPut.tags;
            }
            if (!titleForPrompt && semanticsJson && (assetKind === 'material' || assetKind === 'prototype')) {
                const uiLocalePut = resolveUiLocaleFromRequest(req);
                let subcategoryNamePut = null;
                const subKeyPut = updates.subcategory_key !== undefined ? updates.subcategory_key : row.subcategory_key;
                if (assetKind === 'prototype' && subKeyPut) {
                    subcategoryNamePut = await lookupAiSubcategoryName(categoryKeyForTags, subKeyPut);
                }
                let materialHintPut = '';
                if (assetKind === 'material' && catalogGroupIdsPut.length) {
                    materialHintPut = await vendorCatalogGroupNamesByIds(manufacturerId, catalogGroupIdsPut);
                }
                const autoTitle = autoVendorAssetTitleFromSemantics(semanticsJson, assetKind, uiLocalePut, {
                    subcategoryName: subcategoryNamePut,
                    materialCatalogHint: materialHintPut
                });
                if (autoTitle) {
                    titleForPrompt = autoTitle;
                    updates.title = autoTitle;
                }
            }
            updates.ai_tags = tags;
            updates.ai_tags_generated_at = new Date().toISOString();
            updates.tags_source = semanticsJson ? 'gemini' : (parseAiTagsFromBody(body) ? 'manual' : 'gemini');
            if (semanticsJson) updates.image_semantics_json = semanticsJson;
            const bodyDesc = (body.description || '').trim();
            if (!bodyDesc && semanticsJson) {
                const autoDesc = vendorAssetDescriptionFromSemantics(semanticsJson);
                if (autoDesc) updates.description = autoDesc;
            }

            let uploadFile = file;
            if (wantsOptimize) {
                try {
                    const optimizeBackground = (body.optimize_background || body.background_color || '').trim() || 'white';
                    const optimizedBuf = await optimizeVendorAssetImageWithFlux(
                        file.buffer, file.mimetype, titleForPrompt, assetKind,
                        assetKind === 'material' ? materialCatalogHintPut : ((updates.material_key != null ? updates.material_key : row.material_key) || ''),
                        optimizeBackground
                    );
                    uploadFile = {
                        buffer: optimizedBuf,
                        mimetype: 'image/jpeg',
                        originalname: (file.originalname || 'image.jpg').replace(/\.[^.]+$/, '') + '.jpg'
                    };
                } catch (optErr) {
                    console.error('PUT vendor-assets image optimize:', optErr);
                    const mapped = vendorAssetOptimizeErrorResponse(optErr, assetKind);
                    return res.status(mapped.status).json(mapped.body);
                }
            }

            const { publicUrl } = await uploadToSupabaseStorage('custom-products', `vendor-assets/${manufacturerId}`, uploadFile);
            updates.image_url = publicUrl;

            if (!isAdmin && ownerId && pointsRequired > 0) {
                const consumed = await consumeUserCredits(
                    ownerId,
                    pointsRequired,
                    wantsOptimize ? 'vendor_asset_optimize' : 'vendor_asset_upload',
                    wantsOptimize
                        ? (assetKind === 'material'
                            ? `材料參考更新圖＋材質圖優化（${pointsRequired} 點）`
                            : `數位原型更新圖＋產品圖優化（${pointsRequired} 點）`)
                        : (assetKind === 'material'
                            ? `材料參考更新圖（${pointsRequired} 點）`
                            : `數位原型更新圖（${pointsRequired} 點）`),
                    { manufacturer_id: manufacturerId, vendor_asset_id: id, optimize: wantsOptimize, asset_kind: assetKind }
                );
                if (consumed.ok) {
                    balanceAfter = consumed.balance_after;
                    pointsDeducted = pointsRequired;
                }
            }
        } else if (body.ai_tags !== undefined) {
            const tags = parseAiTagsFromBody(body);
            updates.ai_tags = tags || [];
            updates.tags_source = 'manual';
            if (body.image_semantics_json) {
                try {
                    updates.image_semantics_json = typeof body.image_semantics_json === 'string'
                        ? JSON.parse(body.image_semantics_json)
                        : body.image_semantics_json;
                } catch (_) {}
            }
        }

        const putSelectCols = 'id, manufacturer_id, category_key, subcategory_key, title, description, image_url, gallery_images, usage_type, sort_order, style_key, material_key, asset_kind, ai_tags, min_order_quantity, customization_levels, updated_at';
        let { data: updated, error } = await supabase.from('vendor_assets').update(updates).eq('id', id).eq('manufacturer_id', manufacturerId).select(putSelectCols).single();
        if (error && error.code === '42703' && (
            String(error.message || '').includes('min_order_quantity') ||
            String(error.message || '').includes('customization_levels')
        )) {
            return res.status(500).json({ error: '請先執行 docs/add-vendor-asset-prototype-moq-customization.sql' });
        }
        if (error) {
            console.error('PUT /api/me/vendor-assets/:id 失敗:', error);
            return res.status(500).json({ error: '更新失敗' });
        }
        if (body.catalog_group_ids !== undefined || body.catalog_group_id) {
            await setVendorAssetCatalogGroups(id, manufacturerId, parseCatalogGroupIdsFromBody(body));
        }
        res.json({
            ...mapVendorAssetForApi(updated),
            points_deducted: pointsDeducted,
            balance_after: balanceAfter,
            product_optimized: file ? wantsOptimize : false
        });
    } catch (e) {
        console.error('PUT /api/me/vendor-assets/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/me/vendor-assets/:id — 刪除廠商素材（僅本人廠商）；種子廠商不得刪除
app.delete('/api/me/vendor-assets/:id', async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        const seedUser = await getRequestUserFromAuthHeader(req);
        if (!seedUser) return res.status(401).json({ error: '請先登入' });
        if (await rejectSeedVendorSelfServiceWrite(seedUser.id, manufacturerId, res)) return;
        const id = (req.params.id || '').trim();
        const { data: row, error: rowErr } = await fetchVendorAssetOwnedByManufacturer(id, manufacturerId, 'id, source_catalog_item_id');
        if (rowErr) {
            console.error('DELETE /api/me/vendor-assets/:id select:', rowErr);
            return res.status(500).json({ error: '查詢失敗' });
        }
        if (!row) return res.status(404).json({ error: '找不到該素材' });
        if (row.source_catalog_item_id && (await supplierCatalogTablesReady())) {
            await supabase.from('manufacturer_supplier_imports').delete()
                .eq('manufacturer_id', manufacturerId)
                .eq('catalog_item_id', row.source_catalog_item_id);
        }
        const { error } = await supabase.from('vendor_assets').delete().eq('id', id);
        if (error) {
            console.error('DELETE /api/me/vendor-assets/:id 失敗:', error);
            return res.status(500).json({ error: '刪除失敗' });
        }
        res.status(204).send();
    } catch (e) {
        console.error('DELETE /api/me/vendor-assets/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ---------- 產業供應商目錄（B 線：製造商導入材料）----------
// GET /api/me/capabilities — 頁面/API 資格（勿用 nav.* 隱藏選單；見 docs/account-one-login-capabilities.md）
app.get('/api/me/capabilities', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || req.headers['x-auth-token'];
        const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        syncMembershipCatalogVisibility(user.id).catch((syncErr) => {
            console.warn('syncMembershipCatalogVisibility:', syncErr && syncErr.message);
        });

        const [mfrRes, staffBypassPortfolio, catalogReady] = await Promise.all([
            supabase.from('manufacturers').select('id, vendor_source, is_active').eq('user_id', user.id).maybeSingle(),
            isStaffProfileUserId(user.id),
            supplierCatalogTablesReady()
        ]);
        const mfr = mfrRes.data;
        const hasManufacturer = !!mfr;
        let activePortfolioCount = 0;
        if (mfr && mfr.is_active !== false) {
            if (staffBypassPortfolio) activePortfolioCount = 1;
            else activePortfolioCount = (await hasEnabledPortfolioWork(mfr.id)) ? 1 : 0;
        }
        const isSeed = mfr && mfr.vendor_source === 'seed';
        // 廠商資格：至少 1 件啟用中作品（種子亦同，供平台維護期匯入材料）
        const isQualifiedManufacturer = !!mfr && mfr.is_active !== false
            && (activePortfolioCount >= 1 || staffBypassPortfolio);
        const canImport = catalogReady && isQualifiedManufacturer;
        const canUploadProductsAndAssets = await canUploadProductsAndAssetsUserId(user.id);
        let isIndustrySupplier = false;
        let industrySupplierId = null;
        if (catalogReady) {
            try {
                const { data: indRow } = await supabase
                    .from('industry_suppliers')
                    .select('id')
                    .eq('user_id', user.id)
                    .maybeSingle();
                isIndustrySupplier = !!indRow;
                industrySupplierId = indRow ? indRow.id : null;
            } catch (_) { /* 表未建時忽略 */ }
        }
        res.json({
            has_manufacturer: hasManufacturer,
            is_industry_supplier: isIndustrySupplier,
            industry_supplier_id: industrySupplierId,
            is_qualified_manufacturer: isQualifiedManufacturer,
            manufacturer_id: mfr ? mfr.id : null,
            active_portfolio_count: activePortfolioCount,
            portfolio_count: activePortfolioCount,
            bypass_supplier_portfolio_gate: staffBypassPortfolio,
            vendor_source: mfr ? mfr.vendor_source : null,
            is_seed_vendor: !!isSeed,
            seed_vendor_self_service_locked: false,
            supplier_catalog_ready: catalogReady,
            can_upload_products_and_assets: canUploadProductsAndAssets,
            can_use_supplier_catalog: canImport,
            can_import_supplier_catalog: canImport,
            can_manage_supplier_catalog: catalogReady && isIndustrySupplier,
            zones: {
                design: true,
                manufacturer: isQualifiedManufacturer || (hasManufacturer && staffBypassPortfolio),
                industry_supplier: isIndustrySupplier
            },
            nav: {
                show_all_workspace_menus: true
            }
        });
    } catch (e) {
        console.error('GET /api/me/capabilities:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/me/industry-suppliers — 產業供應商目錄（製造商瀏覽，需作品門檻）
app.get('/api/me/industry-suppliers', async (req, res) => {
    try {
        if (!(await supplierCatalogTablesReady())) {
            return res.json({ items: [], message: '請先執行 docs/add-industry-supplier-catalog.sql' });
        }
        const manufacturerId = await getMeManufacturerB2BAccess(req, res);
        if (!manufacturerId) return;
        const { data: suppliers, error: supErr } = await supabase
            .from('industry_suppliers')
            .select('id, name, description, contact_json, is_active')
            .eq('is_active', true)
            .order('name', { ascending: true });
        if (supErr) {
            if (supErr.code === '42P01') return res.json({ items: [] });
            console.error('GET industry-suppliers:', supErr);
            return res.status(500).json({ error: '查詢失敗' });
        }
        const ids = (suppliers || []).map((s) => s.id);
        const countsBySupplier = {};
        const previewBySupplier = {};
        if (ids.length) {
            const { data: catRows } = await supabase
                .from('supplier_catalog_items')
                .select('industry_supplier_id, cover_image_url, sort_order')
                .in('industry_supplier_id', ids)
                .eq('is_active', true)
                .order('sort_order', { ascending: true })
                .limit(500);
            (catRows || []).forEach((row) => {
                countsBySupplier[row.industry_supplier_id] = (countsBySupplier[row.industry_supplier_id] || 0) + 1;
                if (!previewBySupplier[row.industry_supplier_id] && row.cover_image_url) {
                    previewBySupplier[row.industry_supplier_id] = row.cover_image_url;
                }
            });
        }
        const items = (suppliers || []).map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            contact_json: s.contact_json,
            catalog_item_count: countsBySupplier[s.id] || 0,
            preview_image_url: previewBySupplier[s.id] || null
        }));
        res.json({ items });
    } catch (e) {
        console.error('GET /api/me/industry-suppliers:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/me/supplier-catalog-items — 可導入的產業供應商目錄（材料）
app.get('/api/me/supplier-catalog-items', async (req, res) => {
    try {
        if (!(await supplierCatalogTablesReady())) {
            return res.json({ items: [], message: '請先執行 docs/add-industry-supplier-catalog.sql' });
        }
        const manufacturerId = await getMeManufacturerB2BAccess(req, res);
        if (!manufacturerId) return;
        const itemKind = (req.query.item_kind || 'material').trim();
        if (itemKind !== 'material' && itemKind !== 'prototype_set' && itemKind !== 'part') {
            return res.status(400).json({ error: 'item_kind 須為 material、prototype_set 或 part' });
        }
        const supplierId = (req.query.supplier_id || '').trim();
        let catQ = supabase
            .from('supplier_catalog_items')
            .select('id, industry_supplier_id, item_kind, title, description, cover_image_url, spec_json, category_key, sort_order, industry_suppliers(id, name, description, contact_json)')
            .eq('item_kind', itemKind)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (supplierId) catQ = catQ.eq('industry_supplier_id', supplierId);
        const catalogPromise = catQ;
        const importsPromise = supabase
            .from('manufacturer_supplier_imports')
            .select('catalog_item_id')
            .eq('manufacturer_id', manufacturerId)
            .eq('item_kind', itemKind);
        const supplierMetaPromise = supplierId
            ? supabase.from('industry_suppliers').select('id, name, description').eq('id', supplierId).eq('is_active', true).maybeSingle()
            : Promise.resolve({ data: null, error: null });
        const [catRes, impRes, supMetaRes] = await Promise.all([catalogPromise, importsPromise, supplierMetaPromise]);
        const { data: catalogRows, error: catErr } = catRes;
        if (catErr) {
            if (catErr.code === '42P01') return res.json({ items: [] });
            console.error('GET supplier-catalog-items:', catErr);
            return res.status(500).json({ error: '查詢失敗' });
        }
        const { data: imported } = impRes;
        const importedSet = new Set((imported || []).map((r) => r.catalog_item_id));
        const items = (catalogRows || []).map((row) => {
            const sup = row.industry_suppliers;
            const supplier = Array.isArray(sup) ? sup[0] : sup;
            return {
                id: row.id,
                item_kind: row.item_kind,
                title: row.title,
                description: row.description,
                cover_image_url: row.cover_image_url,
                spec_json: row.spec_json,
                category_key: row.category_key,
                supplier_id: row.industry_supplier_id,
                supplier_name: supplier ? supplier.name : null,
                supplier_contact: supplier ? supplier.contact_json : null,
                already_imported: importedSet.has(row.id)
            };
        });
        const supplierHeader = supMetaRes.data
            ? { id: supMetaRes.data.id, name: supMetaRes.data.name, description: supMetaRes.data.description }
            : null;
        res.json({ items, supplier: supplierHeader });
    } catch (e) {
        console.error('GET /api/me/supplier-catalog-items 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/me/supplier-catalog-imports — 導入供應商材料至「材料參考」(vendor_assets)
app.post('/api/me/supplier-catalog-imports', express.json(), async (req, res) => {
    try {
        if (!(await supplierCatalogTablesReady())) {
            return res.status(503).json({ error: '請先執行 docs/add-industry-supplier-catalog.sql 建立產業供應商目錄' });
        }
        const manufacturerId = await getMeManufacturerB2BAccess(req, res);
        if (!manufacturerId) return;
        const catalogItemId = (req.body && req.body.catalog_item_id || '').trim();
        if (!catalogItemId) return res.status(400).json({ error: '請提供 catalog_item_id' });
        const importTitle = parseTruthyBody(req.body && req.body.import_title);
        const importDescription = parseTruthyBody(req.body && req.body.import_description);

        const { data: existingImp } = await supabase
            .from('manufacturer_supplier_imports')
            .select('id, vendor_asset_id')
            .eq('manufacturer_id', manufacturerId)
            .eq('catalog_item_id', catalogItemId)
            .maybeSingle();
        if (existingImp) {
            return res.status(409).json({
                error: '此品項已匯入',
                code: 'ALREADY_IMPORTED',
                import_id: existingImp.id,
                vendor_asset_id: existingImp.vendor_asset_id
            });
        }

        const { data: catalogItem, error: itemErr } = await supabase
            .from('supplier_catalog_items')
            .select('id, item_kind, title, description, cover_image_url, spec_json, category_key, ai_tags, image_semantics_json, tags_source, industry_supplier_id, industry_suppliers(id, name, contact_json)')
            .eq('id', catalogItemId)
            .eq('is_active', true)
            .single();
        if (itemErr || !catalogItem) return res.status(404).json({ error: '找不到該目錄品項' });
        if (catalogItem.item_kind !== 'material' && catalogItem.item_kind !== 'prototype_set' && catalogItem.item_kind !== 'part') {
            return res.status(400).json({ error: '不支援的品項類型' });
        }
        if (!catalogItem.cover_image_url) {
            return res.status(400).json({ error: '此品項尚無參考圖，無法導入' });
        }

        const sup = catalogItem.industry_suppliers;
        const supplier = Array.isArray(sup) ? sup[0] : sup;
        const spec = catalogItem.spec_json && typeof catalogItem.spec_json === 'object' ? catalogItem.spec_json : {};
        const categoryKey = (catalogItem.category_key || '').trim() || 'other';
        const targetKind = catalogItem.item_kind === 'prototype_set'
            ? 'prototype'
            : (catalogItem.item_kind === 'part' ? 'part' : 'material');

        const insertPayload = {
            manufacturer_id: manufacturerId,
            category_key: categoryKey,
            title: importTitle ? String(catalogItem.title || '').trim() : '',
            description: importDescription ? (catalogItem.description || null) : null,
            image_url: catalogItem.cover_image_url,
            usage_type: 'reference_only',
            is_public: true,
            sort_order: 0,
            asset_kind: targetKind,
            source_catalog_item_id: catalogItem.id,
            tags_source: 'import'
        };
        if (Array.isArray(catalogItem.ai_tags) && catalogItem.ai_tags.length) {
            insertPayload.ai_tags = catalogItem.ai_tags;
            insertPayload.ai_tags_generated_at = new Date().toISOString();
        }
        if (catalogItem.image_semantics_json) {
            insertPayload.image_semantics_json = catalogItem.image_semantics_json;
        }
        if (targetKind === 'prototype' || targetKind === 'part') {
            insertPayload.min_order_quantity = 1;
            insertPayload.customization_levels = ['color_material'];
        }

        let inserted;
        let insErr;
        ({ data: inserted, error: insErr } = await supabase
            .from('vendor_assets')
            .insert(insertPayload)
            .select('id, manufacturer_id, category_key, title, description, image_url, asset_kind, source_catalog_item_id, material_key, created_at')
            .single());
        if (insErr && insErr.code === '42703') {
            const fallback = { ...insertPayload };
            delete fallback.asset_kind;
            delete fallback.source_catalog_item_id;
            ({ data: inserted, error: insErr } = await supabase
                .from('vendor_assets')
                .insert(fallback)
                .select('id, manufacturer_id, category_key, title, description, image_url, material_key, created_at')
                .single());
        }
        if (insErr || !inserted) {
            console.error('import vendor_asset:', insErr);
            return res.status(500).json({ error: insErr && insErr.message ? insErr.message : '建立材料參考失敗' });
        }

        const snapshot = {
            supplier_id: catalogItem.industry_supplier_id,
            supplier_name: supplier ? supplier.name : null,
            supplier_contact: supplier ? supplier.contact_json : null,
            catalog_item_id: catalogItem.id,
            title: catalogItem.title,
            description: catalogItem.description,
            cover_image_url: catalogItem.cover_image_url,
            spec_json: spec
        };
        const { data: impRow, error: impErr } = await supabase
            .from('manufacturer_supplier_imports')
            .insert({
                manufacturer_id: manufacturerId,
                catalog_item_id: catalogItem.id,
                item_kind: catalogItem.item_kind,
                vendor_asset_id: inserted.id,
                snapshot_json: snapshot
            })
            .select('id, imported_at')
            .single();
        if (impErr) {
            await supabase.from('vendor_assets').delete().eq('id', inserted.id);
            console.error('import record:', impErr);
            return res.status(500).json({ error: '寫入導入紀錄失敗' });
        }

        res.status(201).json({
            import: impRow,
            vendor_asset: { ...inserted, asset_kind: targetKind, supplier_name: snapshot.supplier_name, from_supplier_catalog: true }
        });
    } catch (e) {
        console.error('POST /api/me/supplier-catalog-imports 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

function normalizeSupplierImportItemKind(raw) {
    const k = String(raw || '').trim().toLowerCase();
    if (k === 'prototype_set' || k === 'prototype') return 'prototype_set';
    if (k === 'part') return 'part';
    return 'material';
}

/** 製造商已匯入的供應商品項（import 表為主；缺紀錄時從 vendor_assets.source_catalog_item_id 補齊） */
async function listSupplierCatalogImportsForManufacturer(manufacturerId) {
    const byCatalogId = new Map();
    const ready = await supplierCatalogTablesReady();
    if (ready) {
        const { data: rows, error } = await supabase
            .from('manufacturer_supplier_imports')
            .select('id, catalog_item_id, item_kind, vendor_asset_id, imported_at, snapshot_json')
            .eq('manufacturer_id', manufacturerId)
            .order('imported_at', { ascending: false });
        if (error && error.code !== '42P01') console.error('listSupplierCatalogImports imports:', error);
        (rows || []).forEach((row) => {
            if (!row.catalog_item_id) return;
            const snap = row.snapshot_json && typeof row.snapshot_json === 'object' ? row.snapshot_json : {};
            byCatalogId.set(row.catalog_item_id, {
                id: row.id,
                catalog_item_id: row.catalog_item_id,
                item_kind: normalizeSupplierImportItemKind(row.item_kind),
                vendor_asset_id: row.vendor_asset_id,
                imported_at: row.imported_at,
                supplier_name: snap.supplier_name || null,
                catalog_title: snap.title || null,
                cover_image_url: snap.cover_image_url || null
            });
        });
    }
    let assets = [];
    let assetRes = await supabase
        .from('vendor_assets')
        .select('id, source_catalog_item_id, asset_kind, title, image_url, created_at')
        .eq('manufacturer_id', manufacturerId)
        .not('source_catalog_item_id', 'is', null)
        .order('created_at', { ascending: false });
    if (assetRes.error && assetRes.error.code === '42703') {
        assetRes = await supabase
            .from('vendor_assets')
            .select('id, asset_kind, title, image_url, created_at')
            .eq('manufacturer_id', manufacturerId)
            .order('created_at', { ascending: false });
    }
    assets = assetRes.data || [];
    const orphanCatalogIds = [];
    assets.forEach((a) => {
        const cid = a.source_catalog_item_id;
        if (!cid || byCatalogId.has(cid)) return;
        orphanCatalogIds.push(cid);
        byCatalogId.set(cid, {
            id: 'asset-' + a.id,
            catalog_item_id: cid,
            item_kind: normalizeSupplierImportItemKind(
                a.asset_kind === 'prototype' ? 'prototype_set' : a.asset_kind
            ),
            vendor_asset_id: a.id,
            imported_at: a.created_at,
            supplier_name: null,
            catalog_title: a.title || null,
            cover_image_url: a.image_url || null
        });
    });
    if (orphanCatalogIds.length && ready) {
        const { data: cats } = await supabase
            .from('supplier_catalog_items')
            .select('id, title, cover_image_url, item_kind, industry_suppliers(name)')
            .in('id', orphanCatalogIds);
        (cats || []).forEach((c) => {
            const row = byCatalogId.get(c.id);
            if (!row) return;
            const sup = c.industry_suppliers;
            const supplier = Array.isArray(sup) ? sup[0] : sup;
            if (!row.catalog_title) row.catalog_title = c.title;
            if (!row.cover_image_url) row.cover_image_url = c.cover_image_url;
            row.item_kind = normalizeSupplierImportItemKind(c.item_kind || row.item_kind);
            if (!row.supplier_name && supplier) row.supplier_name = supplier.name;
        });
    }
    return Array.from(byCatalogId.values()).sort((a, b) => {
        const ta = a.imported_at ? new Date(a.imported_at).getTime() : 0;
        const tb = b.imported_at ? new Date(b.imported_at).getTime() : 0;
        return tb - ta;
    });
}

// GET /api/me/supplier-catalog-imports — 製造商：我引用的供應商數位產品庫清單
app.get('/api/me/supplier-catalog-imports', async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        const itemKind = (req.query.item_kind || '').trim();
        const allItems = await listSupplierCatalogImportsForManufacturer(manufacturerId);
        const counts = { all: allItems.length, material: 0, prototype_set: 0, part: 0 };
        allItems.forEach((row) => {
            if (row.item_kind === 'material') counts.material += 1;
            else if (row.item_kind === 'prototype_set') counts.prototype_set += 1;
            else if (row.item_kind === 'part') counts.part += 1;
        });
        let items = allItems;
        if (itemKind === 'material' || itemKind === 'prototype_set' || itemKind === 'part') {
            const want = normalizeSupplierImportItemKind(itemKind);
            items = allItems.filter((row) => row.item_kind === want);
        }
        res.json({ items, counts });
    } catch (e) {
        console.error('GET /api/me/supplier-catalog-imports:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

function normalizeSupplierCatalogItemKind(raw) {
    const k = String(raw || 'material').trim().toLowerCase();
    if (k === 'prototype_set' || k === 'prototype') return 'prototype_set';
    if (k === 'part') return 'part';
    return 'material';
}

function parseSupplierCatalogSpecJson(itemKind, body) {
    let specJson = body && body.spec_json;
    if (specJson && typeof specJson === 'string') {
        try { specJson = JSON.parse(specJson); } catch (_) { specJson = {}; }
    }
    if (!specJson || typeof specJson !== 'object') specJson = {};
    const pickStr = (key) => {
        if (!body || body[key] == null) return;
        const v = String(body[key]).trim();
        if (v) specJson[key] = v;
    };
    if (itemKind === 'material') {
        pickStr('material_type');
        pickStr('color');
        pickStr('composition');
        pickStr('finish');
        if (body && body.width_cm != null && String(body.width_cm).trim() !== '') {
            const w = parseInt(body.width_cm, 10);
            specJson.width_cm = Number.isFinite(w) ? w : String(body.width_cm).trim();
        }
    } else if (itemKind === 'prototype_set') {
        pickStr('style');
        pickStr('fit');
        pickStr('moq_hint');
        pickStr('customization_notes');
        if (body && body.subcategory_key) specJson.subcategory_key = String(body.subcategory_key).trim();
    } else if (itemKind === 'part') {
        pickStr('part_type');
        pickStr('finish');
        pickStr('material');
        pickStr('dimensions');
    }
    return specJson;
}

function supplierCatalogItemKindToAssetKind(itemKind) {
    const k = normalizeSupplierCatalogItemKind(itemKind);
    if (k === 'material') return 'material';
    if (k === 'part') return 'part';
    return 'prototype';
}

const SUPPLIER_CATALOG_ITEM_SELECT =
    'id, item_kind, title, description, cover_image_url, spec_json, category_key, is_active, sort_order, ai_tags, image_semantics_json, tags_source, created_at, updated_at';

async function getAuthOwnerIdFromReq(req) {
    const authHeader = req.headers.authorization || req.headers['x-auth-token'];
    const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
    if (!token) return null;
    const { data: { user } } = await supabase.auth.getUser(token);
    return user?.id || null;
}

async function isProfileAdminUser(ownerId) {
    if (!ownerId) return false;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', ownerId).maybeSingle();
    return profile?.role === 'admin';
}

/** 供應商上架：語意標籤、可選 AI 重繪、點數預檢（與 vendor-assets 相同邏輯） */
async function processSupplierCatalogImagePipeline({
    file,
    body,
    itemKind,
    title,
    description,
    categoryKey,
    ownerId,
    uiLocale
}) {
    const assetKind = supplierCatalogItemKindToAssetKind(itemKind);
    const wantsOptimize = parseTruthyBody(body.optimize_product_image);
    const pointsRequired = wantsOptimize
        ? await getPointsVendorAssetOptimizeForKind(assetKind)
        : await getPointsVendorAssetUpload();
    const isAdmin = await isProfileAdminUser(ownerId);
    if (!isAdmin && ownerId && pointsRequired > 0) {
        const { balance, sufficient } = await checkUserCreditsBalance(ownerId, pointsRequired);
        if (!sufficient) {
            return { error: '點數不足', status: 402, balance, required: pointsRequired };
        }
    }

    let tags = parseAiTagsFromBody(body);
    let semanticsJson = null;
    let tagsSource = 'gemini';
    if (body.image_semantics_json) {
        try {
            semanticsJson = typeof body.image_semantics_json === 'string'
                ? JSON.parse(body.image_semantics_json)
                : body.image_semantics_json;
        } catch (_) {}
    }
    let desc = (description || '').trim() || null;
    let tit = (title || '').trim() || null;

    if (!tags || !tags.length) {
        const sem = await runVendorAssetImageSemantics(file, {
            asset_kind: assetKind,
            category_key: categoryKey,
            title: tit,
            description: desc
        }, ownerId);
        tags = sem.tags;
        semanticsJson = sem.semantics;
        tagsSource = 'gemini';
        if (!desc && sem.description) desc = sem.description;
    } else {
        tagsSource = semanticsJson ? 'gemini' : 'manual';
        if (!desc && semanticsJson) desc = vendorAssetDescriptionFromSemantics(semanticsJson);
    }
    if (assetKind === 'material' && semanticsJson) {
        const fin = finalizeVendorAssetSemantics(semanticsJson, tags, assetKind);
        semanticsJson = fin.semantics;
        tags = fin.tags;
    }
    if (!tit && semanticsJson) {
        tit = autoVendorAssetTitleFromSemantics(semanticsJson, assetKind, uiLocale, {});
    }

    let uploadFile = file;
    if (wantsOptimize) {
        try {
            const optimizeBackground = (body.optimize_background || body.background_color || '').trim() || 'white';
            const optimizedBuf = await optimizeVendorAssetImageWithFlux(
                file.buffer, file.mimetype, tit, assetKind, null, optimizeBackground
            );
            uploadFile = {
                buffer: optimizedBuf,
                mimetype: 'image/jpeg',
                originalname: (file.originalname || 'image.jpg').replace(/\.[^.]+$/, '') + '.jpg'
            };
        } catch (optErr) {
            console.error('supplier-catalog image optimize:', optErr);
            const mapped = vendorAssetOptimizeErrorResponse(optErr, assetKind);
            return { error: mapped.body.error || 'AI 重繪失敗', status: mapped.status };
        }
    }

    return {
        uploadFile,
        tags,
        semanticsJson,
        tagsSource,
        title: tit,
        description: desc,
        pointsRequired,
        wantsOptimize,
        isAdmin,
        assetKind
    };
}

async function consumeSupplierCatalogUploadPoints(ownerId, isAdmin, pointsRequired, wantsOptimize, assetKind, supplierId, catalogItemId) {
    if (isAdmin || !ownerId || pointsRequired <= 0) return { balance_after: null, points_deducted: 0 };
    const consumed = await consumeUserCredits(
        ownerId,
        pointsRequired,
        wantsOptimize ? 'vendor_asset_optimize' : 'vendor_asset_upload',
        wantsOptimize
            ? (assetKind === 'material'
                ? `供應商產品庫上架＋材質圖優化（${pointsRequired} 點）`
                : `供應商產品庫上架＋產品圖優化（${pointsRequired} 點）`)
            : (assetKind === 'material'
                ? `供應商產品庫上架（${pointsRequired} 點）`
                : `供應商產品庫上架（${pointsRequired} 點）`),
        { industry_supplier_id: supplierId, catalog_item_id: catalogItemId, optimize: wantsOptimize, asset_kind: assetKind }
    );
    if (!consumed.ok) {
        console.warn('supplier-catalog 扣點失敗（已上架）:', consumed.error);
        return { balance_after: null, points_deducted: 0 };
    }
    return { balance_after: consumed.balance_after, points_deducted: pointsRequired };
}

async function resolveSupplierCatalogCoverUrl(supplierId, req, existingUrl) {
    const urlFromBody = (req.body && req.body.cover_image_url || '').trim();
    if (req.file) {
        const file = await vendorAssetFileFromMulter(req.file);
        if (!file) return { error: '圖片格式無效' };
        const { publicUrl } = await uploadToSupabaseStorage('custom-products', `supplier-catalog/${supplierId}`, file);
        return { url: publicUrl };
    }
    if (urlFromBody) return { url: urlFromBody };
    if (existingUrl) return { url: existingUrl };
    return { error: '請上傳產品圖片' };
}

const supplierCatalogItemUpload = upload.single('image');

// POST /api/me/industry-supplier — 登入後建立產業供應商公司（與 POST /api/me/manufacturer 相同，不需跑 bind SQL）
app.post('/api/me/industry-supplier', express.json(), async (req, res) => {
    try {
        if (!(await supplierCatalogTablesReady())) {
            return res.status(503).json({ error: '請先執行 docs/add-industry-supplier-catalog.sql' });
        }
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const { data: existing } = await supabase
            .from('industry_suppliers')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
        if (existing) return res.status(400).json({ error: '您已有產業供應商公司資料，請直接上架產品' });
        const body = req.body || {};
        const name = (body.name || '').trim();
        if (!name) return res.status(400).json({ error: '請填寫公司名稱' });
        const contact_json = body.contact_json || {
            email: (body.email || user.email || '').trim(),
            phone: (body.phone || '').trim(),
            website: (body.website || body.url || '').trim()
        };
        const { data: inserted, error } = await supabase
            .from('industry_suppliers')
            .insert({
                user_id: user.id,
                name,
                description: (body.description || '').trim() || null,
                contact_json,
                is_active: true
            })
            .select('id, name, description, contact_json, is_active')
            .single();
        if (error) {
            if (error.code === '42703') {
                return res.status(503).json({ error: '請先執行 docs/add-membership-catalog-visibility.sql（industry_suppliers.user_id）' });
            }
            console.error('POST /api/me/industry-supplier:', error);
            return res.status(500).json({ error: '建立失敗' });
        }
        res.status(201).json({ supplier: inserted });
    } catch (e) {
        console.error('POST /api/me/industry-supplier 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/me/industry-supplier — 產業供應商控制台摘要
app.get('/api/me/industry-supplier', async (req, res) => {
    try {
        const lite = req.query.manage === '1' || req.query.lite === '1';
        if (!(await supplierCatalogTablesReady())) {
            if (lite) return res.json({ supplier: null, supplier_catalog_ready: false });
            return res.status(503).json({ error: '請先執行 docs/add-industry-supplier-catalog.sql' });
        }
        const ctx = await getMeIndustrySupplier(req, res, { allowMissing: lite });
        if (!ctx) {
            if (lite) return res.json({ supplier: null, code: 'NO_SUPPLIER_PROFILE' });
            return;
        }
        if (lite) return res.json({ supplier: ctx.supplier });
        const { data: catalogRows } = await supabase
            .from('supplier_catalog_items')
            .select('id, is_active')
            .eq('industry_supplier_id', ctx.supplier.id);
        const catalogIds = (catalogRows || []).map((r) => r.id);
        const activeCount = (catalogRows || []).filter((r) => r.is_active).length;
        let referenceCount = 0;
        const manufacturerIds = new Set();
        if (catalogIds.length) {
            const { data: refs } = await supabase
                .from('manufacturer_supplier_imports')
                .select('manufacturer_id')
                .in('catalog_item_id', catalogIds);
            (refs || []).forEach((r) => {
                referenceCount += 1;
                if (r.manufacturer_id) manufacturerIds.add(r.manufacturer_id);
            });
        }
        res.json({
            supplier: ctx.supplier,
            stats: {
                catalog_count: catalogRows ? catalogRows.length : 0,
                catalog_active_count: activeCount,
                reference_count: referenceCount,
                manufacturer_count: manufacturerIds.size
            }
        });
    } catch (e) {
        console.error('GET /api/me/industry-supplier:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/me/industry-supplier — 更新供應商公司資料（名稱、介紹、聯絡）
app.patch('/api/me/industry-supplier', express.json(), async (req, res) => {
    try {
        if (!(await supplierCatalogTablesReady())) {
            return res.status(503).json({ error: '請先執行 docs/add-industry-supplier-catalog.sql' });
        }
        const ctx = await getMeIndustrySupplier(req, res);
        if (!ctx) return;
        const body = req.body || {};
        const patch = { updated_at: new Date().toISOString() };
        if (body.name != null) {
            const name = String(body.name).trim();
            if (!name) return res.status(400).json({ error: '公司名稱不可為空' });
            patch.name = name;
        }
        if (body.description != null) patch.description = String(body.description).trim() || null;
        if (body.contact_json != null) {
            let contactJson = body.contact_json;
            if (typeof contactJson === 'string') {
                try { contactJson = JSON.parse(contactJson); } catch (_) {
                    return res.status(400).json({ error: 'contact_json 格式錯誤' });
                }
            }
            if (contactJson != null && typeof contactJson !== 'object') {
                return res.status(400).json({ error: 'contact_json 須為物件' });
            }
            patch.contact_json = contactJson || {};
        }
        if (Object.keys(patch).length <= 1) {
            return res.status(400).json({ error: '請提供要更新的欄位' });
        }
        const { data: updated, error } = await supabase
            .from('industry_suppliers')
            .update(patch)
            .eq('id', ctx.supplier.id)
            .select('id, name, description, contact_json, is_active')
            .single();
        if (error) {
            console.error('PATCH industry-supplier profile:', error);
            return res.status(500).json({ error: '更新失敗' });
        }
        res.json({ supplier: updated });
    } catch (e) {
        console.error('PATCH /api/me/industry-supplier:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/me/industry-supplier/recent-references — 哪些製造商引用了我的目錄
app.get('/api/me/industry-supplier/recent-references', async (req, res) => {
    try {
        if (!(await supplierCatalogTablesReady())) {
            return res.json({ items: [] });
        }
        const ctx = await getMeIndustrySupplier(req, res);
        if (!ctx) return;
        const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
        const { data: catalogRows } = await supabase
            .from('supplier_catalog_items')
            .select('id, title, item_kind')
            .eq('industry_supplier_id', ctx.supplier.id);
        const catalogIds = (catalogRows || []).map((r) => r.id);
        if (!catalogIds.length) return res.json({ items: [] });
        const titleById = {};
        (catalogRows || []).forEach((r) => { titleById[r.id] = r.title; });
        const kindById = {};
        (catalogRows || []).forEach((r) => { kindById[r.id] = r.item_kind; });
        const { data: refs, error } = await supabase
            .from('manufacturer_supplier_imports')
            .select('id, catalog_item_id, item_kind, imported_at, manufacturer_id, manufacturers(id, name)')
            .in('catalog_item_id', catalogIds)
            .order('imported_at', { ascending: false })
            .limit(limit);
        if (error) {
            console.error('GET industry-supplier recent-references:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        const items = (refs || []).map((row) => {
            const mfr = row.manufacturers;
            const m = Array.isArray(mfr) ? mfr[0] : mfr;
            return {
                import_id: row.id,
                catalog_item_id: row.catalog_item_id,
                catalog_title: titleById[row.catalog_item_id] || null,
                item_kind: row.item_kind || kindById[row.catalog_item_id] || null,
                manufacturer_id: row.manufacturer_id,
                manufacturer_name: m ? m.name : null,
                imported_at: row.imported_at
            };
        });
        res.json({ items });
    } catch (e) {
        console.error('GET /api/me/industry-supplier/recent-references:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ---------- 產業供應商自訂分類（對稱 vendor_catalog_groups）----------
function isSupabaseMissingTableError(error) {
    if (!error) return false;
    const code = String(error.code || '');
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST204') return true;
    const msg = String(error.message || '').toLowerCase();
    return /does not exist|schema cache|could not find the table/.test(msg);
}

function supplierCatalogGroupRowAssetKind(row) {
    if (!row || row.asset_kind == null || String(row.asset_kind).trim() === '') return 'prototype';
    const k = String(row.asset_kind).trim().toLowerCase();
    if (k === 'material' || k === 'part') return k;
    return 'prototype';
}

function supplierItemKindToGroupKind(itemKind) {
    const k = normalizeSupplierCatalogItemKind(itemKind);
    if (k === 'material') return 'material';
    if (k === 'part') return 'part';
    return 'prototype';
}

async function supplierCatalogGroupsTableReady() {
    const { error } = await supabase.from('supplier_catalog_groups').select('id').limit(1);
    if (!error) return true;
    if (isSupabaseMissingTableError(error)) return false;
    console.warn('supplierCatalogGroupsTableReady:', error.message || error);
    return true;
}

async function buildSupplierCatalogGroupsPayload(supplierId, assetKindFilter) {
    const kindFilter = normalizeVendorCatalogGroupKindFilter(assetKindFilter);
    let { data: groups, error } = await supabase
        .from('supplier_catalog_groups')
        .select('id, industry_supplier_id, name, slug, parent_id, sort_order, asset_kind, created_at, updated_at')
        .eq('industry_supplier_id', supplierId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
    if (error && error.code === '42703') {
        ({ data: groups, error } = await supabase
            .from('supplier_catalog_groups')
            .select('id, industry_supplier_id, name, slug, parent_id, sort_order, created_at, updated_at')
            .eq('industry_supplier_id', supplierId)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true }));
    }
    if (error) {
        if (isSupabaseMissingTableError(error)) return { tree: [], flat: [] };
        throw error;
    }
    let list = groups || [];
    if (kindFilter) {
        list = list.filter((g) => supplierCatalogGroupRowAssetKind(g) === kindFilter);
    }
    const groupIds = list.map((g) => g.id);
    const countMap = {};
    if (groupIds.length) {
        const { data: links, error: linkErr } = await supabase
            .from('supplier_catalog_item_group_links')
            .select('group_id, catalog_item_id')
            .in('group_id', groupIds);
        if (linkErr && !isSupabaseMissingTableError(linkErr)) {
            console.warn('buildSupplierCatalogGroupsPayload links:', linkErr.message || linkErr);
        }
        const itemIds = [...new Set((links || []).map((l) => l.catalog_item_id).filter(Boolean))];
        const kindById = {};
        if (itemIds.length) {
            const { data: items, error: itemsErr } = await supabase
                .from('supplier_catalog_items')
                .select('id, item_kind')
                .in('id', itemIds);
            if (itemsErr) console.warn('buildSupplierCatalogGroupsPayload items:', itemsErr.message || itemsErr);
            (items || []).forEach((it) => { kindById[it.id] = supplierItemKindToGroupKind(it.item_kind); });
        }
        (links || []).forEach((l) => {
            const gk = kindById[l.catalog_item_id] || 'prototype';
            if (kindFilter && gk !== kindFilter) return;
            countMap[l.group_id] = (countMap[l.group_id] || 0) + 1;
        });
    }
    const byId = {};
    list.forEach((g) => {
        byId[g.id] = { ...g, asset_count: countMap[g.id] || 0, children: [] };
    });
    const roots = [];
    list.forEach((g) => {
        const node = byId[g.id];
        if (g.parent_id && byId[g.parent_id]) byId[g.parent_id].children.push(node);
        else roots.push(node);
    });
    function flatten(nodes, depth, out) {
        nodes.sort((a, b) => (a.sort_order - b.sort_order) || String(a.name).localeCompare(String(b.name), 'zh-Hant'));
        nodes.forEach((n) => {
            const pad = depth > 0 ? '\u3000'.repeat(Math.min(depth, 3)) : '';
            out.push({
                id: n.id,
                name: n.name,
                slug: n.slug,
                parent_id: n.parent_id,
                sort_order: n.sort_order,
                asset_count: n.asset_count,
                asset_kind: supplierCatalogGroupRowAssetKind(n),
                depth,
                label: pad + n.name + (n.asset_count ? ` (${n.asset_count})` : '')
            });
            if (n.children && n.children.length) flatten(n.children, depth + 1, out);
        });
    }
    const flat = [];
    flatten(roots, 0, flat);
    return { tree: roots, flat };
}

async function setSupplierCatalogItemCatalogGroups(catalogItemId, supplierId, groupIds, itemKind) {
    if (!(await supplierCatalogGroupsTableReady())) return;
    const ids = [...new Set((groupIds || []).map((id) => String(id).trim()).filter(Boolean))];
    const groupKind = supplierItemKindToGroupKind(itemKind);
    await supabase.from('supplier_catalog_item_group_links').delete().eq('catalog_item_id', catalogItemId);
    if (!ids.length) return;
    let { data: owned, error: ownErr } = await supabase
        .from('supplier_catalog_groups')
        .select('id, asset_kind')
        .eq('industry_supplier_id', supplierId)
        .in('id', ids);
    if (ownErr && ownErr.code === '42703') {
        ({ data: owned } = await supabase
            .from('supplier_catalog_groups')
            .select('id')
            .eq('industry_supplier_id', supplierId)
            .in('id', ids));
    }
    const allowed = new Set(
        (owned || []).filter((g) => supplierCatalogGroupRowAssetKind(g) === groupKind).map((g) => g.id)
    );
    const valid = ids.filter((id) => allowed.has(id));
    if (valid.length) {
        await supabase.from('supplier_catalog_item_group_links').insert(
            valid.map((group_id) => ({ catalog_item_id: catalogItemId, group_id }))
        );
    }
}

async function attachCatalogGroupsToSupplierItems(items) {
    if (!(await supplierCatalogGroupsTableReady()) || !items || !items.length) return items;
    const itemIds = items.map((r) => r.id).filter(Boolean);
    if (!itemIds.length) return items;
    const { data: links, error: linkErr } = await supabase
        .from('supplier_catalog_item_group_links')
        .select('catalog_item_id, group_id')
        .in('catalog_item_id', itemIds);
    if (linkErr && linkErr.code === '42P01') return items;
    if (linkErr) throw linkErr;
    const groupIds = [...new Set((links || []).map((l) => l.group_id).filter(Boolean))];
    const groupsById = {};
    if (groupIds.length) {
        let { data: groups, error: grpErr } = await supabase
            .from('supplier_catalog_groups')
            .select('id, name, parent_id, asset_kind')
            .in('id', groupIds);
        if (grpErr && grpErr.code === '42703') {
            ({ data: groups, error: grpErr } = await supabase
                .from('supplier_catalog_groups')
                .select('id, name, parent_id')
                .in('id', groupIds));
        }
        if (grpErr) throw grpErr;
        (groups || []).forEach((g) => {
            const name = (g.name != null) ? String(g.name).trim() : '';
            if (g.id && name) groupsById[g.id] = { id: g.id, name, parent_id: g.parent_id || null, asset_kind: g.asset_kind };
        });
    }
    const map = {};
    (links || []).forEach((l) => {
        if (!map[l.catalog_item_id]) map[l.catalog_item_id] = [];
        const g = groupsById[l.group_id];
        if (g) map[l.catalog_item_id].push(g);
    });
    return items.map((row) => {
        const itemKind = supplierItemKindToGroupKind(row.item_kind);
        const cats = (map[row.id] || []).filter((g) => supplierCatalogGroupRowAssetKind(g) === itemKind);
        return {
            ...row,
            catalog_group_ids: cats.map((g) => g.id),
            catalog_groups: cats.map((g) => ({ id: g.id, name: g.name, parent_id: g.parent_id }))
        };
    });
}

// GET /api/me/industry-supplier/catalog-groups
app.get('/api/me/industry-supplier/catalog-groups', async (req, res) => {
    try {
        const ctx = await getMeIndustrySupplier(req, res);
        if (!ctx) return;
        if (!(await supplierCatalogGroupsTableReady())) {
            return res.json({ tree: [], flat: [], message: '請執行 docs/add-supplier-catalog-groups.sql' });
        }
        const assetKindQ = (req.query.asset_kind || req.query.item_kind || '').trim().toLowerCase();
        const assetKindFilter = normalizeVendorCatalogGroupKindFilter(assetKindQ);
        let hasAssetKindColumn = true;
        const probe = await supabase.from('supplier_catalog_groups').select('asset_kind').limit(1);
        if (probe.error && (probe.error.code === '42703' || probe.error.code === 'PGRST204')) {
            hasAssetKindColumn = false;
        }
        if ((assetKindFilter === 'material' || assetKindFilter === 'part') && !hasAssetKindColumn) {
            return res.json({
                tree: [],
                flat: [],
                asset_kind_split_unavailable: true,
                message: '請執行 docs/add-supplier-catalog-groups.sql（需含 asset_kind 欄位）'
            });
        }
        let payload;
        try {
            payload = await buildSupplierCatalogGroupsPayload(ctx.supplier.id, assetKindFilter || assetKindQ);
        } catch (buildErr) {
            console.error('buildSupplierCatalogGroupsPayload:', buildErr);
            if (isSupabaseMissingTableError(buildErr)) {
                return res.json({ tree: [], flat: [], message: '請執行 docs/add-supplier-catalog-groups.sql' });
            }
            return res.status(500).json({ error: buildErr.message || '查詢失敗' });
        }
        res.json({ ...payload, asset_kind_split_unavailable: !hasAssetKindColumn });
    } catch (e) {
        console.error('GET /api/me/industry-supplier/catalog-groups:', e);
        res.status(500).json({ error: e.message || '系統錯誤' });
    }
});

// POST /api/me/industry-supplier/catalog-groups
app.post('/api/me/industry-supplier/catalog-groups', express.json(), async (req, res) => {
    try {
        const ctx = await getMeIndustrySupplier(req, res);
        if (!ctx) return;
        if (!(await supplierCatalogGroupsTableReady())) {
            return res.status(500).json({ error: '請執行 docs/add-supplier-catalog-groups.sql' });
        }
        const body = req.body || {};
        const name = (body.name || '').trim();
        if (!name) return res.status(400).json({ error: '請填寫分類名稱' });
        const assetKind = normalizeVendorCatalogGroupKindFilter(body.asset_kind) || 'prototype';
        const parentId = (body.parent_id || '').trim() || null;
        if (parentId) {
            const { data: parent } = await supabase
                .from('supplier_catalog_groups')
                .select('id')
                .eq('id', parentId)
                .eq('industry_supplier_id', ctx.supplier.id)
                .maybeSingle();
            if (!parent) return res.status(400).json({ error: '上層分類不存在' });
        }
        const row = {
            industry_supplier_id: ctx.supplier.id,
            name,
            slug: slugifyVendorCatalogGroupName(name),
            parent_id: parentId,
            sort_order: body.sort_order != null && !isNaN(body.sort_order) ? parseInt(body.sort_order, 10) : 0,
            asset_kind: assetKind,
            updated_at: new Date().toISOString()
        };
        let { data, error } = await supabase.from('supplier_catalog_groups').insert(row).select().single();
        if (error && error.code === '42703') {
            const fallback = { ...row };
            delete fallback.asset_kind;
            ({ data, error } = await supabase.from('supplier_catalog_groups').insert(fallback).select().single());
        }
        if (error) {
            console.error('POST industry-supplier catalog-groups:', error);
            return res.status(500).json({ error: '新增失敗' });
        }
        const payload = await buildSupplierCatalogGroupsPayload(ctx.supplier.id, assetKind);
        res.status(201).json({ group: data, flat: payload.flat });
    } catch (e) {
        console.error('POST /api/me/industry-supplier/catalog-groups:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PUT /api/me/industry-supplier/catalog-groups/:id
app.put('/api/me/industry-supplier/catalog-groups/:id', express.json(), async (req, res) => {
    try {
        const ctx = await getMeIndustrySupplier(req, res);
        if (!ctx) return;
        const id = (req.params.id || '').trim();
        if (!id) return res.status(400).json({ error: '缺少 id' });
        const body = req.body || {};
        const patch = { updated_at: new Date().toISOString() };
        if (body.name != null) {
            const name = String(body.name).trim();
            if (!name) return res.status(400).json({ error: '名稱不可為空' });
            patch.name = name;
            patch.slug = slugifyVendorCatalogGroupName(name);
        }
        if (body.parent_id !== undefined) {
            const pid = body.parent_id ? String(body.parent_id).trim() : null;
            if (pid) {
                const { data: parent } = await supabase
                    .from('supplier_catalog_groups')
                    .select('id')
                    .eq('id', pid)
                    .eq('industry_supplier_id', ctx.supplier.id)
                    .maybeSingle();
                if (!parent) return res.status(400).json({ error: '上層分類不存在' });
            }
            patch.parent_id = pid;
        }
        const { data, error } = await supabase
            .from('supplier_catalog_groups')
            .update(patch)
            .eq('id', id)
            .eq('industry_supplier_id', ctx.supplier.id)
            .select()
            .single();
        if (error) {
            console.error('PUT industry-supplier catalog-groups:', error);
            return res.status(500).json({ error: '更新失敗' });
        }
        if (!data) return res.status(404).json({ error: '找不到分類' });
        res.json({ group: data });
    } catch (e) {
        console.error('PUT /api/me/industry-supplier/catalog-groups:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/me/industry-supplier/catalog-groups/reorder
app.post('/api/me/industry-supplier/catalog-groups/reorder', express.json(), async (req, res) => {
    try {
        const ctx = await getMeIndustrySupplier(req, res);
        if (!ctx) return;
        if (!(await supplierCatalogGroupsTableReady())) {
            return res.status(500).json({ error: '請執行 docs/add-supplier-catalog-groups.sql' });
        }
        const order = Array.isArray(req.body && req.body.order) ? req.body.order.map(String) : [];
        const assetKind = normalizeVendorCatalogGroupKindFilter(req.body && req.body.asset_kind) || 'prototype';
        if (!order.length) return res.status(400).json({ error: '請提供排序' });
        let idx = 0;
        for (const gid of order) {
            await supabase
                .from('supplier_catalog_groups')
                .update({ sort_order: idx++, updated_at: new Date().toISOString() })
                .eq('id', gid)
                .eq('industry_supplier_id', ctx.supplier.id);
        }
        const payload = await buildSupplierCatalogGroupsPayload(ctx.supplier.id, assetKind);
        res.json({ ok: true, flat: payload.flat });
    } catch (e) {
        console.error('POST industry-supplier catalog-groups/reorder:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/me/industry-supplier/catalog-groups/:id
app.delete('/api/me/industry-supplier/catalog-groups/:id', async (req, res) => {
    try {
        const ctx = await getMeIndustrySupplier(req, res);
        if (!ctx) return;
        const id = (req.params.id || '').trim();
        const { error } = await supabase
            .from('supplier_catalog_groups')
            .delete()
            .eq('id', id)
            .eq('industry_supplier_id', ctx.supplier.id);
        if (error) {
            console.error('DELETE industry-supplier catalog-groups:', error);
            return res.status(500).json({ error: '刪除失敗' });
        }
        res.json({ ok: true });
    } catch (e) {
        console.error('DELETE /api/me/industry-supplier/catalog-groups:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/me/industry-supplier/catalog-items/upload-pricing — 與廠商素材庫相同扣點
app.get('/api/me/industry-supplier/catalog-items/upload-pricing', async (req, res) => {
    try {
        res.json({
            points_upload: await getPointsVendorAssetUpload(),
            points_optimize: await getPointsVendorAssetOptimize(),
            points_optimize_material: await getPointsVendorAssetMaterialOptimize(),
            points_description: await getPointsVendorAssetDescription()
        });
    } catch (e) {
        console.error('GET industry-supplier catalog upload-pricing:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/me/industry-supplier/catalog-items/generate-description — 編輯區 AI 說明（扣點）
app.post('/api/me/industry-supplier/catalog-items/generate-description', supplierCatalogItemUpload, async (req, res) => {
    try {
        const ctx = await getMeIndustrySupplier(req, res);
        if (!ctx) return;
        const body = req.body || {};
        const catalogItemId = (body.catalog_item_id || '').trim();
        const itemKind = normalizeSupplierCatalogItemKind(body.item_kind || 'material');
        const assetKind = supplierCatalogItemKindToAssetKind(itemKind);
        let imageFile = req.file ? await vendorAssetFileFromMulter(req.file) : null;
        let context = {
            asset_kind: assetKind,
            category_key: (body.category_key || '').trim(),
            title: (body.title || '').trim(),
            description: (body.description || '').trim()
        };
        if (!imageFile && catalogItemId) {
            const { data: row } = await supabase
                .from('supplier_catalog_items')
                .select('id, cover_image_url, category_key, title, description, item_kind')
                .eq('id', catalogItemId)
                .eq('industry_supplier_id', ctx.supplier.id)
                .maybeSingle();
            if (!row || !row.cover_image_url) return res.status(404).json({ error: '找不到該品項或無圖片' });
            context = {
                asset_kind: supplierCatalogItemKindToAssetKind(row.item_kind),
                category_key: context.category_key || row.category_key || '',
                title: context.title || row.title || '',
                description: context.description || row.description || '',
                image_url: row.cover_image_url
            };
            const deps = getVisualSemanticsDeps();
            const resImg = await deps.fetch(row.cover_image_url, { redirect: 'follow' });
            if (!resImg.ok) return res.status(503).json({ error: '無法讀取產品圖片' });
            const imgBuf = Buffer.from(await resImg.arrayBuffer());
            const imgMime = (resImg.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
            imageFile = await normalizeVendorUploadFile({
                buffer: imgBuf,
                mimetype: imgMime,
                originalname: 'catalog.jpg'
            });
        }
        if (!imageFile) return res.status(400).json({ error: '請上傳圖片或提供品項 id' });
        const ownerId = await getAuthOwnerIdFromReq(req);
        const result = await runVendorAssetImageSemantics(imageFile, context, ownerId);
        const description = result.description || vendorAssetDescriptionFromSemantics(result.semantics);
        if (!description) return res.status(503).json({ error: '無法產生說明，請稍後重試' });
        const pointsRequired = await getPointsVendorAssetDescription();
        const isAdmin = await isProfileAdminUser(ownerId);
        let balanceAfter = null;
        let pointsDeducted = 0;
        if (!isAdmin && ownerId && pointsRequired > 0) {
            const { balance, sufficient } = await checkUserCreditsBalance(ownerId, pointsRequired);
            if (!sufficient) {
                return res.status(402).json({ error: '點數不足', balance, required: pointsRequired });
            }
            const consumed = await consumeUserCredits(
                ownerId,
                pointsRequired,
                'vendor_asset_description',
                '供應商產品庫 AI 產生說明',
                { industry_supplier_id: ctx.supplier.id, catalog_item_id: catalogItemId || null }
            );
            if (!consumed.ok) {
                return res.status(402).json({ error: consumed.error || '扣點失敗', balance: consumed.balance });
            }
            balanceAfter = consumed.balance_after;
            pointsDeducted = pointsRequired;
        }
        res.json({
            description,
            product_description_zh: result.semantics?.product_description_zh || null,
            product_description_en: result.semantics?.product_description_en || null,
            points_deducted: pointsDeducted,
            balance_after: balanceAfter
        });
    } catch (e) {
        console.error('POST industry-supplier catalog generate-description:', e);
        res.status(503).json({ error: e.message || 'AI 說明產生失敗，請稍後重試' });
    }
});

// GET /api/me/industry-supplier/catalog-items — 產業供應商管理自己的目錄
app.get('/api/me/industry-supplier/catalog-items', async (req, res) => {
    try {
        if (!(await supplierCatalogTablesReady())) {
            return res.json({ items: [], message: '請先執行 docs/add-industry-supplier-catalog.sql' });
        }
        const ctx = await getMeIndustrySupplier(req, res);
        if (!ctx) return;
        const itemKind = (req.query.item_kind || '').trim();
        let q = supabase
            .from('supplier_catalog_items')
            .select(SUPPLIER_CATALOG_ITEM_SELECT)
            .eq('industry_supplier_id', ctx.supplier.id)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (itemKind === 'material' || itemKind === 'prototype_set' || itemKind === 'part') q = q.eq('item_kind', itemKind);
        let { data: rows, error } = await q;
        if (error && error.code === '42703') {
            const legacySelect = 'id, item_kind, title, description, cover_image_url, spec_json, category_key, is_active, sort_order, created_at';
            let q2 = supabase
                .from('supplier_catalog_items')
                .select(legacySelect)
                .eq('industry_supplier_id', ctx.supplier.id)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: false });
            if (itemKind === 'material' || itemKind === 'prototype_set' || itemKind === 'part') q2 = q2.eq('item_kind', itemKind);
            ({ data: rows, error } = await q2);
        }
        if (error) {
            console.error('GET industry-supplier catalog-items:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        const includeRefs = req.query.include_references === '1';
        const catalogIds = (rows || []).map((r) => r.id);
        const refsByCatalog = {};
        if (includeRefs && catalogIds.length) {
            const { data: refs, error: refErr } = await supabase
                .from('manufacturer_supplier_imports')
                .select('id, catalog_item_id, manufacturer_id, imported_at, manufacturers(id, name)')
                .in('catalog_item_id', catalogIds)
                .order('imported_at', { ascending: false });
            if (!refErr && refs) {
                refs.forEach((ref) => {
                    const cid = ref.catalog_item_id;
                    if (!refsByCatalog[cid]) refsByCatalog[cid] = [];
                    const mfr = ref.manufacturers;
                    const m = Array.isArray(mfr) ? mfr[0] : mfr;
                    refsByCatalog[cid].push({
                        import_id: ref.id,
                        manufacturer_id: ref.manufacturer_id,
                        manufacturer_name: m ? m.name : null,
                        imported_at: ref.imported_at
                    });
                });
            }
        }
        let items = (rows || []).map((row) => {
            const references = refsByCatalog[row.id] || [];
            return {
                ...row,
                reference_count: includeRefs ? references.length : 0,
                references: includeRefs ? references : []
            };
        });
        try {
            items = await attachCatalogGroupsToSupplierItems(items);
        } catch (grpErr) {
            console.warn('attachCatalogGroupsToSupplierItems:', grpErr.message);
        }
        res.json({ supplier: ctx.supplier, items });
    } catch (e) {
        console.error('GET /api/me/industry-supplier/catalog-items:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/me/industry-supplier/catalog-items — 上架品項（含 AI 標籤／可選重繪，對稱 vendor-assets）
app.post('/api/me/industry-supplier/catalog-items', supplierCatalogItemUpload, async (req, res) => {
    try {
        if (!(await supplierCatalogTablesReady())) {
            return res.status(503).json({ error: '請先執行 docs/add-industry-supplier-catalog.sql' });
        }
        const uploadUser = await assertCanUploadProductsAndAssets(req, res);
        if (!uploadUser) return;
        const ctx = await getMeIndustrySupplier(req, res);
        if (!ctx) return;
        const body = req.body || {};
        const itemKind = normalizeSupplierCatalogItemKind(body.item_kind);
        const categoryKey = (body.category_key || '').trim();
        if (!categoryKey) return res.status(400).json({ error: '請選擇平台主分類' });
        let file = await vendorAssetFileFromMulter(req.file);
        if (!file) return res.status(400).json({ error: '請上傳產品圖片' });
        const ownerId = uploadUser.id || (await getAuthOwnerIdFromReq(req));
        const uiLocale = resolveUiLocaleFromRequest(req);
        const pipeline = await processSupplierCatalogImagePipeline({
            file,
            body,
            itemKind,
            title: (body.title || '').trim(),
            description: (body.description || '').trim(),
            categoryKey,
            ownerId,
            uiLocale
        });
        if (pipeline.error) {
            return res.status(pipeline.status || 400).json({
                error: pipeline.error,
                balance: pipeline.balance,
                required: pipeline.required
            });
        }
        const title = pipeline.title;
        const description = pipeline.description;
        if (!title) return res.status(400).json({ error: '請填寫產品名稱，或上傳可辨識的圖片以自動產生標題' });
        if (!description) return res.status(400).json({ error: '請填寫產品說明，或留空由 AI 產生（需可讀圖）' });
        const { publicUrl } = await uploadToSupabaseStorage(
            'custom-products',
            `supplier-catalog/${ctx.supplier.id}`,
            pipeline.uploadFile
        );
        const specJson = parseSupplierCatalogSpecJson(itemKind, body);
        const sortOrder = (body.sort_order != null && !isNaN(body.sort_order)) ? parseInt(body.sort_order, 10) : 0;
        const insertPayload = {
            industry_supplier_id: ctx.supplier.id,
            item_kind: itemKind,
            title,
            description,
            cover_image_url: publicUrl,
            spec_json: specJson,
            category_key: categoryKey,
            is_active: true,
            sort_order: sortOrder,
            ai_tags: pipeline.tags,
            ai_tags_generated_at: new Date().toISOString(),
            tags_source: pipeline.tagsSource
        };
        if (pipeline.semanticsJson) insertPayload.image_semantics_json = pipeline.semanticsJson;
        let { data: inserted, error } = await supabase
            .from('supplier_catalog_items')
            .insert(insertPayload)
            .select(SUPPLIER_CATALOG_ITEM_SELECT)
            .single();
        let aiMigrationRequired = false;
        if (error && error.code === '42703') {
            delete insertPayload.ai_tags;
            delete insertPayload.image_semantics_json;
            delete insertPayload.tags_source;
            delete insertPayload.ai_tags_generated_at;
            aiMigrationRequired = true;
            ({ data: inserted, error } = await supabase
                .from('supplier_catalog_items')
                .insert(insertPayload)
                .select('id, item_kind, title, description, cover_image_url, spec_json, category_key, is_active, sort_order, created_at')
                .single());
        }
        if (error) {
            console.error('POST industry-supplier catalog-item:', error);
            if (error.code === '23514') {
                return res.status(400).json({ error: '資料庫尚未支援此品項類型，請執行 docs/add-supplier-catalog-item-kind-part.sql' });
            }
            return res.status(500).json({ error: '上架失敗' });
        }
        await recordVisualSemanticsEvent({
            source_type: 'catalog_item',
            source_id: inserted.id,
            image_url: publicUrl,
            text_input: null,
            semantics_kind: 'image',
            ai_tags: pipeline.tags,
            semantics_json: pipeline.semanticsJson,
            model: pipeline.tagsSource === 'gemini' ? await getTaggingModelName() : null,
            prompt_version: visualSemantics.PROMPT_VERSION,
            owner_id: ownerId,
            category_key: categoryKey
        });
        if (body.catalog_group_ids !== undefined || body.catalog_group_id) {
            await setSupplierCatalogItemCatalogGroups(
                inserted.id,
                ctx.supplier.id,
                parseCatalogGroupIdsFromBody(body),
                itemKind
            );
        }
        const pointsMeta = await consumeSupplierCatalogUploadPoints(
            ownerId,
            pipeline.isAdmin,
            pipeline.pointsRequired,
            pipeline.wantsOptimize,
            pipeline.assetKind,
            ctx.supplier.id,
            inserted.id
        );
        res.status(201).json({
            item: inserted,
            points_deducted: pointsMeta.points_deducted,
            balance_after: pointsMeta.balance_after,
            product_optimized: pipeline.wantsOptimize,
            ai_migration_required: aiMigrationRequired
        });
    } catch (e) {
        console.error('POST /api/me/industry-supplier/catalog-items:', e);
        res.status(500).json({ error: e.message || '系統錯誤' });
    }
});

// PATCH /api/me/industry-supplier/catalog-items/:id
app.patch('/api/me/industry-supplier/catalog-items/:id', supplierCatalogItemUpload, async (req, res) => {
    try {
        if (!(await supplierCatalogTablesReady())) {
            return res.status(503).json({ error: '請先執行 docs/add-industry-supplier-catalog.sql' });
        }
        const ctx = await getMeIndustrySupplier(req, res);
        if (!ctx) return;
        const itemId = (req.params.id || '').trim();
        if (!itemId) return res.status(400).json({ error: '缺少 id' });
        const { data: existing } = await supabase
            .from('supplier_catalog_items')
            .select('id, cover_image_url, item_kind, spec_json, title, description, category_key, ai_tags, image_semantics_json')
            .eq('id', itemId)
            .eq('industry_supplier_id', ctx.supplier.id)
            .maybeSingle();
        if (!existing) return res.status(404).json({ error: '找不到該品項' });
        const body = req.body || {};
        const patch = {};
        if (body.title != null) {
            const t = String(body.title).trim();
            if (!t) return res.status(400).json({ error: '標題不可為空' });
            patch.title = t;
        }
        if (body.description != null) {
            const d = String(body.description).trim();
            if (!d) return res.status(400).json({ error: '產品說明不可為空' });
            patch.description = d;
        }
        if (body.category_key != null) {
            const ck = String(body.category_key).trim();
            if (!ck) return res.status(400).json({ error: '請選擇平台主分類' });
            patch.category_key = ck;
        }
        if (body.is_active != null) patch.is_active = !!body.is_active;
        if (body.sort_order != null && !isNaN(body.sort_order)) patch.sort_order = parseInt(body.sort_order, 10);
        const itemKind = normalizeSupplierCatalogItemKind(existing.item_kind);
        if (body.spec_json != null || body.material_type != null || body.subcategory_key != null) {
            const baseSpec = (existing.spec_json && typeof existing.spec_json === 'object') ? existing.spec_json : {};
            patch.spec_json = parseSupplierCatalogSpecJson(itemKind, { ...baseSpec, ...body, spec_json: body.spec_json || baseSpec });
        }
        if (body.ai_tags !== undefined) {
            const manualTags = parseAiTagsFromBody(body);
            patch.ai_tags = manualTags || [];
            patch.tags_source = body.image_semantics_json ? 'gemini' : 'manual';
            patch.ai_tags_generated_at = new Date().toISOString();
            if (body.image_semantics_json) {
                try {
                    patch.image_semantics_json = typeof body.image_semantics_json === 'string'
                        ? JSON.parse(body.image_semantics_json)
                        : body.image_semantics_json;
                } catch (_) {}
            }
        }
        let pointsMeta = { points_deducted: 0, balance_after: null };
        let productOptimized = false;
        if (req.file) {
            let file = await vendorAssetFileFromMulter(req.file);
            if (!file) return res.status(400).json({ error: '圖片格式無效' });
            const ownerId = await getAuthOwnerIdFromReq(req);
            const uiLocale = resolveUiLocaleFromRequest(req);
            const pipeline = await processSupplierCatalogImagePipeline({
                file,
                body,
                itemKind,
                title: patch.title || existing.title,
                description: patch.description != null ? patch.description : existing.description,
                categoryKey: patch.category_key || existing.category_key || '',
                ownerId,
                uiLocale
            });
            if (pipeline.error) {
                return res.status(pipeline.status || 400).json({
                    error: pipeline.error,
                    balance: pipeline.balance,
                    required: pipeline.required
                });
            }
            const { publicUrl } = await uploadToSupabaseStorage(
                'custom-products',
                `supplier-catalog/${ctx.supplier.id}`,
                pipeline.uploadFile
            );
            patch.cover_image_url = publicUrl;
            patch.ai_tags = pipeline.tags;
            patch.image_semantics_json = pipeline.semanticsJson;
            patch.tags_source = pipeline.tagsSource;
            patch.ai_tags_generated_at = new Date().toISOString();
            if (!patch.title && pipeline.title) patch.title = pipeline.title;
            if (!patch.description && pipeline.description) patch.description = pipeline.description;
            productOptimized = pipeline.wantsOptimize;
            pointsMeta = await consumeSupplierCatalogUploadPoints(
                ownerId,
                pipeline.isAdmin,
                pipeline.pointsRequired,
                pipeline.wantsOptimize,
                pipeline.assetKind,
                ctx.supplier.id,
                itemId
            );
        } else if (body.cover_image_url != null && String(body.cover_image_url).trim()) {
            const coverResolved = await resolveSupplierCatalogCoverUrl(ctx.supplier.id, req, existing.cover_image_url);
            if (coverResolved.error) return res.status(400).json({ error: coverResolved.error });
            patch.cover_image_url = coverResolved.url;
        }
        patch.updated_at = new Date().toISOString();
        let { data: updated, error } = await supabase
            .from('supplier_catalog_items')
            .update(patch)
            .eq('id', itemId)
            .select(SUPPLIER_CATALOG_ITEM_SELECT)
            .single();
        if (error && error.code === '42703') {
            delete patch.ai_tags;
            delete patch.image_semantics_json;
            delete patch.tags_source;
            delete patch.ai_tags_generated_at;
            ({ data: updated, error } = await supabase
                .from('supplier_catalog_items')
                .update(patch)
                .eq('id', itemId)
                .select('id, item_kind, title, description, cover_image_url, spec_json, category_key, is_active, sort_order, created_at')
                .single());
        }
        if (error) {
            console.error('PATCH industry-supplier catalog-item:', error);
            return res.status(500).json({ error: '更新失敗' });
        }
        if (body.catalog_group_ids !== undefined || body.catalog_group_id) {
            await setSupplierCatalogItemCatalogGroups(
                itemId,
                ctx.supplier.id,
                parseCatalogGroupIdsFromBody(body),
                itemKind
            );
        }
        let itemOut = updated;
        try {
            const withGroups = await attachCatalogGroupsToSupplierItems([updated]);
            if (withGroups && withGroups[0]) itemOut = withGroups[0];
        } catch (_) {}
        res.json({
            item: itemOut,
            points_deducted: pointsMeta.points_deducted,
            balance_after: pointsMeta.balance_after,
            product_optimized: productOptimized
        });
    } catch (e) {
        console.error('PATCH /api/me/industry-supplier/catalog-items/:id:', e);
        res.status(500).json({ error: e.message || '系統錯誤' });
    }
});

// DELETE /api/me/industry-supplier/catalog-items/:id — 刪除品項（對稱 vendor-assets DELETE）
app.delete('/api/me/industry-supplier/catalog-items/:id', async (req, res) => {
    try {
        if (!(await supplierCatalogTablesReady())) {
            return res.status(503).json({ error: '請先執行 docs/add-industry-supplier-catalog.sql' });
        }
        const ctx = await getMeIndustrySupplier(req, res);
        if (!ctx) return;
        const itemId = (req.params.id || '').trim();
        if (!itemId) return res.status(400).json({ error: '缺少 id' });
        const { data: existing, error: rowErr } = await supabase
            .from('supplier_catalog_items')
            .select('id')
            .eq('id', itemId)
            .eq('industry_supplier_id', ctx.supplier.id)
            .maybeSingle();
        if (rowErr) {
            console.error('DELETE industry-supplier catalog-item select:', rowErr);
            return res.status(500).json({ error: '查詢失敗' });
        }
        if (!existing) return res.status(404).json({ error: '找不到該品項' });
        const { error } = await supabase
            .from('supplier_catalog_items')
            .delete()
            .eq('id', itemId)
            .eq('industry_supplier_id', ctx.supplier.id);
        if (error) {
            console.error('DELETE industry-supplier catalog-item:', error);
            return res.status(500).json({ error: '刪除失敗' });
        }
        res.status(204).send();
    } catch (e) {
        console.error('DELETE /api/me/industry-supplier/catalog-items/:id:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ---------- 廠商資料夾（系列）----------
// GET /api/manufacturers/:id/collections — 列出某廠商的資料夾（公開）
app.get('/api/manufacturers/:id/collections', async (req, res) => {
    try {
        const manufacturerId = req.params.id;
        const { data: list, error } = await supabase
            .from('manufacturer_collections')
            .select('id, manufacturer_id, title, slug, cover_image_url, description, sort_order, created_at, category_keys')
            .eq('manufacturer_id', manufacturerId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (error) {
            console.error('GET /api/manufacturers/:id/collections 失敗:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        res.json({ items: list || [] });
    } catch (e) {
        console.error('GET /api/manufacturers/:id/collections 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/manufacturers/:id/collections/:collectionId — 單一資料夾含作品列表（公開）
app.get('/api/manufacturers/:id/collections/:collectionId', async (req, res) => {
    try {
        const { id: manufacturerId, collectionId } = req.params;
        const { data: coll, error: collErr } = await supabase
            .from('manufacturer_collections')
            .select('id, manufacturer_id, title, slug, cover_image_url, description, sort_order, created_at, category_keys')
            .eq('id', collectionId)
            .eq('manufacturer_id', manufacturerId)
            .single();
        if (collErr || !coll) return res.status(404).json({ error: '找不到該資料夾' });

        const { data: items } = await supabase
            .from('manufacturer_collection_items')
            .select('id, portfolio_id, sort_order')
            .eq('collection_id', collectionId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });
        const portfolioIds = (items || []).map(i => i.portfolio_id).filter(Boolean);
        let portfolios = [];
        if (portfolioIds.length > 0) {
            const { data: rows } = await supabase
                .from('manufacturer_portfolio')
                .select('id, title, image_url, image_url_before, design_highlight, tags, min_order_quantity')
                .in('id', portfolioIds)
                .eq('manufacturer_id', manufacturerId);
            const byId = {};
            (rows || []).forEach(r => { byId[r.id] = r; });
            const order = (items || []).map(i => i.portfolio_id);
            portfolios = order.map(pid => byId[pid]).filter(Boolean);
        }
        res.json({ ...coll, items: portfolios });
    } catch (e) {
        console.error('GET /api/manufacturers/:id/collections/:collectionId 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// 解析登入者為「我的廠商」ID（用於 /api/me/manufacturer/collections 等）
async function getMeManufacturerId(req, res) {
    const authHeader = req.headers.authorization || req.headers['x-auth-token'];
    const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
    if (!token) {
        res.status(401).json({ error: '請先登入' });
        return null;
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        res.status(401).json({ error: '登入已過期或無效' });
        return null;
    }
    const { data: mfr, error } = await supabase
        .from('manufacturers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
    if (error || !mfr) {
        res.status(404).json({ error: '尚未建立廠商資料', code: 'NO_MANUFACTURER' });
        return null;
    }
    return mfr.id;
}

// 種子廠商綁定帳號本人不得寫入（在 getMeManufacturerId 之後呼叫）
async function rejectSeedManufacturerWrite(req, manufacturerId, res) {
    if (!manufacturerId) return false;
    const user = await getRequestUserFromAuthHeader(req);
    if (!user) return false;
    return rejectSeedVendorSelfServiceWrite(user.id, manufacturerId, res);
}

// POST /api/me/manufacturer/collections — 建立資料夾（需登入且為廠商）；種子廠商不得建立
app.post('/api/me/manufacturer/collections', express.json(), async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        if (await rejectSeedManufacturerWrite(req, manufacturerId, res)) return;
        const body = req.body || {};
        const title = (body.title || '').trim();
        if (!title) return res.status(400).json({ error: '請填寫資料夾名稱' });
        const categoryKeys = Array.isArray(body.category_keys) ? body.category_keys.filter(k => k != null && String(k).trim()) : null;
        const { data: inserted, error } = await supabase
            .from('manufacturer_collections')
            .insert({
                manufacturer_id: manufacturerId,
                title,
                description: (body.description || '').trim() || null,
                cover_image_url: body.cover_image_url || null,
                sort_order: body.sort_order != null ? body.sort_order : 0,
                ...(categoryKeys && { category_keys: categoryKeys })
            })
            .select('id, manufacturer_id, title, slug, cover_image_url, description, sort_order, created_at, category_keys')
            .single();
        if (error) {
            console.error('POST /api/me/manufacturer/collections 失敗:', error);
            return res.status(500).json({ error: '建立失敗' });
        }
        res.status(201).json(inserted);
    } catch (e) {
        console.error('POST /api/me/manufacturer/collections 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PUT /api/me/manufacturer/collections/:id — 更新資料夾；種子廠商不得編輯
app.put('/api/me/manufacturer/collections/:id', express.json(), async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        if (await rejectSeedManufacturerWrite(req, manufacturerId, res)) return;
        const collectionId = req.params.id;
        const { data: existing } = await supabase
            .from('manufacturer_collections')
            .select('id')
            .eq('id', collectionId)
            .eq('manufacturer_id', manufacturerId)
            .single();
        if (!existing) return res.status(404).json({ error: '找不到該資料夾' });
        const body = req.body || {};
        const updates = {
            updated_at: new Date().toISOString(),
            ...(body.title !== undefined && { title: (body.title || '').trim() || null }),
            ...(body.description !== undefined && { description: (body.description || '').trim() || null }),
            ...(body.cover_image_url !== undefined && { cover_image_url: body.cover_image_url || null }),
            ...(body.sort_order !== undefined && { sort_order: body.sort_order }),
            ...(body.category_keys !== undefined && { category_keys: Array.isArray(body.category_keys) ? body.category_keys.filter(k => k != null && String(k).trim()) : null })
        };
        const { data: updated, error } = await supabase
            .from('manufacturer_collections')
            .update(updates)
            .eq('id', collectionId)
            .select('id, manufacturer_id, title, slug, cover_image_url, description, sort_order, created_at, category_keys')
            .single();
        if (error) {
            console.error('PUT /api/me/manufacturer/collections/:id 失敗:', error);
            return res.status(500).json({ error: '更新失敗' });
        }
        res.json(updated);
    } catch (e) {
        console.error('PUT /api/me/manufacturer/collections/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/me/manufacturer/collections/:id — 刪除資料夾；種子廠商不得刪除
app.delete('/api/me/manufacturer/collections/:id', async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        if (await rejectSeedManufacturerWrite(req, manufacturerId, res)) return;
        const collectionId = req.params.id;
        const { data: existing } = await supabase
            .from('manufacturer_collections')
            .select('id')
            .eq('id', collectionId)
            .eq('manufacturer_id', manufacturerId)
            .single();
        if (!existing) return res.status(404).json({ error: '找不到該資料夾' });
        const { error } = await supabase.from('manufacturer_collections').delete().eq('id', collectionId);
        if (error) {
            console.error('DELETE /api/me/manufacturer/collections/:id 失敗:', error);
            return res.status(500).json({ error: '刪除失敗' });
        }
        res.status(204).send();
    } catch (e) {
        console.error('DELETE /api/me/manufacturer/collections/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/me/manufacturer/collections/:id/items — 將作品加入資料夾（body: portfolio_id）；種子廠商不得編輯
app.post('/api/me/manufacturer/collections/:id/items', express.json(), async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        if (await rejectSeedManufacturerWrite(req, manufacturerId, res)) return;
        const collectionId = req.params.id;
        const { data: coll } = await supabase
            .from('manufacturer_collections')
            .select('id')
            .eq('id', collectionId)
            .eq('manufacturer_id', manufacturerId)
            .single();
        if (!coll) return res.status(404).json({ error: '找不到該資料夾' });
        const portfolioId = (req.body && req.body.portfolio_id) || req.body?.portfolioId;
        if (!portfolioId) return res.status(400).json({ error: '請提供 portfolio_id' });
        const { data: port } = await supabase
            .from('manufacturer_portfolio')
            .select('id')
            .eq('id', portfolioId)
            .eq('manufacturer_id', manufacturerId)
            .single();
        if (!port) return res.status(404).json({ error: '找不到該作品或非您的作品' });
        const { data: inserted, error } = await supabase
            .from('manufacturer_collection_items')
            .insert({ collection_id: collectionId, portfolio_id: portfolioId })
            .select('id, collection_id, portfolio_id, sort_order')
            .single();
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: '該作品已在資料夾中' });
            console.error('POST /api/me/manufacturer/collections/:id/items 失敗:', error);
            return res.status(500).json({ error: '加入失敗' });
        }
        res.status(201).json(inserted);
    } catch (e) {
        console.error('POST /api/me/manufacturer/collections/:id/items 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/me/manufacturer/collections/:id/items/:portfolioId — 從資料夾移除作品；種子廠商不得編輯
app.delete('/api/me/manufacturer/collections/:id/items/:portfolioId', async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        if (await rejectSeedManufacturerWrite(req, manufacturerId, res)) return;
        const { id: collectionId, portfolioId } = req.params;
        const { data: coll } = await supabase
            .from('manufacturer_collections')
            .select('id')
            .eq('id', collectionId)
            .eq('manufacturer_id', manufacturerId)
            .single();
        if (!coll) return res.status(404).json({ error: '找不到該資料夾' });
        const { error } = await supabase
            .from('manufacturer_collection_items')
            .delete()
            .eq('collection_id', collectionId)
            .eq('portfolio_id', portfolioId);
        if (error) {
            console.error('DELETE /api/me/manufacturer/collections/:id/items/:portfolioId 失敗:', error);
            return res.status(500).json({ error: '移除失敗' });
        }
        res.status(204).send();
    } catch (e) {
        console.error('DELETE /api/me/manufacturer/collections/:id/items/:portfolioId 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// 訂製品分類多語系欄位對應（?lang= 用）；預留 ja, es, de, fr
const CUSTOM_CAT_LOCALE_COL = { en: 'name_en', ja: 'name_ja', es: 'name_es', de: 'name_de', fr: 'name_fr' };

// GET /api/custom-product-categories — 訂製品廠商分類（含子分類，供前台下拉、廠商編輯用）
// 支援 ?lang=en|ja|es|de|fr：回傳對應 name_xx，無則依序 fallback name_en → name
app.get('/api/custom-product-categories', async (req, res) => {
    try {
        const lang = (req.query.lang || '').toLowerCase().replace(/-.*$/, '');
        const localeCol = CUSTOM_CAT_LOCALE_COL[lang];
        const { data: cats, error } = await supabase
            .from('custom_product_categories')
            .select('id, key, name, prompt, sort_order, is_active')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('GET /api/custom-product-categories:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        const list = cats || [];
        const keys = list.map(c => c.key);
        let subMap = {};
        if (keys.length > 0) {
            const { data: subs } = await supabase
                .from('custom_product_subcategories')
                .select('id, category_key, key, name, prompt, sort_order')
                .in('category_key', keys)
                .eq('is_active', true)
                .order('sort_order', { ascending: true });
            (subs || []).forEach(s => {
                if (!subMap[s.category_key]) subMap[s.category_key] = [];
                subMap[s.category_key].push({ id: s.id, key: s.key, name: s.name, prompt: s.prompt || '', sort_order: s.sort_order });
            });
        }
        if (localeCol && keys.length > 0) {
            const mainCols = (lang === 'en') ? 'key, name_en' : ('key, name_en, ' + localeCol);
            const subCols = (lang === 'en') ? 'category_key, key, name_en' : ('category_key, key, name_en, ' + localeCol);
            const { data: catsLoc, error: errMain } = await supabase.from('custom_product_categories').select(mainCols).in('key', keys);
            const { data: subsLoc, error: errSub } = await supabase.from('custom_product_subcategories').select(subCols).in('category_key', keys);
            const isEn = (lang === 'en');
            if (errMain || errSub) {
                if (isEn) {
                    const { data: catsEn, error: e1 } = await supabase.from('custom_product_categories').select('key, name_en').in('key', keys);
                    const { data: subsEn, error: e2 } = await supabase.from('custom_product_subcategories').select('category_key, key, name_en').in('category_key', keys);
                    if (!e1 && !e2 && catsEn && subsEn) {
                        catsEn.forEach(r => { const c = list.find(x => x.key === r.key); if (c) c.name = (r.name_en != null && r.name_en !== '') ? r.name_en : (r.key || c.name); });
                        Object.keys(subMap).forEach(ck => { subMap[ck] = subMap[ck].map(s => { const r = subsEn.find(x => x.category_key === ck && x.key === s.key); return { ...s, name: (r && r.name_en != null && r.name_en !== '') ? r.name_en : (r && r.key) || s.key || s.name }; }); });
                    }
                }
            } else if (catsLoc && subsLoc) {
                const pick = (r) => (lang !== 'en' && r[localeCol] != null && r[localeCol] !== '') ? r[localeCol] : (r.name_en != null && r.name_en !== '') ? r.name_en : null;
                catsLoc.forEach(r => {
                    const c = list.find(x => x.key === r.key);
                    if (!c) return;
                    const v = pick(r);
                    if (v) c.name = v;
                    else if (isEn) c.name = (r.name_en != null && r.name_en !== '') ? r.name_en : (r.key || c.name);
                });
                const subLocMap = {};
                subsLoc.forEach(r => { const v = pick(r); if (v) subLocMap[r.category_key + ':' + r.key] = v; });
                Object.keys(subMap).forEach(ck => {
                    subMap[ck] = subMap[ck].map(s => {
                        const v = subLocMap[ck + ':' + s.key];
                        if (v) return { ...s, name: v };
                        const r = subsLoc.find(x => x.category_key === ck && x.key === s.key);
                        if (r && r.name_en != null && r.name_en !== '') return { ...s, name: r.name_en };
                        if (isEn && r) return { ...s, name: r.key || s.name };
                        return s;
                    });
                });
            }
        }
        const categories = list.map(c => ({ ...c, prompt: c.prompt || '', subcategories: subMap[c.key] || [] }));
        res.json({ categories });
    } catch (e) {
        console.error('GET /api/custom-product-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PUT /api/custom-product-categories — 後台更新訂製品廠商分類（需 admin）
app.put('/api/custom-product-categories', express.json(), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: '未授權' });
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'token 無效' });

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin') return res.status(403).json({ error: '僅管理員可編輯' });

        const categories = Array.isArray(req.body.categories) ? req.body.categories : [];
        for (const c of categories) {
            if (!c.key) continue;
            await supabase.from('custom_product_categories').upsert({
                key: c.key,
                name: c.name || c.key,
                prompt: c.prompt != null ? String(c.prompt) : '',
                sort_order: c.sort_order != null ? c.sort_order : 0,
                is_active: c.is_active !== false
            }, { onConflict: 'key' });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PUT /api/custom-product-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/custom-product-categories — 列出全部（含停用、含子分類），供後台編輯
app.get('/api/admin/custom-product-categories', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const { data: cats, error } = await supabase
            .from('custom_product_categories')
            .select('id, key, name, prompt, sort_order, is_active, created_at')
            .order('sort_order', { ascending: true })
            .order('key', { ascending: true });
        if (error) {
            console.error('GET /api/admin/custom-product-categories:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        const list = (cats || []).map(c => ({ ...c, name_en: '', name_ja: '', name_es: '', name_de: '', name_fr: '' }));
        const keys = list.map(c => c.key);
        let subMap = {};
        if (keys.length > 0) {
            const { data: subs } = await supabase
                .from('custom_product_subcategories')
                .select('id, category_key, key, name, prompt, sort_order, is_active')
                .in('category_key', keys)
                .order('sort_order', { ascending: true });
            (subs || []).forEach(s => {
                if (!subMap[s.category_key]) subMap[s.category_key] = [];
                subMap[s.category_key].push({ id: s.id, key: s.key, name: s.name, name_en: '', name_ja: '', name_es: '', name_de: '', name_fr: '', prompt: s.prompt || '', sort_order: s.sort_order, is_active: s.is_active });
            });
        }
        const { data: catsEn, error: e1 } = await supabase.from('custom_product_categories').select('key, name_en').in('key', keys);
        const { data: subsEn, error: e2 } = await supabase.from('custom_product_subcategories').select('category_key, key, name_en').in('category_key', keys);
        if (!e1 && catsEn) list.forEach(c => { const r = catsEn.find(x => x.key === c.key); if (r && r.name_en != null) c.name_en = r.name_en || ''; });
        if (!e2 && subsEn) Object.keys(subMap).forEach(ck => { subMap[ck].forEach(s => { const r = subsEn.find(x => x.category_key === ck && x.key === s.key); if (r && r.name_en != null) s.name_en = r.name_en || ''; }); });
        const extraLocaleCols = ['name_ja', 'name_es', 'name_de', 'name_fr'];
        for (const col of extraLocaleCols) {
            const { data: mainData, error: em } = await supabase.from('custom_product_categories').select('key, ' + col).in('key', keys);
            const { data: subData, error: es } = await supabase.from('custom_product_subcategories').select('category_key, key, ' + col).in('category_key', keys);
            if (!em && mainData) list.forEach(c => { const r = mainData.find(x => x.key === c.key); if (r && r[col] != null) c[col] = r[col] || ''; });
            if (!es && subData) Object.keys(subMap).forEach(ck => { subMap[ck].forEach(s => { const r = subData.find(x => x.category_key === ck && x.key === s.key); if (r && r[col] != null) s[col] = r[col] || ''; }); });
        }
        const categories = list.map(c => ({ ...c, prompt: c.prompt || '', subcategories: subMap[c.key] || [] }));
        res.json({ categories });
    } catch (e) {
        console.error('GET /api/admin/custom-product-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/admin/custom-product-categories — 新增一筆分類
app.post('/api/admin/custom-product-categories', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const { key, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order } = req.body || {};
        if (!key || !String(key).trim()) return res.status(400).json({ error: '請填寫 key' });
        const k = String(key).trim().toLowerCase().replace(/\s+/g, '_');
        const payload = {
            key: k,
            name: (name && String(name).trim()) || k,
            prompt: prompt != null ? String(prompt) : '',
            sort_order: sort_order != null ? Number(sort_order) : 0,
            is_active: true
        };
        if (name_en !== undefined) payload.name_en = name_en != null ? String(name_en).trim() : null;
        for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) payload[col] = req.body[col] != null ? String(req.body[col]).trim() : null;
        let error = (await supabase.from('custom_product_categories').insert(payload)).error;
        if (error && (error.code === '42703' || (error.message && /column.*does not exist|name_en|name_ja/.test(error.message)))) {
            const basePayload = { key: k, name: (name && String(name).trim()) || k, prompt: prompt != null ? String(prompt) : '', sort_order: sort_order != null ? Number(sort_order) : 0, is_active: true };
            error = (await supabase.from('custom_product_categories').insert(basePayload)).error;
        }
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
            console.error('POST /api/admin/custom-product-categories:', error);
            return res.status(500).json({ error: '新增失敗。若需多語系請執行 docs/add-custom-product-categories-multilang.sql' });
        }
        res.status(201).json({ success: true });
    } catch (e) {
        console.error('POST /api/admin/custom-product-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PUT /api/admin/custom-product-categories/by-id/:id — 依 id 更新（id 為 UUID；key 含 & 或改 key 時用此路徑）
app.put('/api/admin/custom-product-categories/by-id/:id', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const id = (req.params.id || '').trim();
        if (!id) return res.status(400).json({ error: '無效的 id' });
        const { key: newKeyRaw, name, name_en, prompt, sort_order, is_active } = req.body || {};
        const newKey = (newKeyRaw != null && String(newKeyRaw).trim()) ? String(newKeyRaw).trim().toLowerCase().replace(/\s+/g, '_') : null;
        const { data: row, error: fetchErr } = await supabase.from('custom_product_categories').select('*').eq('id', id).single();
        if (fetchErr || !row) {
            console.error('PUT by-id fetch:', fetchErr || 'no row', 'id=', id);
            return res.status(400).json({ error: '找不到此分類', details: fetchErr ? fetchErr.message : '查無該 id 的資料' });
        }
        const key = row.key;
        const isRename = newKey && newKey !== key;
        if (!isRename) {
            const updates = {};
            if (name !== undefined) updates.name = String(name).trim() || (newKey || key);
            if (name_en !== undefined) updates.name_en = name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null;
            for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) updates[col] = req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null;
            if (prompt !== undefined) updates.prompt = String(prompt);
            if (sort_order !== undefined) updates.sort_order = Number(sort_order);
            if (is_active !== undefined) updates.is_active = !!is_active;
            updates.updated_at = new Date().toISOString();
            const { error } = await supabase.from('custom_product_categories').update(updates).eq('id', id).select('key').maybeSingle();
            if (error) {
                if (error.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
                console.error('PUT by-id custom-product-categories:', error);
                return res.status(500).json({ error: '更新失敗', details: error.message });
            }
        } else {
            const insertRow = { ...row, key: newKey, updated_at: new Date().toISOString() };
            delete insertRow.id;
            if (name !== undefined) insertRow.name = String(name).trim() || newKey;
            if (prompt !== undefined) insertRow.prompt = String(prompt);
            if (sort_order !== undefined) insertRow.sort_order = Number(sort_order);
            if (is_active !== undefined) insertRow.is_active = !!is_active;
            if (row.hasOwnProperty('name_en')) insertRow.name_en = name_en !== undefined ? (name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null) : row.name_en;
            for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) {
                if (row.hasOwnProperty(col)) insertRow[col] = (req.body && req.body[col] !== undefined) ? (req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null) : row[col];
            }
            const { error: insertErr } = await supabase.from('custom_product_categories').insert(insertRow);
            if (insertErr) {
                if (insertErr.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
                return res.status(500).json({ error: '更新失敗', details: insertErr.message });
            }
            const { data: allSub } = await supabase.from('custom_product_subcategories').select('id, category_key');
            const subIds = (allSub || []).filter(s => s.category_key === key).map(s => s.id);
            if (subIds.length > 0) {
                const { error: subErr } = await supabase.from('custom_product_subcategories').update({ category_key: newKey, updated_at: new Date().toISOString() }).in('id', subIds);
                if (subErr) return res.status(500).json({ error: '更新子分類失敗', details: subErr.message });
            }
            const { error: delErr } = await supabase.from('custom_product_categories').delete().eq('id', id);
            if (delErr) return res.status(500).json({ error: '移除舊分類失敗', details: delErr.message });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PUT by-id custom-product-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤', details: e && e.message });
    }
});

// PUT /api/admin/custom-product-categories/:key — 更新一筆分類（body 可含 key 以修改 key）
// :key 可能含 & 等字元，Supabase 查詢 URL 會壞掉，改為「先 select 全表用 key 找 id，再依 id 更新」
app.put('/api/admin/custom-product-categories/:key', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const rawParam = req.params.key || '';
        let key;
        try { key = decodeURIComponent(rawParam).trim(); } catch (_) { key = rawParam.trim(); }
        if (!key) return res.status(400).json({ error: '缺少 key' });
        const { key: newKeyRaw, name, name_en, prompt, sort_order, is_active } = req.body || {};
        const updates = {};
        const newKey = (newKeyRaw != null && String(newKeyRaw).trim()) ? String(newKeyRaw).trim().toLowerCase().replace(/\s+/g, '_') : null;
        const isRename = newKey && newKey !== key;
        // 依 key 解析出主分類列（不把 key 放進 Supabase URL，避免 & 斷開）
        const { data: allMain, error: selectErr } = await supabase.from('custom_product_categories').select('id, key').limit(5000);
        if (selectErr) {
            console.error('PUT /api/admin/custom-product-categories select:', selectErr);
            return res.status(500).json({ error: '查詢分類失敗', details: selectErr.message });
        }
        const list = allMain || [];
        const row = list.find(r => r.key === key);
        if (!row) return res.status(400).json({ error: '找不到此分類（請用編輯鈕從列表開啟再儲存）' });
        if (!isRename) {
            if (name !== undefined) updates.name = String(name).trim() || (newKey || key);
            if (name_en !== undefined) updates.name_en = name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null;
            for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) updates[col] = req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null;
            if (prompt !== undefined) updates.prompt = String(prompt);
            if (sort_order !== undefined) updates.sort_order = Number(sort_order);
            if (is_active !== undefined) updates.is_active = !!is_active;
            updates.updated_at = new Date().toISOString();
            let { data: updatedRow, error } = await supabase.from('custom_product_categories').update(updates).eq('id', row.id).select('key').maybeSingle();
            const isColumnMissing = error && (error.code === '42703' || error.code === 'PGRST204' || (error.message && /column.*does not exist|Could not find.*column|schema cache|name_en|name_ja|name_de|name_es|name_fr/.test(error.message)));
            if (error && isColumnMissing) {
                const baseUpdates = { updated_at: updates.updated_at };
                if (name !== undefined) baseUpdates.name = String(name).trim() || key;
                if (prompt !== undefined) baseUpdates.prompt = String(prompt);
                if (sort_order !== undefined) baseUpdates.sort_order = Number(sort_order);
                if (is_active !== undefined) baseUpdates.is_active = !!is_active;
                const fallback = await supabase.from('custom_product_categories').update(baseUpdates).eq('id', row.id).select('key').maybeSingle();
                error = fallback.error;
                updatedRow = fallback.data;
                if (error) {
                    console.error('PUT /api/admin/custom-product-categories:', error);
                    return res.status(500).json({ error: '更新失敗。若需多語系欄位，請在 Supabase 執行 docs/add-custom-product-categories-multilang.sql' });
                }
            }
            if (error) {
                if (error.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
                if (error.code === '23503') return res.status(400).json({ error: '無法更新：尚有子分類引用此主分類', details: error.message });
                console.error('PUT /api/admin/custom-product-categories:', error);
                return res.status(500).json({ error: '更新失敗', details: error.message || error.code });
            }
        } else {
            // 改 key：先取完整列（上面 row 只有 id, key，需再取一筆完整或沿用 allMain 無完整欄位，故再查一次用 id）
            const { data: fullRow, error: fetchErr } = await supabase.from('custom_product_categories').select('*').eq('id', row.id).single();
            if (fetchErr || !fullRow) {
                console.error('PUT /api/admin/custom-product-categories fetch:', fetchErr);
                return res.status(500).json({ error: '查無此分類', details: fetchErr && fetchErr.message });
            }
            const insertRow = { ...fullRow, key: newKey, updated_at: new Date().toISOString() };
            if (name !== undefined) insertRow.name = String(name).trim() || newKey;
            if (prompt !== undefined) insertRow.prompt = String(prompt);
            if (sort_order !== undefined) insertRow.sort_order = Number(sort_order);
            if (is_active !== undefined) insertRow.is_active = !!is_active;
            if (fullRow.hasOwnProperty('name_en')) insertRow.name_en = name_en !== undefined ? (name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null) : fullRow.name_en;
            for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) {
                if (fullRow.hasOwnProperty(col)) insertRow[col] = (req.body && req.body[col] !== undefined) ? (req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null) : fullRow[col];
            }
            const { error: insertErr } = await supabase.from('custom_product_categories').insert(insertRow);
            if (insertErr) {
                if (insertErr.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
                console.error('PUT /api/admin/custom-product-categories insert:', insertErr);
                return res.status(500).json({ error: '更新失敗', details: insertErr.message });
            }
            // 子分類的 category_key 要改成 newKey；不把 key 放 URL，改為先撈出該主分類下的子分類 id 再依 id 更新
            const { data: allSub } = await supabase.from('custom_product_subcategories').select('id, category_key');
            const subIds = (allSub || []).filter(s => s.category_key === key).map(s => s.id);
            if (subIds.length > 0) {
                const { error: subErr } = await supabase.from('custom_product_subcategories').update({ category_key: newKey, updated_at: new Date().toISOString() }).in('id', subIds);
                if (subErr) {
                    console.error('PUT /api/admin/custom-product-categories subcategories:', subErr);
                    return res.status(500).json({ error: '更新子分類失敗', details: subErr.message });
                }
            }
            const { error: delErr } = await supabase.from('custom_product_categories').delete().eq('id', row.id);
            if (delErr) {
                console.error('PUT /api/admin/custom-product-categories delete old:', delErr);
                return res.status(500).json({ error: '移除舊分類失敗', details: delErr.message });
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PUT /api/admin/custom-product-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤', details: e && e.message ? e.message : undefined });
    }
});

// POST /api/admin/custom-product-categories/:key/move-subcategories — 將此主分類下所有子分類移至另一主分類（body: { target_key }）
app.post('/api/admin/custom-product-categories/:key/move-subcategories', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let key = req.params.key;
        try { key = decodeURIComponent(key || ''); } catch (_) { key = req.params.key || ''; }
        if (!key) return res.status(400).json({ error: '缺少 key' });
        const targetKey = (req.body && req.body.target_key != null) ? String(req.body.target_key).trim() : '';
        if (!targetKey) return res.status(400).json({ error: '請提供 target_key' });
        if (targetKey === key) return res.status(400).json({ error: '目標主分類不可與來源相同' });
        const { data: allMain } = await supabase.from('custom_product_categories').select('id, key');
        if (!(allMain || []).find(r => r.key === targetKey)) return res.status(400).json({ error: '目標主分類不存在', details: targetKey });
        const { data: allSub } = await supabase.from('custom_product_subcategories').select('id, category_key');
        const subIds = (allSub || []).filter(s => s.category_key === key).map(s => s.id);
        if (subIds.length === 0) { res.json({ success: true, moved: 0 }); return; }
        const { data: updated, error } = await supabase.from('custom_product_subcategories').update({ category_key: targetKey, updated_at: new Date().toISOString() }).in('id', subIds).select('id');
        if (error) {
            console.error('POST move-subcategories:', error);
            return res.status(500).json({ error: '移動失敗', details: error.message });
        }
        res.json({ success: true, moved: (updated || []).length });
    } catch (e) {
        console.error('POST move-subcategories 異常:', e);
        res.status(500).json({ error: '系統錯誤', details: e && e.message ? e.message : undefined });
    }
});

// DELETE /api/admin/custom-product-categories/:key — 停用（預設）或永久刪除（?permanent=1）
app.delete('/api/admin/custom-product-categories/:key', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let key = req.params.key;
        try { key = decodeURIComponent(key || ''); } catch (_) { key = req.params.key || ''; }
        if (!key) return res.status(400).json({ error: '缺少 key' });
        const { data: allMain } = await supabase.from('custom_product_categories').select('id, key');
        const row = (allMain || []).find(r => r.key === key);
        if (!row) return res.status(400).json({ error: '找不到此分類' });
        const permanent = req.query.permanent === '1' || req.query.permanent === 'true';
        if (permanent) {
            const { error } = await supabase.from('custom_product_categories').delete().eq('id', row.id);
            if (error) {
                console.error('DELETE /api/admin/custom-product-categories:', error);
                return res.status(500).json({ error: '刪除失敗' });
            }
        } else {
            const { error } = await supabase.from('custom_product_categories').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', row.id);
            if (error) {
                console.error('DELETE /api/admin/custom-product-categories:', error);
                return res.status(500).json({ error: '停用失敗' });
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/admin/custom-product-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ——— 訂製品子分類（admin） ———
// POST /api/admin/custom-product-subcategories — 新增子分類
app.post('/api/admin/custom-product-subcategories', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const { category_key, key, name, name_en, prompt, sort_order } = req.body || {};
        if (!category_key || !String(category_key).trim()) return res.status(400).json({ error: '請填寫 category_key' });
        if (!key || !String(key).trim()) return res.status(400).json({ error: '請填寫 key' });
        const cKey = String(category_key).trim();
        const k = String(key).trim().toLowerCase().replace(/\s+/g, '_');
        const { data: mainRow } = await supabase.from('custom_product_categories').select('key').eq('key', cKey).maybeSingle();
        if (!mainRow) return res.status(400).json({ error: '主分類不存在', received_key: cKey });
        const payload = {
            category_key: cKey,
            key: k,
            name: (name && String(name).trim()) || k,
            prompt: prompt != null ? String(prompt) : '',
            sort_order: sort_order != null ? Number(sort_order) : 0,
            is_active: true
        };
        if (name_en !== undefined) payload.name_en = name_en != null ? String(name_en).trim() : null;
        for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) payload[col] = req.body[col] != null ? String(req.body[col]).trim() : null;
        let error = (await supabase.from('custom_product_subcategories').insert(payload)).error;
        if (error && (error.code === '42703' || (error.message && /column.*does not exist|name_en|name_ja/.test(error.message)))) {
            const basePayload = { category_key: cKey, key: k, name: (name && String(name).trim()) || k, prompt: prompt != null ? String(prompt) : '', sort_order: sort_order != null ? Number(sort_order) : 0, is_active: true };
            error = (await supabase.from('custom_product_subcategories').insert(basePayload)).error;
        }
        if (error) {
            if (error.code === '23503') return res.status(400).json({ error: '主分類不存在', received_key: cKey });
            if (error.code === '23505') return res.status(400).json({ error: '此主分類下已存在相同 key 的子分類' });
            console.error('POST /api/admin/custom-product-subcategories:', error);
            return res.status(500).json({ error: '新增失敗' });
        }
        res.status(201).json({ success: true });
    } catch (e) {
        console.error('POST /api/admin/custom-product-subcategories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PUT /api/admin/custom-product-subcategories/:category_key/:key — 更新子分類（body 可含 key 以修改 key）
// :category_key/:key 可能含 &，不把 key 放 Supabase URL，改為先 select 全表用 (category_key,key) 找 id 再依 id 更新
app.put('/api/admin/custom-product-subcategories/:category_key/:key', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let category_key = req.params.category_key;
        let key = req.params.key;
        try { category_key = decodeURIComponent(category_key || ''); } catch (_) {}
        try { key = decodeURIComponent(key || ''); } catch (_) {}
        if (!category_key || !key) return res.status(400).json({ error: '缺少參數' });
        const { data: allSub } = await supabase.from('custom_product_subcategories').select('id, category_key, key');
        const subRow = (allSub || []).find(s => s.category_key === category_key && s.key === key);
        if (!subRow) return res.status(400).json({ error: '找不到此子分類' });
        const { key: newKeyRaw, name, name_en, prompt, sort_order, is_active } = req.body || {};
        const updates = {};
        const newKey = (newKeyRaw != null && String(newKeyRaw).trim()) ? String(newKeyRaw).trim().toLowerCase().replace(/\s+/g, '_') : null;
        if (newKey && newKey !== key) updates.key = newKey;
        if (name !== undefined) updates.name = String(name).trim() || (newKey || key);
        if (name_en !== undefined) updates.name_en = name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null;
        for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) updates[col] = req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null;
        if (prompt !== undefined) updates.prompt = String(prompt);
        if (sort_order !== undefined) {
            const n = Number(sort_order);
            updates.sort_order = Number.isFinite(n) ? n : 0;
        }
        if (is_active !== undefined) updates.is_active = !!is_active;
        updates.updated_at = new Date().toISOString();
        const updatePayload = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
        let { error } = await supabase.from('custom_product_subcategories').update(updatePayload).eq('id', subRow.id);
        const isColumnMissing = error && (
            error.code === '42703' || error.code === 'PGRST204' ||
            (error.message && /column.*does not exist|Could not find.*column|schema cache|name_en|name_ja|name_de|name_es|name_fr/.test(error.message))
        );
        if (error && isColumnMissing) {
            const baseUpdates = { updated_at: updates.updated_at };
            if (updates.key !== undefined) baseUpdates.key = updates.key;
            if (name !== undefined) baseUpdates.name = String(name).trim() || (newKey || key);
            if (prompt !== undefined) baseUpdates.prompt = String(prompt);
            if (sort_order !== undefined) baseUpdates.sort_order = Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0;
            if (is_active !== undefined) baseUpdates.is_active = !!is_active;
            error = (await supabase.from('custom_product_subcategories').update(baseUpdates).eq('id', subRow.id)).error;
            if (error) {
                console.error('PUT /api/admin/custom-product-subcategories fallback:', error);
                return res.status(500).json({ error: '更新失敗：' + (error.message || '若需多語系欄位請執行 docs/add-custom-product-categories-multilang.sql') });
            }
        } else if (error) {
            if (error.code === '23505') return res.status(400).json({ error: '此主分類下已存在相同 key 的子分類' });
            console.error('PUT /api/admin/custom-product-subcategories:', error);
            return res.status(500).json({ error: '更新失敗：' + (error.message || '請查看伺服器日誌') });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PUT /api/admin/custom-product-subcategories 異常:', e);
        res.status(500).json({ error: '系統錯誤：' + (e && e.message) });
    }
});

// DELETE /api/admin/custom-product-subcategories/:category_key/:key — 停用或永久刪除（?permanent=1）
app.delete('/api/admin/custom-product-subcategories/:category_key/:key', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let category_key = req.params.category_key;
        let key = req.params.key;
        try { category_key = decodeURIComponent(category_key || ''); } catch (_) {}
        try { key = decodeURIComponent(key || ''); } catch (_) {}
        if (!category_key || !key) return res.status(400).json({ error: '缺少參數' });
        const { data: allSub } = await supabase.from('custom_product_subcategories').select('id, category_key, key');
        const subRow = (allSub || []).find(s => s.category_key === category_key && s.key === key);
        if (!subRow) return res.status(400).json({ error: '找不到此子分類' });
        const permanent = req.query.permanent === '1' || req.query.permanent === 'true';
        if (permanent) {
            const { error } = await supabase.from('custom_product_subcategories').delete().eq('id', subRow.id);
            if (error) {
                console.error('DELETE /api/admin/custom-product-subcategories:', error);
                return res.status(500).json({ error: '刪除失敗' });
            }
        } else {
            const { error } = await supabase.from('custom_product_subcategories').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', subRow.id);
            if (error) {
                console.error('DELETE /api/admin/custom-product-subcategories:', error);
                return res.status(500).json({ error: '停用失敗' });
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/admin/custom-product-subcategories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ——— 設計風向分類（remake 表）：公開 API ———
// GET /api/remake-categories — 設計風向主分類＋子分類（僅啟用），供前台下拉；支援 ?lang=en|ja|es|de|fr 多語系
const REMake_CAT_LOCALE_COL = { en: 'name_en', ja: 'name_ja', es: 'name_es', de: 'name_de', fr: 'name_fr' };
app.get('/api/remake-categories', async (req, res) => {
    try {
        const lang = (req.query.lang || '').toLowerCase().replace(/-.*$/, '');
        const localeCol = REMake_CAT_LOCALE_COL[lang];
        let list = [];
        let mainRes = await supabase.from('remake_categories').select('id, key, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order, is_active').eq('is_active', true).order('sort_order', { ascending: true });
        if (mainRes.error && (mainRes.error.code === '42703' || (mainRes.error.message && /column.*does not exist|name_en/.test(mainRes.error.message)))) {
            mainRes = await supabase.from('remake_categories').select('id, key, name, prompt, sort_order, is_active').eq('is_active', true).order('sort_order', { ascending: true });
        }
        if (mainRes.error) {
            console.error('GET /api/remake-categories:', mainRes.error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        list = mainRes.data || [];
        const keys = list.map(c => c.key);
        let subMap = {};
        if (keys.length > 0) {
            let subRes = await supabase.from('remake_subcategories').select('id, category_key, key, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order').in('category_key', keys).eq('is_active', true).order('sort_order', { ascending: true });
            if (subRes.error && (subRes.error.code === '42703' || (subRes.error.message && /column.*does not exist|name_en/.test(subRes.error.message)))) {
                subRes = await supabase.from('remake_subcategories').select('id, category_key, key, name, prompt, sort_order').in('category_key', keys).eq('is_active', true).order('sort_order', { ascending: true });
            }
            const subs = subRes.data || [];
            subs.forEach(s => {
                if (!subMap[s.category_key]) subMap[s.category_key] = [];
                let subName = s.name;
                if (s.name_en && lang === 'en') subName = s.name_en;
                else if (localeCol && s[localeCol]) subName = s[localeCol];
                subMap[s.category_key].push({ id: s.id, key: s.key, name: subName, prompt: s.prompt || '', sort_order: s.sort_order });
            });
        }
        if ((lang === 'en' || localeCol) && list.length && (list[0].name_en != null || (localeCol && list[0][localeCol] != null))) {
            list = list.map(c => {
                const displayName = (lang === 'en' && c.name_en) ? c.name_en : (localeCol && c[localeCol]) ? c[localeCol] : c.name;
                return { ...c, name: displayName };
            });
        }
        const categories = list.map(c => ({ ...c, prompt: c.prompt || '', subcategories: subMap[c.key] || [] }));
        res.json({ categories });
    } catch (e) {
        console.error('GET /api/remake-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ——— 設計風向分類：後台 API ———
app.get('/api/admin/remake-categories', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let list = [];
        const mainRes = await supabase.from('remake_categories').select('id, key, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order, is_active, created_at').order('sort_order', { ascending: true }).order('key', { ascending: true });
        if (mainRes.error && (mainRes.error.code === '42703' || (mainRes.error.message && /column.*does not exist|name_en/.test(mainRes.error.message)))) {
            const fallback = await supabase.from('remake_categories').select('id, key, name, prompt, sort_order, is_active, created_at').order('sort_order', { ascending: true }).order('key', { ascending: true });
            if (fallback.error) {
                console.error('GET /api/admin/remake-categories:', fallback.error);
                return res.status(500).json({ error: '查詢失敗' });
            }
            list = (fallback.data || []).map(c => ({ ...c, name_en: '', name_ja: '', name_es: '', name_de: '', name_fr: '' }));
        } else if (mainRes.error) {
            console.error('GET /api/admin/remake-categories:', mainRes.error);
            return res.status(500).json({ error: '查詢失敗' });
        } else {
            list = (mainRes.data || []).map(c => ({ ...c, name_en: c.name_en || '', name_ja: c.name_ja || '', name_es: c.name_es || '', name_de: c.name_de || '', name_fr: c.name_fr || '' }));
        }
        const keys = list.map(c => c.key);
        let subMap = {};
        if (keys.length > 0) {
            const subRes = await supabase.from('remake_subcategories').select('id, category_key, key, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order, is_active').in('category_key', keys).order('sort_order', { ascending: true });
            let subs = subRes.data || [];
            if (subRes.error && (subRes.error.code === '42703' || (subRes.error.message && /column.*does not exist|name_en/.test(subRes.error.message)))) {
                const subFallback = await supabase.from('remake_subcategories').select('id, category_key, key, name, prompt, sort_order, is_active').in('category_key', keys).order('sort_order', { ascending: true });
                subs = (subFallback.data || []).map(s => ({ ...s, name_en: '', name_ja: '', name_es: '', name_de: '', name_fr: '' }));
            } else {
                subs = subs.map(s => ({ ...s, name_en: s.name_en || '', name_ja: s.name_ja || '', name_es: s.name_es || '', name_de: s.name_de || '', name_fr: s.name_fr || '' }));
            }
            subs.forEach(s => {
                if (!subMap[s.category_key]) subMap[s.category_key] = [];
                subMap[s.category_key].push({ id: s.id, key: s.key, name: s.name, name_en: s.name_en || '', name_ja: s.name_ja || '', name_es: s.name_es || '', name_de: s.name_de || '', name_fr: s.name_fr || '', prompt: s.prompt || '', sort_order: s.sort_order, is_active: s.is_active });
            });
        }
        const categories = list.map(c => ({ ...c, prompt: c.prompt || '', subcategories: subMap[c.key] || [] }));
        res.json({ categories });
    } catch (e) {
        console.error('GET /api/admin/remake-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.post('/api/admin/remake-categories', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const { key, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order } = req.body || {};
        if (!key || !String(key).trim()) return res.status(400).json({ error: '請填寫 key' });
        const k = String(key).trim().toLowerCase().replace(/\s+/g, '_');
        const payload = {
            key: k,
            name: (name && String(name).trim()) || k,
            prompt: prompt != null ? String(prompt) : '',
            sort_order: sort_order != null ? Number(sort_order) : 0,
            is_active: true
        };
        if (name_en !== undefined) payload.name_en = name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null;
        for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) payload[col] = req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null;
        let error = (await supabase.from('remake_categories').insert(payload)).error;
        if (error && (error.code === '42703' || (error.message && /column.*does not exist|name_en|name_ja/.test(error.message)))) {
            const basePayload = { key: k, name: (name && String(name).trim()) || k, prompt: prompt != null ? String(prompt) : '', sort_order: sort_order != null ? Number(sort_order) : 0, is_active: true };
            error = (await supabase.from('remake_categories').insert(basePayload)).error;
        }
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
            console.error('POST /api/admin/remake-categories:', error);
            return res.status(500).json({ error: '新增失敗。若需多語系請執行 docs/add-remake-categories-multilang.sql' });
        }
        res.status(201).json({ success: true });
    } catch (e) {
        console.error('POST /api/admin/remake-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// :key 可能含 &，不把 key 放 Supabase URL，改為先 select 全表用 key 找 id 再依 id 更新
app.put('/api/admin/remake-categories/:key', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let key = req.params.key;
        try { key = decodeURIComponent(key || ''); } catch (_) { key = req.params.key || ''; }
        if (!key) return res.status(400).json({ error: '缺少 key' });
        const { data: allMain } = await supabase.from('remake_categories').select('id, key');
        const row = (allMain || []).find(r => r.key === key);
        if (!row) return res.status(400).json({ error: '找不到此分類' });
        const { key: newKeyRaw, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order, is_active } = req.body || {};
        const newKey = (newKeyRaw != null && String(newKeyRaw).trim()) ? String(newKeyRaw).trim().toLowerCase().replace(/\s+/g, '_') : null;
        const isRename = newKey && newKey !== key;
        if (!isRename) {
            const updates = {};
            if (name !== undefined) updates.name = String(name).trim() || key;
            if (name_en !== undefined) updates.name_en = name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null;
            for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) updates[col] = req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null;
            if (prompt !== undefined) updates.prompt = String(prompt);
            if (sort_order !== undefined) updates.sort_order = Number(sort_order);
            if (is_active !== undefined) updates.is_active = !!is_active;
            updates.updated_at = new Date().toISOString();
            let error = (await supabase.from('remake_categories').update(updates).eq('id', row.id)).error;
            const isColumnMissingRemake = error && (error.code === '42703' || error.code === 'PGRST204' || (error.message && /column.*does not exist|Could not find.*column|schema cache|name_en|name_ja|name_de|name_es|name_fr/.test(error.message)));
            if (error && isColumnMissingRemake) {
                const baseUpdates = { updated_at: updates.updated_at };
                if (name !== undefined) baseUpdates.name = String(name).trim() || key;
                if (prompt !== undefined) baseUpdates.prompt = String(prompt);
                if (sort_order !== undefined) baseUpdates.sort_order = Number(sort_order);
                if (is_active !== undefined) baseUpdates.is_active = !!is_active;
                error = (await supabase.from('remake_categories').update(baseUpdates).eq('id', row.id)).error;
                if (error) {
                    console.error('PUT /api/admin/remake-categories:', error);
                    return res.status(500).json({ error: '更新失敗。若需多語系欄位，請在 Supabase 執行 docs/add-remake-categories-multilang.sql' });
                }
            } else if (error) {
                if (error.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
                if (error.code === '23503') return res.status(400).json({ error: '無法更新：尚有子分類引用此主分類', details: error.message });
                console.error('PUT /api/admin/remake-categories:', error);
                return res.status(500).json({ error: '更新失敗', details: error.message || error.code });
            }
        } else {
            const { data: fullRow, error: fetchErr } = await supabase.from('remake_categories').select('*').eq('id', row.id).single();
            if (fetchErr || !fullRow) {
                console.error('PUT /api/admin/remake-categories fetch:', fetchErr);
                return res.status(500).json({ error: '查無此分類', details: fetchErr && fetchErr.message });
            }
            const insertRow = { ...fullRow, key: newKey, updated_at: new Date().toISOString() };
            if (name !== undefined) insertRow.name = String(name).trim() || newKey;
            if (prompt !== undefined) insertRow.prompt = String(prompt);
            if (sort_order !== undefined) insertRow.sort_order = Number(sort_order);
            if (is_active !== undefined) insertRow.is_active = !!is_active;
            if (fullRow.hasOwnProperty('name_en')) insertRow.name_en = name_en !== undefined ? (name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null) : fullRow.name_en;
            for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) {
                if (fullRow.hasOwnProperty(col)) insertRow[col] = (req.body && req.body[col] !== undefined) ? (req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null) : fullRow[col];
            }
            const { error: insertErr } = await supabase.from('remake_categories').insert(insertRow);
            if (insertErr) {
                if (insertErr.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
                console.error('PUT /api/admin/remake-categories insert:', insertErr);
                return res.status(500).json({ error: '更新失敗', details: insertErr.message });
            }
            const { data: allSub } = await supabase.from('remake_subcategories').select('id, category_key');
            const subIds = (allSub || []).filter(s => s.category_key === key).map(s => s.id);
            if (subIds.length > 0) {
                const { error: subErr } = await supabase.from('remake_subcategories').update({ category_key: newKey, updated_at: new Date().toISOString() }).in('id', subIds);
                if (subErr) {
                    console.error('PUT /api/admin/remake-categories subcategories:', subErr);
                    return res.status(500).json({ error: '更新子分類失敗', details: subErr.message });
                }
            }
            const { error: delErr } = await supabase.from('remake_categories').delete().eq('id', row.id);
            if (delErr) {
                console.error('PUT /api/admin/remake-categories delete old:', delErr);
                return res.status(500).json({ error: '移除舊分類失敗', details: delErr.message });
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PUT /api/admin/remake-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤', details: e && e.message ? e.message : undefined });
    }
});

// DELETE /api/admin/remake-categories/:key — 停用或永久刪除（?permanent=1）
app.delete('/api/admin/remake-categories/:key', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let key = req.params.key;
        try { key = decodeURIComponent(key || ''); } catch (_) { key = req.params.key || ''; }
        if (!key) return res.status(400).json({ error: '缺少 key' });
        const { data: allMain } = await supabase.from('remake_categories').select('id, key');
        const row = (allMain || []).find(r => r.key === key);
        if (!row) return res.status(400).json({ error: '找不到此分類' });
        const permanent = req.query.permanent === '1' || req.query.permanent === 'true';
        if (permanent) {
            const { error } = await supabase.from('remake_categories').delete().eq('id', row.id);
            if (error) {
                console.error('DELETE /api/admin/remake-categories:', error);
                return res.status(500).json({ error: '刪除失敗' });
            }
        } else {
            const { error } = await supabase.from('remake_categories').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', row.id);
            if (error) {
                console.error('DELETE /api/admin/remake-categories:', error);
                return res.status(500).json({ error: '停用失敗' });
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/admin/remake-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.post('/api/admin/remake-subcategories', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const { category_key, key, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order } = req.body || {};
        if (!category_key || !String(category_key).trim()) return res.status(400).json({ error: '請填寫 category_key' });
        if (!key || !String(key).trim()) return res.status(400).json({ error: '請填寫 key' });
        const cKey = String(category_key).trim();
        const k = String(key).trim().toLowerCase().replace(/\s+/g, '_');
        const payload = {
            category_key: cKey,
            key: k,
            name: (name && String(name).trim()) || k,
            prompt: prompt != null ? String(prompt) : '',
            sort_order: sort_order != null ? Number(sort_order) : 0,
            is_active: true
        };
        if (name_en !== undefined) payload.name_en = name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null;
        for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) payload[col] = req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null;
        let error = (await supabase.from('remake_subcategories').insert(payload)).error;
        if (error && (error.code === '42703' || (error.message && /column.*does not exist|name_en|name_ja/.test(error.message)))) {
            const basePayload = { category_key: cKey, key: k, name: (name && String(name).trim()) || k, prompt: prompt != null ? String(prompt) : '', sort_order: sort_order != null ? Number(sort_order) : 0, is_active: true };
            error = (await supabase.from('remake_subcategories').insert(basePayload)).error;
        }
        if (error) {
            if (error.code === '23503') return res.status(400).json({ error: '主分類不存在' });
            if (error.code === '23505') return res.status(400).json({ error: '此主分類下已存在相同 key 的子分類' });
            console.error('POST /api/admin/remake-subcategories:', error);
            return res.status(500).json({ error: '新增失敗' });
        }
        res.status(201).json({ success: true });
    } catch (e) {
        console.error('POST /api/admin/remake-subcategories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.put('/api/admin/remake-subcategories/:category_key/:key', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let category_key = req.params.category_key;
        let key = req.params.key;
        try { category_key = decodeURIComponent(category_key || ''); } catch (_) {}
        try { key = decodeURIComponent(key || ''); } catch (_) {}
        if (!category_key || !key) return res.status(400).json({ error: '缺少參數' });
        const { data: allSub } = await supabase.from('remake_subcategories').select('id, category_key, key');
        const subRow = (allSub || []).find(s => s.category_key === category_key && s.key === key);
        if (!subRow) return res.status(400).json({ error: '找不到此子分類' });
        const { key: newKey, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order, is_active } = req.body || {};
        const updates = {};
        const keyToWrite = (newKey != null && String(newKey).trim()) ? String(newKey).trim().toLowerCase().replace(/\s+/g, '_') : key;
        if (keyToWrite !== key) {
            if ((allSub || []).some(s => s.category_key === category_key && s.key === keyToWrite)) return res.status(400).json({ error: '此主分類下已存在相同 key' });
            updates.key = keyToWrite;
        }
        if (name !== undefined) updates.name = String(name).trim() || keyToWrite;
        if (name_en !== undefined) updates.name_en = name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null;
        for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) updates[col] = req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null;
        if (prompt !== undefined) updates.prompt = String(prompt);
        if (sort_order !== undefined) updates.sort_order = Number(sort_order);
        if (is_active !== undefined) updates.is_active = !!is_active;
        updates.updated_at = new Date().toISOString();
        let error = (await supabase.from('remake_subcategories').update(updates).eq('id', subRow.id)).error;
        const isColumnMissingRemakeSub = error && (error.code === '42703' || error.code === 'PGRST204' || (error.message && /column.*does not exist|Could not find.*column|schema cache|name_en|name_ja|name_de|name_es|name_fr/.test(error.message)));
        if (error && isColumnMissingRemakeSub) {
            const baseUpdates = { updated_at: updates.updated_at };
            if (updates.key) baseUpdates.key = updates.key;
            if (name !== undefined) baseUpdates.name = String(name).trim() || keyToWrite;
            if (prompt !== undefined) baseUpdates.prompt = String(prompt);
            if (sort_order !== undefined) baseUpdates.sort_order = Number(sort_order);
            if (is_active !== undefined) baseUpdates.is_active = !!is_active;
            error = (await supabase.from('remake_subcategories').update(baseUpdates).eq('id', subRow.id)).error;
            if (error) {
                console.error('PUT /api/admin/remake-subcategories:', error);
                return res.status(500).json({ error: '更新失敗。若需多語系欄位，請執行 docs/add-remake-categories-multilang.sql' });
            }
        } else if (error) {
            console.error('PUT /api/admin/remake-subcategories:', error);
            return res.status(500).json({ error: '更新失敗' });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PUT /api/admin/remake-subcategories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/admin/remake-subcategories/:category_key/:key — 停用或永久刪除（?permanent=1）
app.delete('/api/admin/remake-subcategories/:category_key/:key', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let category_key = req.params.category_key;
        let key = req.params.key;
        try { category_key = decodeURIComponent(category_key || ''); } catch (_) {}
        try { key = decodeURIComponent(key || ''); } catch (_) {}
        if (!category_key || !key) return res.status(400).json({ error: '缺少參數' });
        const { data: allSub } = await supabase.from('remake_subcategories').select('id, category_key, key');
        const subRow = (allSub || []).find(s => s.category_key === category_key && s.key === key);
        if (!subRow) return res.status(400).json({ error: '找不到此子分類' });
        const permanent = req.query.permanent === '1' || req.query.permanent === 'true';
        if (permanent) {
            const { error } = await supabase.from('remake_subcategories').delete().eq('id', subRow.id);
            if (error) {
                console.error('DELETE /api/admin/remake-subcategories:', error);
                return res.status(500).json({ error: '刪除失敗' });
            }
        } else {
            const { error } = await supabase.from('remake_subcategories').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', subRow.id);
            if (error) {
                console.error('DELETE /api/admin/remake-subcategories:', error);
                return res.status(500).json({ error: '停用失敗' });
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/admin/remake-subcategories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ─────────────────────────────────────────────────────────────
// 後台：對話紀錄查詢（交易爭議調閱用）
// ─────────────────────────────────────────────────────────────

// GET /api/admin/conversations — 列出所有對話（可依關鍵字、日期篩選）
app.get('/api/admin/conversations', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res);
        if (!admin) return;
        const { q, from, to, page = 1, per = 30 } = req.query;
        const offset = (Math.max(1, Number(page)) - 1) * Number(per);

        // 查詢對話（含雙方 user_id）
        let query = supabase.from('direct_conversations')
            .select('id, user_a_id, user_b_id, updated_at, created_at', { count: 'exact' })
            .order('updated_at', { ascending: false })
            .range(offset, offset + Number(per) - 1);
        if (from) query = query.gte('updated_at', from);
        if (to)   query = query.lte('updated_at', to + 'T23:59:59Z');
        const { data: convos, count, error } = await query;
        if (error) return res.status(500).json({ error: '查詢失敗' });

        // 蒐集所有 user_id
        const allUids = [...new Set((convos || []).flatMap(c => [c.user_a_id, c.user_b_id]))];
        // 從 manufacturers 取廠商名稱
        const { data: mfrs } = await supabase.from('manufacturers').select('user_id, name').in('user_id', allUids);
        const mfrMap = {};
        (mfrs || []).forEach(m => { if (m.user_id) mfrMap[m.user_id] = m.name; });
        // 從 auth.users 取 email/name（逐一查，僅查缺少的）
        const nameMap = { ...mfrMap };
        for (const uid of allUids) {
            if (!nameMap[uid]) {
                try {
                    const { data: au } = await supabase.auth.admin.getUserById(uid);
                    nameMap[uid] = au?.user?.user_metadata?.full_name || au?.user?.email || uid.slice(0, 8);
                } catch (_) { nameMap[uid] = uid.slice(0, 8); }
            }
        }
        // 最後一則訊息 + 訊息總數
        const convIds = (convos || []).map(c => c.id);
        const { data: allMsgs } = await supabase.from('direct_messages')
            .select('conversation_id, body, image_url, created_at')
            .in('conversation_id', convIds)
            .order('created_at', { ascending: false });
        const lastMsg = {}, msgCount = {};
        (allMsgs || []).forEach(m => {
            msgCount[m.conversation_id] = (msgCount[m.conversation_id] || 0) + 1;
            if (!lastMsg[m.conversation_id]) lastMsg[m.conversation_id] = m;
        });

        // 若有關鍵字，以 user name 過濾
        let result = (convos || []).map(c => ({
            id: c.id,
            user_a: { id: c.user_a_id, name: nameMap[c.user_a_id] || c.user_a_id },
            user_b: { id: c.user_b_id, name: nameMap[c.user_b_id] || c.user_b_id },
            message_count: msgCount[c.id] || 0,
            last_message: lastMsg[c.id] ? { body: lastMsg[c.id].body || (lastMsg[c.id].image_url ? '（圖片）' : ''), created_at: lastMsg[c.id].created_at } : null,
            updated_at: c.updated_at,
            created_at: c.created_at
        }));
        if (q) {
            const kw = q.toLowerCase();
            result = result.filter(r =>
                r.user_a.name.toLowerCase().includes(kw) ||
                r.user_b.name.toLowerCase().includes(kw) ||
                (r.last_message?.body || '').toLowerCase().includes(kw)
            );
        }
        res.json({ conversations: result, total: count || result.length, page: Number(page), per: Number(per) });
    } catch (e) {
        console.error('GET /api/admin/conversations 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/conversations/:id/messages — 查看單一對話完整訊息紀錄
app.get('/api/admin/conversations/:convId/messages', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res);
        if (!admin) return;
        const { convId } = req.params;
        const { data: conv } = await supabase.from('direct_conversations').select('id, user_a_id, user_b_id, created_at, updated_at').eq('id', convId).maybeSingle();
        if (!conv) return res.status(404).json({ error: '找不到對話' });
        // 取雙方名稱
        const uids = [conv.user_a_id, conv.user_b_id];
        const { data: mfrs } = await supabase.from('manufacturers').select('user_id, name').in('user_id', uids);
        const nameMap = {};
        (mfrs || []).forEach(m => { if (m.user_id) nameMap[m.user_id] = m.name; });
        for (const uid of uids) {
            if (!nameMap[uid]) {
                try {
                    const { data: au } = await supabase.auth.admin.getUserById(uid);
                    nameMap[uid] = au?.user?.user_metadata?.full_name || au?.user?.email || uid.slice(0, 8);
                } catch (_) { nameMap[uid] = uid.slice(0, 8); }
            }
        }
        const { data: msgs } = await supabase.from('direct_messages')
            .select('id, sender_id, body, image_url, created_at')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true });
        res.json({
            conversation: {
                id: conv.id,
                user_a: { id: conv.user_a_id, name: nameMap[conv.user_a_id] },
                user_b: { id: conv.user_b_id, name: nameMap[conv.user_b_id] },
                created_at: conv.created_at, updated_at: conv.updated_at
            },
            messages: (msgs || []).map(m => ({
                id: m.id, sender_id: m.sender_id,
                sender_name: nameMap[m.sender_id] || m.sender_id.slice(0, 8),
                body: m.body, image_url: m.image_url || null, created_at: m.created_at
            }))
        });
    } catch (e) {
        console.error('GET /api/admin/conversations/:id/messages 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// 模擬廠商推薦（客製產品專用）
// 依分類回傳對應的模擬廠商（西裝／服飾不應出現 3D 列印）
function generateMockManufacturersForCustomProduct(category, analysis) {
    const apparelMocks = [
        { id: 'mock-apparel-1', name: '時尚布藝工作室', specialty: '客製化布料與服飾', rating: 4.7, location: '高雄市', capabilities: ['快速打樣', '設計諮詢'], matchScore: 90 },
        { id: 'mock-apparel-2', name: '西裝訂製工坊', specialty: '英式／義式西裝訂製', rating: 4.8, location: '台北市', capabilities: ['西裝訂製', '布料選配'], matchScore: 92 }
    ];
    const furnitureMocks = [
        { id: 'mock-furniture-1', name: '匠心木工坊', specialty: '專注原木家具訂製', rating: 4.8, location: '台北市', capabilities: ['快速打樣', '客製化設計'], matchScore: 92 },
        { id: 'mock-furniture-2', name: '現代傢俱工作室', specialty: '現代風格家具', rating: 4.6, location: '新北市', capabilities: ['家具訂製', '設計優化'], matchScore: 88 }
    ];
    const defaultMocks = [
        { id: 'mock-default-1', name: '全能訂製工坊', specialty: '各類產品訂製', rating: 4.6, location: '台北市', capabilities: ['快速打樣', '設計諮詢'], matchScore: 85 },
        { id: 'mock-default-2', name: '精工製作所', specialty: '精密訂製', rating: 4.4, location: '桃園市', capabilities: ['小量生產', '設計優化'], matchScore: 82 }
    ];

    const cat = (category || '').toLowerCase();
    const isApparel = /apparel|服飾|西裝|衣服|服裝|tshirt|shirt|suit|dress/.test(cat) || (analysis && typeof analysis === 'object' && /西裝|服飾|服裝/.test(JSON.stringify(analysis)));
    const isFurniture = /furniture|家具|傢俱|木工|沙發/.test(cat);
    const list = isApparel ? apparelMocks : (isFurniture ? furnitureMocks : defaultMocks);

    return list.map(mfr => ({
        ...mfr,
        contact: { phone: '02-xxxx-xxxx', email: 'info@example.com' },
        matchReasons: { category_match: true, mock: true }
    }));
}

/**
 * GET /api/projects/:projectId/matched-experts
 * 媒合成功後取得廠商列表含聯絡資料（與預媒合差別：此為實際媒合結果且含聯絡方式）
 */
app.get('/api/projects/:projectId/matched-experts', async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { data: project, error: projErr } = await supabase.from('projects').select('id, owner_id').eq('id', projectId).single();
        if (projErr || !project) return res.status(404).json({ error: '找不到專案' });
        if (project.owner_id !== user.id) return res.status(403).json({ error: '僅專案擁有者可查看媒合廠商' });

        const { data: matches, error: matchErr } = await supabase
            .from('matches')
            .select('id, expert_id, expert_listing_id, match_score, status')
            .eq('project_id', projectId)
            .eq('status', 'active')
            .order('match_score', { ascending: false });
        if (matchErr) return res.status(500).json({ error: '取得媒合記錄失敗' });
        if (!matches || matches.length === 0) return res.json([]);

        const expertIds = [...new Set(matches.map(m => m.expert_id))];
        const listingIds = [...new Set(matches.map(m => m.expert_listing_id).filter(Boolean))];

        let listingsMap = {};
        if (listingIds.length > 0) {
            const { data: listings } = await supabase.from('listings').select('id, title, description, expert_id, tags, images, youtube_urls, media_embeds').in('id', listingIds);
            if (listings) listings.forEach(l => { listingsMap[l.id] = l; });
        }
        let contactMap = {};
        const { data: contacts } = await supabase.from('contact_info').select('user_id, phone, mobile, email, line_id').in('user_id', expertIds);
        if (contacts) contacts.forEach(c => { contactMap[c.user_id] = c; });
        let nameMap = {};
        try {
            const { data: profs } = await supabase.from('profiles').select('id, full_name, raw_user_meta_data').in('id', expertIds);
            if (profs) profs.forEach(p => { nameMap[p.id] = p.full_name || p.raw_user_meta_data?.full_name || null; });
        } catch (_) {}
        let portfolioByExpert = {};
        try {
            const { data: portfolioRows } = await supabase.from('expert_portfolio').select('id, expert_id, title, description, image_url, sort_order').in('expert_id', expertIds).order('sort_order', { ascending: true });
            if (portfolioRows) portfolioRows.forEach(p => { if (!portfolioByExpert[p.expert_id]) portfolioByExpert[p.expert_id] = []; portfolioByExpert[p.expert_id].push(p); });
        } catch (_) {}

        const list = matches.map(m => {
            const listing = m.expert_listing_id ? listingsMap[m.expert_listing_id] : null;
            const contact = contactMap[m.expert_id] || {};
            const displayName = nameMap[m.expert_id] || (listing && listing.title) || '廠商';
            const listingMedia = listing ? {
                images: (listing.images && Array.isArray(listing.images)) ? listing.images : (listing.images ? [listing.images] : []),
                youtube_urls: (listing.youtube_urls && Array.isArray(listing.youtube_urls)) ? listing.youtube_urls : [],
                media_embeds: (listing.media_embeds && Array.isArray(listing.media_embeds)) ? listing.media_embeds : []
            } : { images: [], youtube_urls: [], media_embeds: [] };
            return {
                match_id: m.id,
                expert_id: m.expert_id,
                expert_name: displayName,
                listing_title: listing?.title || '未命名服務',
                listing_description: listing?.description || '',
                listing_tags: (listing?.tags && Array.isArray(listing.tags)) ? listing.tags : [],
                match_score: m.match_score,
                listing_media: listingMedia,
                portfolio: portfolioByExpert[m.expert_id] || [],
                contact: {
                    phone: contact.phone || null,
                    mobile: contact.mobile || null,
                    email: contact.email || null,
                    line_id: contact.line_id || null
                }
            };
        });
        res.json(list);
    } catch (e) {
        console.error('GET matched-experts 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/**
 * DELETE /api/projects/:projectId/matches/:matchId
 * 刪除單筆媒合記錄（從廠商列表中移除該廠商），僅專案擁有者
 */
app.delete('/api/projects/:projectId/matches/:matchId', async (req, res) => {
    try {
        const { projectId, matchId } = req.params;
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { data: project, error: projErr } = await supabase.from('projects').select('id, owner_id').eq('id', projectId).single();
        if (projErr || !project) return res.status(404).json({ error: '找不到專案' });
        if (project.owner_id !== user.id) return res.status(403).json({ error: '僅專案擁有者可刪除媒合記錄' });

        const { data: match, error: matchErr } = await supabase
            .from('matches')
            .select('id')
            .eq('id', matchId)
            .eq('project_id', projectId)
            .single();
        if (matchErr || !match) return res.status(404).json({ error: '找不到該筆媒合記錄' });

        const { error: delErr } = await supabase
            .from('matches')
            .delete()
            .eq('id', matchId)
            .eq('project_id', projectId);
        if (delErr) return res.status(500).json({ error: '刪除失敗：' + delErr.message });
        res.json({ success: true, message: '已從廠商列表移除' });
    } catch (e) {
        console.error('DELETE match 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/**
 * 取得或建立「專案 × 專家」的對話串，並回傳訊息列表
 * POST /api/projects/:projectId/conversations
 * body: { expert_id }
 * 僅專案擁有者（client）可呼叫；回傳 { conversation_id, messages }，messages 含 sender_id、body、created_at、is_mine
 */
app.post('/api/projects/:projectId/conversations', express.json(), async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const expertId = req.body?.expert_id;
        if (!projectId || !expertId) return res.status(400).json({ error: '缺少 project_id 或 expert_id' });
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: project, error: projErr } = await supabase.from('projects').select('id, owner_id').eq('id', projectId).single();
        if (projErr || !project) return res.status(404).json({ error: '找不到專案' });
        if (project.owner_id !== user.id) return res.status(403).json({ error: '僅專案擁有者可開啟對話' });

        let { data: conv, error: convErr } = await supabase
            .from('conversations')
            .select('id')
            .eq('project_id', projectId)
            .eq('expert_id', expertId)
            .eq('client_id', user.id)
            .maybeSingle();
        if (convErr) return res.status(500).json({ error: '查詢對話失敗', details: convErr.message });
        if (!conv) {
            const { data: inserted, error: insErr } = await supabase
                .from('conversations')
                .insert({ project_id: projectId, client_id: user.id, expert_id: expertId })
                .select('id')
                .single();
            if (insErr) return res.status(500).json({ error: '建立對話失敗', details: insErr.message });
            conv = inserted;
        }
        const { data: messages, error: msgErr } = await supabase
            .from('messages')
            .select('id, sender_id, body, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true });
        if (msgErr) return res.status(500).json({ error: '讀取訊息失敗', details: msgErr.message });
        const list = (messages || []).map(m => ({
            id: m.id,
            sender_id: m.sender_id,
            body: m.body,
            created_at: m.created_at,
            is_mine: m.sender_id === user.id
        }));
        return res.json({ conversation_id: conv.id, messages: list });
    } catch (e) {
        console.error('POST conversations 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/**
 * 專家端：取得或建立與該專案發案者的對話（專家可主動開啟對話）
 * POST /api/projects/:projectId/conversations/for-expert
 * 僅該專案之媒合專家可呼叫；回傳 { conversation_id, messages }
 */
app.post('/api/projects/:projectId/conversations/for-expert', express.json(), async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: project, error: projErr } = await supabase.from('projects').select('id, owner_id').eq('id', projectId).single();
        if (projErr || !project) return res.status(404).json({ error: '找不到專案' });
        const { data: match } = await supabase.from('matches').select('id').eq('project_id', projectId).eq('expert_id', user.id).eq('status', 'active').maybeSingle();
        if (!match) return res.status(403).json({ error: '僅媒合成功的專家可與發案者對話' });

        let { data: conv, error: convErr } = await supabase
            .from('conversations')
            .select('id')
            .eq('project_id', projectId)
            .eq('client_id', project.owner_id)
            .eq('expert_id', user.id)
            .maybeSingle();
        if (convErr) return res.status(500).json({ error: '查詢對話失敗', details: convErr.message });
        if (!conv) {
            const { data: inserted, error: insErr } = await supabase
                .from('conversations')
                .insert({ project_id: projectId, client_id: project.owner_id, expert_id: user.id })
                .select('id')
                .single();
            if (insErr) return res.status(500).json({ error: '建立對話失敗', details: insErr.message });
            conv = inserted;
        }
        const { data: messages, error: msgErr } = await supabase
            .from('messages')
            .select('id, sender_id, body, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true });
        if (msgErr) return res.status(500).json({ error: '讀取訊息失敗', details: msgErr.message });
        const list = (messages || []).map(m => ({
            id: m.id,
            sender_id: m.sender_id,
            body: m.body,
            created_at: m.created_at,
            is_mine: m.sender_id === user.id
        }));
        return res.json({ conversation_id: conv.id, messages: list });
    } catch (e) {
        console.error('POST conversations/for-expert 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/**
 * GET /api/conversations/:conversationId/messages
 * 僅對話參與者（client 或 expert）可讀
 */
app.get('/api/conversations/:conversationId/messages', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: conv, error: convErr } = await supabase
            .from('conversations')
            .select('id, client_id, expert_id')
            .eq('id', conversationId)
            .single();
        if (convErr || !conv) return res.status(404).json({ error: '找不到對話' });
        if (conv.client_id !== user.id && conv.expert_id !== user.id) return res.status(403).json({ error: '僅參與者可查看訊息' });

        const { data: messages, error: msgErr } = await supabase
            .from('messages')
            .select('id, sender_id, body, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });
        if (msgErr) return res.status(500).json({ error: '讀取訊息失敗', details: msgErr.message });
        const list = (messages || []).map(m => ({
            id: m.id,
            sender_id: m.sender_id,
            body: m.body,
            created_at: m.created_at,
            is_mine: m.sender_id === user.id
        }));
        return res.json({ messages: list });
    } catch (e) {
        console.error('GET messages 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/**
 * POST /api/conversations/:conversationId/messages
 * body: { body }
 * 僅對話參與者可發送
 */
app.post('/api/conversations/:conversationId/messages', express.json(), async (req, res) => {
    try {
        const { conversationId } = req.params;
        const body = (req.body?.body || '').toString().trim();
        if (!body) return res.status(400).json({ error: '訊息內容不可為空' });
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: conv, error: convErr } = await supabase
            .from('conversations')
            .select('id, client_id, expert_id')
            .eq('id', conversationId)
            .single();
        if (convErr || !conv) return res.status(404).json({ error: '找不到對話' });
        if (conv.client_id !== user.id && conv.expert_id !== user.id) return res.status(403).json({ error: '僅參與者可發送訊息' });

        const { data: msg, error: insErr } = await supabase
            .from('messages')
            .insert({ conversation_id: conversationId, sender_id: user.id, body })
            .select('id, sender_id, body, created_at')
            .single();
        if (insErr) return res.status(500).json({ error: '發送失敗', details: insErr.message });
        return res.status(201).json({
            message: {
                id: msg.id,
                sender_id: msg.sender_id,
                body: msg.body,
                created_at: msg.created_at,
                is_mine: true
            }
        });
    } catch (e) {
        console.error('POST message 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ——— 聯絡清單（訂製者/製作方 對話用） ———
function getAuthUser(req) {
    const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
    return token ? supabase.auth.getUser(token).then(({ data: { user }, error }) => (error ? null : user)) : Promise.resolve(null);
}

app.get('/api/contact-list', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const { data: rows, error } = await supabase.from('contact_list').select('saved_user_id, created_at').eq('user_id', user.id).order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: '讀取聯絡清單失敗' });
        const ids = (rows || []).map(r => r.saved_user_id).filter(Boolean);
        let display = {};
        if (ids.length > 0) {
            // 先從 manufacturers 取名稱
            const { data: mfrs } = await supabase.from('manufacturers').select('user_id, name').in('user_id', ids);
            (mfrs || []).forEach(m => { if (m.user_id) display[m.user_id] = { full_name: m.name }; });
            // 剩下的從 auth.users metadata 補
            const missing = ids.filter(id => !display[id]);
            for (const uid of missing) {
                try {
                    const { data: au } = await supabase.auth.admin.getUserById(uid);
                    const name = au?.user?.user_metadata?.full_name || au?.user?.email?.split('@')[0] || '';
                    if (name) display[uid] = { full_name: name };
                } catch (_) {}
            }
        }
        const list = (rows || []).map(r => ({ saved_user_id: r.saved_user_id, created_at: r.created_at, display: display[r.saved_user_id] || {} }));
        res.json({ contacts: list });
    } catch (e) {
        console.error('GET /api/contact-list:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.post('/api/contact-list', express.json(), async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const otherId = req.body?.user_id || req.body?.saved_user_id;
        if (!otherId) return res.status(400).json({ error: '請提供 user_id' });
        if (otherId === user.id) return res.status(400).json({ error: '無法將自己加入聯絡清單' });
        const { error: err } = await supabase.from('contact_list').upsert({ user_id: user.id, saved_user_id: otherId }, { onConflict: 'user_id,saved_user_id' });
        if (err) return res.status(500).json({ error: '加入失敗' });
        res.status(201).json({ success: true });
    } catch (e) {
        console.error('POST /api/contact-list:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.delete('/api/contact-list/:userId', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const { error } = await supabase.from('contact_list').delete().eq('user_id', user.id).eq('saved_user_id', req.params.userId);
        if (error) return res.status(500).json({ error: '移除失敗' });
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/contact-list:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ——— 直接對話（1:1，訂製者-製作方） ———
app.get('/api/direct-conversations', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const { data: convos, error } = await supabase.from('direct_conversations').select('id, user_a_id, user_b_id, updated_at').or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`).order('updated_at', { ascending: false });
        if (error) return res.status(500).json({ error: '讀取對話列表失敗' });
        const list = (convos || []).map(c => {
            const otherId = c.user_a_id === user.id ? c.user_b_id : c.user_a_id;
            return { id: c.id, other_user_id: otherId, updated_at: c.updated_at };
        });
        const otherIds = list.map(l => l.other_user_id);
        let display = {};
        if (otherIds.length > 0) {
            // 1. 從 manufacturers 抓廠商名稱（多數聯絡對象是廠商）
            const { data: mfrs } = await supabase.from('manufacturers').select('user_id, name').in('user_id', otherIds);
            (mfrs || []).forEach(m => { if (m.user_id) display[m.user_id] = { full_name: m.name }; });
            // 2. 沒有名稱的 → 嘗試 auth.users metadata
            const missing = otherIds.filter(id => !display[id]);
            for (const uid of missing) {
                try {
                    const { data: au } = await supabase.auth.admin.getUserById(uid);
                    const name = au?.user?.user_metadata?.full_name || au?.user?.email?.split('@')[0] || '';
                    if (name) display[uid] = { full_name: name };
                } catch (_) {}
            }
            // 3. 最後一則訊息
            const convIds = list.map(l => l.id);
            const { data: allMsgs } = await supabase.from('direct_messages').select('conversation_id, body, created_at').in('conversation_id', convIds);
            const byConv = {};
            (allMsgs || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach(m => { if (!byConv[m.conversation_id]) byConv[m.conversation_id] = m; });
            list.forEach(l => { l.last_message = byConv[l.id] ? { body: byConv[l.id].body, created_at: byConv[l.id].created_at } : null; l.display = display[l.other_user_id] || {}; });
        } else list.forEach(l => { l.last_message = null; l.display = {}; });
        res.json({ conversations: list });
    } catch (e) {
        console.error('GET /api/direct-conversations:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.post('/api/direct-conversations', express.json(), async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const otherId = req.body?.other_user_id || req.body?.user_id;
        if (!otherId) return res.status(400).json({ error: '請提供 other_user_id' });
        if (otherId === user.id) return res.status(400).json({ error: '無法與自己對話' });
        const [idA, idB] = [user.id, otherId].sort();

        // 找現有對話（unique on user_a_id + user_b_id）
        let conv = null;
        const { data: existing } = await supabase.from('direct_conversations')
            .select('id').eq('user_a_id', idA).eq('user_b_id', idB).maybeSingle();
        conv = existing;

        // 沒有就建立
        if (!conv) {
            const { data: inserted, error: insErr } = await supabase
                .from('direct_conversations').insert({ user_a_id: idA, user_b_id: idB }).select('id').single();
            if (insErr) {
                console.error('建立對話失敗:', insErr);
                return res.status(500).json({ error: '建立對話失敗: ' + insErr.message });
            }
            conv = inserted;
        }

        // 取得對方顯示名稱（優先 manufacturers 表，其次 auth.users metadata）
        let displayName = '';
        try {
            const { data: mfr } = await supabase.from('manufacturers').select('name').eq('user_id', otherId).maybeSingle();
            if (mfr?.name) displayName = mfr.name;
            else {
                const { data: au } = await supabase.auth.admin.getUserById(otherId);
                displayName = au?.user?.user_metadata?.full_name || au?.user?.email?.split('@')[0] || '';
            }
        } catch (_) {}

        const { data: messages, error: msgErr } = await supabase.from('direct_messages')
            .select('id, sender_id, body, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: true });
        if (msgErr) return res.status(500).json({ error: '讀取訊息失敗' });
        const msgList = (messages || []).map(m => ({ id: m.id, sender_id: m.sender_id, body: m.body, created_at: m.created_at, is_mine: m.sender_id === user.id }));
        res.json({ conversation_id: conv.id, display_name: displayName, messages: msgList });
    } catch (e) {
        console.error('POST /api/direct-conversations:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/me/project-stats — 設計者專案統計（開啟數、聯絡數、完成率）
app.get('/api/me/project-stats', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const { data: rows, error } = await supabase
            .from('custom_products')
            .select('id, title, manufacturing_status, open_for_manufacturing, created_at')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: '查詢失敗' });
        const ids = (rows || []).map(r => r.id);
        let contactCounts = {};
        if (ids.length > 0) {
            const { data: convRows } = await supabase
                .from('direct_conversations')
                .select('product_id')
                .in('product_id', ids);
            (convRows || []).forEach(c => {
                contactCounts[c.product_id] = (contactCounts[c.product_id] || 0) + 1;
            });
        }
        const projects = (rows || []).map(r => ({
            id: r.id, title: r.title,
            status: r.manufacturing_status,
            open: !!r.open_for_manufacturing,
            contact_count: contactCounts[r.id] || 0,
            created_at: r.created_at
        }));
        const total = projects.length;
        const openCount = projects.filter(p => p.open).length;
        const completedCount = projects.filter(p => p.status === 'completed').length;
        const completionRate = total > 0 ? Math.round(completedCount / total * 100) : 0;
        const totalContacts = projects.reduce((s, p) => s + p.contact_count, 0);
        res.json({ projects, summary: { total, openCount, completedCount, completionRate, totalContacts } });
    } catch (e) {
        console.error('GET /api/me/project-stats:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.get('/api/direct-conversations/:conversationId/messages', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const { conversationId } = req.params;
        const { data: conv, error: cErr } = await supabase.from('direct_conversations').select('id, user_a_id, user_b_id').eq('id', conversationId).single();
        if (cErr || !conv) return res.status(404).json({ error: '找不到對話' });
        if (conv.user_a_id !== user.id && conv.user_b_id !== user.id) return res.status(403).json({ error: '僅參與者可查看' });
        const { data: messages, error: mErr } = await supabase.from('direct_messages').select('id, sender_id, body, image_url, created_at').eq('conversation_id', conversationId).order('created_at', { ascending: true });
        if (mErr) return res.status(500).json({ error: '讀取訊息失敗' });
        const list = (messages || []).map(m => ({ id: m.id, sender_id: m.sender_id, body: m.body, image_url: m.image_url || null, created_at: m.created_at, is_mine: m.sender_id === user.id }));
        if (list.length > 0) {
            const msgIds = list.map(m => m.id);
            const { data: translations } = await supabase.from('direct_message_translations').select('message_id, translated_text, target_lang').in('message_id', msgIds).eq('user_id', user.id);
            const trMap = {};
            (translations || []).forEach(t => { trMap[t.message_id] = { translated_text: t.translated_text, target_lang: t.target_lang || '' }; });
            list.forEach(m => { if (trMap[m.id]) m.translation = trMap[m.id]; });
        }
        res.json({ messages: list });
    } catch (e) {
        console.error('GET /api/direct-conversations/:id/messages:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.post('/api/direct-conversations/:conversationId/messages', express.json(), async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const body = (req.body?.body || '').toString().trim();
        if (!body) return res.status(400).json({ error: '訊息內容不可為空' });
        const { conversationId } = req.params;
        const { data: conv, error: cErr } = await supabase.from('direct_conversations').select('id').eq('id', conversationId).single();
        if (cErr || !conv) return res.status(404).json({ error: '找不到對話' });
        const { data: convFull } = await supabase.from('direct_conversations').select('user_a_id, user_b_id').eq('id', conversationId).single();
        if (convFull && convFull.user_a_id !== user.id && convFull.user_b_id !== user.id) return res.status(403).json({ error: '僅參與者可發送' });
        const { data: msg, error: insErr } = await supabase.from('direct_messages').insert({ conversation_id: conversationId, sender_id: user.id, body }).select('id, sender_id, body, created_at').single();
        if (insErr) return res.status(500).json({ error: '發送失敗' });
        res.status(201).json({ message: { id: msg.id, sender_id: msg.sender_id, body: msg.body, created_at: msg.created_at, is_mine: true } });
    } catch (e) {
        console.error('POST /api/direct-conversations/:id/messages:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/direct-conversations/:convId/messages/image — 傳送圖片訊息（multipart）
app.post('/api/direct-conversations/:conversationId/messages/image', upload.single('image'), async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const { conversationId } = req.params;
        const { data: conv } = await supabase.from('direct_conversations').select('user_a_id, user_b_id').eq('id', conversationId).single();
        if (!conv) return res.status(404).json({ error: '找不到對話' });
        if (conv.user_a_id !== user.id && conv.user_b_id !== user.id) return res.status(403).json({ error: '僅參與者可發送' });
        if (!req.file) return res.status(400).json({ error: '請選擇圖片' });
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(req.file.mimetype)) return res.status(400).json({ error: '僅支援 JPG / PNG / WebP / GIF' });
        const maxBytes = 10 * 1024 * 1024; // 前端已壓縮，後端允許 10 MB
        if (req.file.size > maxBytes) return res.status(400).json({ error: '圖片超過 10 MB' });
        const ext = req.file.mimetype.split('/')[1] || 'jpg';
        const { publicUrl } = await uploadToSupabaseStorage('custom-products', `messages/${conversationId}`, req.file, { ext, contentType: req.file.mimetype });
        const { data: msg, error: insErr } = await supabase.from('direct_messages')
            .insert({ conversation_id: conversationId, sender_id: user.id, body: '', image_url: publicUrl })
            .select('id, sender_id, body, image_url, created_at').single();
        if (insErr) { console.error('INSERT image message:', insErr); return res.status(500).json({ error: '發送失敗' }); }
        // 更新 conversation updated_at
        await supabase.from('direct_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
        res.status(201).json({ message: { id: msg.id, sender_id: msg.sender_id, body: msg.body, image_url: msg.image_url, created_at: msg.created_at, is_mine: true } });
    } catch (e) {
        console.error('POST /api/direct-conversations/:id/messages/image:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/direct-conversations/:convId/messages/asset-url — 以資產庫圖片 URL 傳送圖片訊息（不重新上傳）
app.post('/api/direct-conversations/:conversationId/messages/asset-url', express.json(), async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const { conversationId } = req.params;
        const imageUrl = (req.body?.image_url || '').toString().trim();
        if (!imageUrl) return res.status(400).json({ error: '缺少 image_url' });
        const { data: conv } = await supabase.from('direct_conversations').select('user_a_id, user_b_id').eq('id', conversationId).single();
        if (!conv) return res.status(404).json({ error: '找不到對話' });
        if (conv.user_a_id !== user.id && conv.user_b_id !== user.id) return res.status(403).json({ error: '僅參與者可發送' });
        const { data: msg, error: insErr } = await supabase.from('direct_messages')
            .insert({ conversation_id: conversationId, sender_id: user.id, body: '', image_url: imageUrl })
            .select('id, sender_id, body, image_url, created_at').single();
        if (insErr) return res.status(500).json({ error: '發送失敗' });
        await supabase.from('direct_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
        res.status(201).json({ message: { id: msg.id, sender_id: msg.sender_id, body: msg.body, image_url: msg.image_url, created_at: msg.created_at, is_mine: true } });
    } catch (e) {
        console.error('POST /api/direct-conversations/:id/messages/asset-url:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/direct-messages/:msgId/translate — 翻譯單則訊息（先翻譯，成功後再扣 1 點；已有儲存則直接回傳不扣點）
app.post('/api/direct-messages/:msgId/translate', express.json(), async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const { msgId } = req.params;
        const { data: msg } = await supabase.from('direct_messages').select('id, body, image_url, conversation_id').eq('id', msgId).maybeSingle();
        if (!msg) return res.status(404).json({ error: '找不到訊息' });
        if (!msg.body && !msg.image_url) return res.status(400).json({ error: '此訊息無文字可翻譯' });
        const { data: conv, error: convErr } = await supabase.from('direct_conversations').select('user_a_id, user_b_id').eq('id', msg.conversation_id).maybeSingle();
        if (convErr) {
            console.error('翻譯 查詢對話失敗:', convErr.message);
            return res.status(500).json({ error: '查詢對話失敗，請稍後再試' });
        }
        if (!conv || (conv.user_a_id !== user.id && conv.user_b_id !== user.id)) {
            return res.status(conv ? 403 : 404).json({ error: conv ? '僅參與者可翻譯' : '找不到對話' });
        }
        const originalText = (msg.body || '').trim();
        if (!originalText) return res.status(400).json({ error: '此訊息無文字可翻譯' });
        // 已有儲存翻譯：直接回傳，不扣點
        const { data: existing } = await supabase.from('direct_message_translations').select('translated_text, target_lang, source_lang').eq('message_id', msgId).eq('user_id', user.id).maybeSingle();
        if (existing && (existing.translated_text || '').trim()) {
            const { data: credits } = await supabase.from('user_credits').select('balance').eq('user_id', user.id).maybeSingle();
            return res.json({
                original_text: originalText,
                translated_text: (existing.translated_text || '').trim(),
                source_lang: existing.source_lang || '',
                target_lang: existing.target_lang || '',
                points_used: 0,
                balance_after: credits?.balance ?? null
            });
        }
        // 非管理員／測試員：先檢查點數（尚未扣點）
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        const isPrivileged = profile?.role === 'admin' || profile?.role === 'tester';
        if (!isPrivileged) {
            const { data: credits } = await supabase.from('user_credits').select('balance').eq('user_id', user.id).maybeSingle();
            const balance = credits?.balance ?? 0;
            if (balance < 1) return res.status(402).json({ error: '點數不足，翻譯需要 1 點' });
        }
        // ——— 僅做翻譯，不扣點 ———
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: '翻譯服務未設定' });
        const model = await getTranslationModelName();
        const promptText = `Detect the language of the text below. If it is Chinese (any variant), translate it to English. Otherwise, translate it to Traditional Chinese (繁體中文). Return only valid JSON with keys: detected_lang (ISO 639-1 code), target_lang, translated_text. No markdown.\n\nText: ${originalText}`;
        let translated = '';
        let sourceLang = '';
        let targetLang = '';
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }) });
            const data = await resp.json();
            if (data.error) {
                console.error('翻譯 Gemini API 錯誤:', data.error.code, data.error.message, 'model=', model);
                const hint = (data.error.code === 404 || /not found|invalid model/i.test(String(data.error.message || ''))) ? '（請至後台 AI 設定檢查 Gemini 翻譯模型名稱）' : '';
                return res.status(500).json({ error: '翻譯服務暫時無法使用' + hint });
            }
            const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (!raw || !raw.trim()) {
                console.warn('翻譯 Gemini 無回傳內容');
                return res.status(500).json({ error: '翻譯無回傳結果，請稍後再試' });
            }
            let jsonStr = raw.replace(/```json\n?|```/g, '').trim();
            const braceStart = jsonStr.indexOf('{');
            if (braceStart !== -1) {
                const braceEnd = jsonStr.lastIndexOf('}');
                if (braceEnd > braceStart) jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
            }
            const parsed = JSON.parse(jsonStr);
            translated = (parsed.translated_text != null ? String(parsed.translated_text) : '').trim();
            sourceLang = (parsed.detected_lang != null ? String(parsed.detected_lang) : '').trim();
            targetLang = (parsed.target_lang != null ? String(parsed.target_lang) : '').trim();
            if (!translated) return res.status(500).json({ error: '翻譯結果為空，請稍後再試' });
        } catch (e) {
            console.error('翻譯 Gemini 解析失敗:', e?.message);
            return res.status(500).json({ error: '翻譯失敗，請稍後再試' });
        }
        // ——— 翻譯成功後才扣點並儲存 ———
        let newBalance = null;
        if (!isPrivileged) {
            const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', user.id).maybeSingle();
            const balance = (credRow?.balance != null) ? credRow.balance : 0;
            newBalance = balance - 1;
            const totalSpent = (credRow?.total_spent ?? 0) + 1;
            await supabase.from('user_credits').upsert({
                user_id: user.id,
                balance: newBalance,
                total_spent: totalSpent,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
            const ctRes = await supabase.from('credit_transactions').insert({
                user_id: user.id, type: 'consumed', amount: -1,
                balance_after: newBalance, source: 'message_translate', description: '訊息翻譯（1 點）'
            });
            if (ctRes.error) console.warn('credit_transactions insert:', ctRes.error?.message);
        }
        const dmtRes = await supabase.from('direct_message_translations').upsert(
            { message_id: msgId, user_id: user.id, translated_text: translated, target_lang: targetLang || null, source_lang: sourceLang || null },
            { onConflict: 'message_id,user_id' }
        );
        if (dmtRes.error) console.warn('direct_message_translations upsert:', dmtRes.error?.message);
        res.json({ original_text: originalText, translated_text: translated, source_lang: sourceLang, target_lang: targetLang, points_used: isPrivileged ? 0 : 1, balance_after: newBalance });
    } catch (e) {
        console.error('POST /api/direct-messages/:msgId/translate:', e?.message || e);
        if (e?.stack) console.error(e.stack);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/**
 * POST /api/projects/:projectId/sync-items
 * 將「我的專案」描述中的項目寫入 project_items 表（後端以 service role 寫入，繞過 RLS）
 * 僅允許專案擁有者操作。
 */
app.post('/api/projects/:projectId/sync-items', express.json(), async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const { items } = req.body;
        if (!projectId || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: '缺少 projectId 或 items 陣列' });
        }

        let token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) {
            return res.status(401).json({ error: '請先登入' });
        }
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: '登入已過期或無效，請重新登入' });
        }

        const { data: project, error: projErr } = await supabase
            .from('projects')
            .select('id, owner_id')
            .eq('id', projectId)
            .single();
        if (projErr || !project) {
            return res.status(404).json({ error: '找不到專案' });
        }
        if (project.owner_id !== user.id) {
            return res.status(403).json({ error: '僅專案擁有者可以同步項目' });
        }

        // subcategory 有 FK 至 ai_subcategories(key)，只接受有效 key 或 null
        let validSubcategoryKeys = [];
        try {
            const { data: keys } = await supabase.from('ai_subcategories').select('key');
            if (keys && keys.length) validSubcategoryKeys = keys.map((r) => r.key);
        } catch (_) {}

        const norm = (s) => (s || '').toString().trim();
        const buildRow = (it) => {
            const rawSub = it.subcategory ?? null;
            const subcategory = (rawSub && validSubcategoryKeys.includes(rawSub)) ? rawSub : null;
            const tags = Array.isArray(it.tags) ? it.tags : [];
            return {
                project_id: projectId,
                item_name: it.item_name || '未命名',
                item_description: it.item_description ?? null,
                category_name: it.category_name ?? null,
                subcategory,
                quantity: it.quantity ?? null,
                unit: it.unit ?? null,
                budget_min: it.budget_min ?? null,
                budget_max: it.budget_max ?? null,
                requirements: tags.length ? { tags } : {},
                status: 'draft'
            };
        };

        // 取得既有 project_items，依「名稱＋說明」對應，有則更新、無則新增（可被我的專案儲存時自動同步呼叫）
        const { data: existingRows, error: fetchErr } = await supabase
            .from('project_items')
            .select('id, item_name, item_description')
            .eq('project_id', projectId);
        if (fetchErr) {
            console.error('sync-items fetch existing error:', fetchErr);
            return res.status(500).json({ error: '讀取既有項目失敗' });
        }
        const existingList = existingRows || [];
        const usedIds = new Set();

        const toUpdate = [];
        const toInsert = [];
        for (const it of items) {
            const name = norm(it.item_name || '未命名');
            const desc = norm(it.item_description ?? it.spec ?? '');
            const matched = existingList.find(
                (r) => !usedIds.has(r.id) && norm(r.item_name) === name && norm(r.item_description) === desc
            );
            const row = buildRow(it);
            if (matched) {
                usedIds.add(matched.id);
                toUpdate.push({ id: matched.id, row });
            } else {
                toInsert.push(row);
            }
        }

        let updatedCount = 0;
        for (const { id, row } of toUpdate) {
            const { error: upErr } = await supabase
                .from('project_items')
                .update({
                    item_name: row.item_name,
                    item_description: row.item_description,
                    category_name: row.category_name,
                    subcategory: row.subcategory,
                    quantity: row.quantity,
                    unit: row.unit,
                    budget_min: row.budget_min,
                    budget_max: row.budget_max,
                    requirements: row.requirements
                    // 不更新 status，保留已發包等狀態
                })
                .eq('id', id);
            if (!upErr) updatedCount++;
        }

        let inserted = [];
        if (toInsert.length > 0) {
            const { data: ins, error: insertError } = await supabase
                .from('project_items')
                .insert(toInsert)
                .select('id, item_name, item_description, category_name, subcategory, quantity, unit, budget_min, budget_max, requirements, status');
            if (insertError) {
                const msg = insertError.message || '';
                const isSchemaError = /total_items|published_items|column.*does not exist|subcategory|quantity|unit/i.test(msg);
                console.error('sync-items insert error:', insertError.code || '', msg, insertError.details || '');
                return res.status(500).json({
                    error: '同步暫時無法使用，請稍後再試或聯絡管理員。',
                    code: isSchemaError ? 'SCHEMA_FIX_NEEDED' : 'INSERT_FAILED'
                });
            }
            inserted = ins || [];
        }
        res.json({
            success: true,
            count: updatedCount + inserted.length,
            updated: updatedCount,
            inserted: inserted.length,
            ids: toUpdate.map((u) => u.id).concat(inserted.map((r) => r.id)),
            items: inserted
        });
    } catch (e) {
        console.error('POST /api/projects/:projectId/sync-items 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/**
 * PATCH /api/projects/:projectId/items/:itemId
 * 更新單一 project_item 欄位（後端寫入，繞過 RLS），僅專案擁有者
 */
app.patch('/api/projects/:projectId/items/:itemId', express.json(), async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const itemId = req.params.itemId;
        const body = req.body || {};
        const { field, value, updates: bodyUpdates, requirements: bodyRequirements } = body;
        const bodyTags = body.tags; // 相容：僅送 tags 陣列時也接受
        const allowed = ['item_name', 'item_description', 'quantity', 'unit', 'budget_min', 'budget_max'];
        let updates = {};
        if (bodyUpdates && typeof bodyUpdates === 'object') {
            for (const k of allowed) {
                if (bodyUpdates[k] !== undefined) {
                    let v = bodyUpdates[k];
                    if (k === 'quantity') v = (v === '' || v === null || v === undefined) ? null : parseFloat(v);
                    else if (k === 'budget_min' || k === 'budget_max') v = (v === '' || v === null || v === undefined) ? null : parseInt(v, 10);
                    else if (v === '') v = null;
                    updates[k] = v;
                }
            }
        } else if (field && allowed.includes(field)) {
            let v = value;
            if (field === 'quantity') v = (v === '' || v === null || v === undefined) ? null : parseFloat(v);
            else if (field === 'budget_min' || field === 'budget_max') v = (v === '' || v === null || v === undefined) ? null : parseInt(v, 10);
            else if (v === '') v = null;
            updates[field] = v;
        }
        // 支援直接更新 requirements（如標籤）：body.requirements.tags 或 body.tags
        if (bodyRequirements !== undefined || bodyTags !== undefined) {
            const tagsFromReq = bodyRequirements && typeof bodyRequirements === 'object' && Array.isArray(bodyRequirements.tags)
                ? bodyRequirements.tags
                : Array.isArray(bodyTags) ? bodyTags : (bodyRequirements && Array.isArray(bodyRequirements) ? bodyRequirements : []);
            updates.requirements = { tags: (tagsFromReq || []).filter(t => t != null && String(t).trim()) };
        }
        if (!projectId || !itemId) {
            return res.status(400).json({ error: '缺少專案或項目 ID（請確認網址含專案 id）' });
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: '請提供要更新的欄位（如 field/value、updates 或 requirements/tags）' });
        }
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) {
            return res.status(401).json({ error: '請先登入' });
        }
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: '登入已過期或無效' });
        }
        const { data: project, error: projErr } = await supabase
            .from('projects')
            .select('id, owner_id')
            .eq('id', projectId)
            .single();
        if (projErr || !project || project.owner_id !== user.id) {
            return res.status(403).json({ error: '無權限修改此專案項目' });
        }
        const { error: updateErr } = await supabase
            .from('project_items')
            .update(updates)
            .eq('id', itemId)
            .eq('project_id', projectId);
        if (updateErr) {
            console.error('PATCH project item error:', updateErr);
            return res.status(500).json({ error: '儲存失敗：' + updateErr.message });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/projects/:projectId/items/:itemId 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// 更新專案項目（用於儲存 AI 辨識結果）
app.post('/api/projects/update-items', async (req, res) => {
    try {
        const { project_id, items } = req.body;
        if (!project_id || !items) {
            return res.status(400).json({ error: '缺少參數' });
        }

        // 取得目前專案資料以保留其他資訊
        // 確保查詢能正確處理可能的權限問題或空值
        const { data: currentProject, error: fetchError } = await supabase
            .from('projects')
            .select('description')
            .eq('id', project_id)
            .maybeSingle(); // 使用 maybeSingle 避免 0 rows 報錯

        if (fetchError) {
            console.error('Fetch project error:', fetchError);
            return res.status(500).json({ error: '無法取得專案: ' + fetchError.message });
        }
        
        if (!currentProject) {
             return res.status(404).json({ error: '找不到專案，可能已被刪除或無權限' });
        }

        let currentDescription = {};
        try {
            currentDescription = JSON.parse(currentProject.description || '{}');
        } catch(e) {}

        const newDescription = {
            ...currentDescription,
            items: items
        };

        // 更新時保持 is_draft 狀態（除非發佈）
        const { error: updateError } = await supabase
            .from('projects')
            .update({ description: JSON.stringify(newDescription), status: 'draft' }) 
            .eq('id', project_id);

        if (updateError) {
            console.error('Update items error:', updateError);
            return res.status(500).json({ error: updateError.message });
        }

        res.json({ success: true });
    } catch (e) {
        console.error('API Error:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// AI 生成 Tags（提示詞明確要求不准重複欄內已有標籤）
app.post('/api/ai-tags/generate', async (req, res) => {
    try {
        const { item_name, category, existing_tags: rawExisting } = req.body;
        if (!item_name) return res.status(400).json({ error: '缺少工項名稱' });

        const existingTags = Array.isArray(rawExisting) ? rawExisting.map(t => (t || '').toString().trim()).filter(Boolean) : [];

        // TODO: 檢查並扣除點數 (目前模擬)
        // const userId = req.user.id;
        // await deductCredits(userId, 5); 

        const noRepeatInstruction = existingTags.length > 0
            ? `\n【重要】以下標籤欄內已存在，嚴禁重複輸出，只可生成「不在以下列表」的新標籤。已存在標籤：${JSON.stringify(existingTags)}。請只回傳「全新、不與上述任一重複」的標籤 JSON 陣列。\n`
            : '';

        const prompt = `
你是一個建築工程與室內設計專家。
請針對工項「${item_name}」生成 3-5 個同義詞或關聯標籤 (Tags)，用於資料庫媒合與搜尋。
分類情境：${category || '一般工程'}
${noRepeatInstruction}
請直接回傳 JSON 陣列，例如：["木工", "隔間", "裝潢"]
不要回傳任何其他文字。
`;

        const modelName = await getReadModelName();
        const result = await runInGeminiQueue(() => genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        }));
        const text = (result && result.text != null ? String(result.text) : '') || '';
        
        let tags = [];
        try {
            // 嘗試解析 JSON Array
            const match = text.match(/\[.*\]/s);
            if (match) {
                tags = JSON.parse(match[0]);
            } else {
                // 如果沒有 JSON，嘗試用逗號分隔
                tags = text.split(/[,，\n]/).map(t => t.trim()).filter(t => t);
            }
        } catch (e) {
            console.error('Parse tags error:', e);
            tags = [item_name]; // fallback
        }

        res.json({ success: true, tags: tags.slice(0, 5) });
    } catch (e) {
        console.error('Generate Tags Error:', e);
        res.status(500).json({ error: 'AI 生成失敗' });
    }
});

// 快速創建測試專案（不調用 AI）
app.post('/api/quick-create-project', async (req, res) => {
    try {
        let token = (req.headers.authorization || '').replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) {
            return res.status(401).json({ error: '未提供 token' });
        }
        
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: '用戶驗證失敗' });
        }
        
        const { data, error } = await supabase
            .from('projects')
            .insert({ 
                title: req.body.title || '測試專案',
                category: req.body.category || 'home',
                status: 'draft',
                owner_id: user.id,
                subcategory: req.body.subcategory || [],
                description: JSON.stringify({ 
                    test: true,
                    items: req.body.items || []
                })
            })
            .select()
            .single();
        
        if (error) {
            return res.status(500).json({ error: error.message, details: error });
        }
        
        res.json({ success: true, project_id: data.id, project: data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 測試：檢查用戶認證和專案創建
app.post('/api/test-create-project', async (req, res) => {
    try {
        let token = (req.headers.authorization || '').replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        
        const result = {
            step1_has_token: !!token,
            step2_user_id: null,
            step3_project_created: false,
            step4_project_id: null,
            errors: []
        };
        
        if (!token) {
            result.errors.push('未收到 authorization token');
            return res.json(result);
        }
        
        // 步驟2：驗證 token
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (authError) {
                result.errors.push('auth.getUser 失敗: ' + authError.message);
                return res.json(result);
            }
            if (!user) {
                result.errors.push('auth.getUser 返回空用戶');
                return res.json(result);
            }
            result.step2_user_id = user.id;
        } catch (e) {
            result.errors.push('auth 例外: ' + e.message);
            return res.json(result);
        }
        
        // 步驟3：嘗試創建測試專案
        try {
            const { data, error } = await supabase
                .from('projects')
                .insert({
                    owner_id: result.step2_user_id,
                    title: '測試專案-' + new Date().toISOString(),
                    description: JSON.stringify({ test: true }),
                    status: 'draft',
                    category: 'home'
                })
                .select('id')
                .single();
            
            if (error) {
                result.errors.push('創建專案失敗: ' + error.message);
                return res.json(result);
            }
            
            result.step3_project_created = true;
            result.step4_project_id = data.id;
        } catch (e) {
            result.errors.push('創建專案例外: ' + e.message);
        }
        
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==================== Phase 1.8 廠商端媒合專案 API ====================

/**
 * 取得當前專家「可媒合專案」列表（至少有一筆已發包 project_item 的專案；不暴露預算）
 * GET /api/match/vendor/projects
 */
app.get('/api/match/vendor/projects', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const expertId = user.id;

        // 從「已存在的報價」讀取：有任一提案即顯示可媒合專案（不限定 status='active'，避免已有報價還被要求新增）
        const { data: expertListings } = await supabase
            .from('listings')
            .select('id, category, subcategory, status')
            .eq('expert_id', expertId);
        if (!expertListings || expertListings.length === 0) {
            return res.json({ projects: [], message: '請先新增至少一筆報價項目' });
        }
        const expertCategories = [...new Set((expertListings || []).map(l => l.category).filter(Boolean))];

        const { data: publishedItems } = await supabase
            .from('project_items')
            .select('project_id')
            .eq('status', 'published');
        if (!publishedItems || publishedItems.length === 0) {
            return res.json({ projects: [], message: '目前沒有已發包的專案可媒合' });
        }
        const projectIds = [...new Set(publishedItems.map(p => p.project_id))];

        const { data: projects } = await supabase
            .from('projects')
            .select('id, title, project_location, owner_id, description')
            .in('id', projectIds);
        if (!projects || projects.length === 0) return res.json({ projects: [] });

        const { data: existingMatches } = await supabase
            .from('matches')
            .select('id, project_id, match_score')
            .eq('expert_id', expertId)
            .in('project_id', projectIds);
        const matchByProject = {};
        (existingMatches || []).forEach(m => { matchByProject[m.project_id] = m; });

        const { data: itemsByProject } = await supabase
            .from('project_items')
            .select('project_id, item_name, category_name, subcategory, requirements')
            .eq('status', 'published')
            .in('project_id', projectIds);
        const itemCount = {};
        const tagsByProject = {};
        (itemsByProject || []).forEach(i => {
            itemCount[i.project_id] = (itemCount[i.project_id] || 0) + 1;
            const tags = (i.requirements && i.requirements.tags) || [];
            if (!tagsByProject[i.project_id]) tagsByProject[i.project_id] = [];
            tagsByProject[i.project_id].push(...tags);
        });
        Object.keys(tagsByProject).forEach(pid => {
            tagsByProject[pid] = [...new Set(tagsByProject[pid])].slice(0, 10);
        });

        const list = projects.map(p => {
            const match = matchByProject[p.id];
            return {
                id: p.id,
                title: p.title || '未命名專案',
                project_location: p.project_location || [],
                items_count: itemCount[p.id] || 0,
                tags_summary: tagsByProject[p.id] || [],
                already_matched: !!match,
                match_id: match ? match.id : null,
                match_score: match ? match.match_score : null,
                client_id: p.owner_id
            };
        });
        res.json({ projects: list });
    } catch (e) {
        console.error('GET /api/match/vendor/projects:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * 專家端預媒合：查詢單一專案自己是否符合，以及預估分數與原因
 * POST /api/match/vendor/preview-project
 * body: { project_id }
 */
app.post('/api/match/vendor/preview-project', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { project_id } = req.body || {};
        if (!project_id) return res.status(400).json({ error: '請提供 project_id' });

        const { data: project } = await supabase.from('projects').select('id, owner_id, project_location').eq('id', project_id).single();
        if (!project) return res.status(404).json({ error: '找不到專案' });

        const { data: rows } = await supabase
            .from('project_items')
            .select('id, project_id, item_name, item_description, category_name, subcategory, quantity, unit, budget_min, budget_max, requirements')
            .eq('project_id', project_id)
            .eq('status', 'published');
        if (!rows || rows.length === 0) return res.json({ match: false, message: '此專案尚無已發包項目' });

        const { data: expertListings } = await supabase
            .from('listings')
            .select('id, expert_id, title, category, subcategory, description, price_min, price_max, price_tiers, unit, tags, service_location, is_remote')
            .eq('expert_id', user.id)
            .eq('status', 'active');
        if (!expertListings || expertListings.length === 0) {
            return res.json({ match: false, message: '您尚無有效報價項目' });
        }

        let categoryNameToKey = {};
        try {
            const { data: catRows } = await supabase.from('ai_categories').select('key, name');
            if (catRows && catRows.length) {
                catRows.forEach(r => {
                    if (r.key) categoryNameToKey[r.key] = r.key;
                    if (r.name) categoryNameToKey[r.name] = r.key;
                });
            }
        } catch (_) {}

        const projectLocation = Array.isArray(project.project_location) ? project.project_location : [];
        const bestByListing = {};
        for (const item of rows) {
            const categoryKeyForQuery = (item.category_name && categoryNameToKey[item.category_name]) ? categoryNameToKey[item.category_name] : (item.category_name || null);
            let query = supabase.from('listings').select('id, expert_id, title, category, subcategory, description, price_min, price_max, price_tiers, unit, tags, service_location, is_remote').eq('status', 'active').eq('expert_id', user.id);
            if (categoryKeyForQuery) query = query.eq('category', categoryKeyForQuery);
            const { data: listings } = await query;
            if (!listings || listings.length === 0) continue;
            const locationFiltered = listings.filter(l => {
                if (!projectLocation || projectLocation.length === 0) return true;
                if (l.is_remote) return true;
                if (l.service_location && l.service_location.length > 0) {
                    return projectLocation.some(loc => l.service_location.includes(loc) || l.service_location.includes('全台灣'));
                }
                return true;
            });
            const itemTags = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
            const tagFiltered = itemTags.length > 0 ? locationFiltered.filter(l => tagsOverlapNormalized(itemTags, l.tags || [])) : locationFiltered;
            const quantity = (item.quantity != null && item.quantity > 0) ? Number(item.quantity) : 1;
            for (const listing of tagFiltered) {
                let score = 0;
                const reasons = [];
                if (listing.is_remote) reasons.push('✓ 可遠端服務');
                else if (projectLocation && projectLocation.length > 0 && listing.service_location) {
                    const matched = projectLocation.filter(loc => listing.service_location.includes(loc) || listing.service_location.includes('全台灣'));
                    if (matched.length > 0) reasons.push(`✓ 服務區域: ${matched.join('、')}`);
                }
                if (categoryKeyForQuery && listing.category === categoryKeyForQuery) { score += 10; reasons.push('✓ 主分類匹配'); }
                if (item.subcategory && listing.subcategory === item.subcategory) { score += 10; reasons.push('✓ 子分類匹配'); }
                const resolved = resolveUnitPriceForQuantity(listing, quantity);
                const useUnitPricing = Boolean(item.unit && item.quantity != null && item.quantity > 0);
                if (item.budget_min != null && item.budget_max != null && resolved.unit_price_min != null && resolved.unit_price_max != null) {
                    let expertAvgTotal, expertAvgUnitPrice;
                    if (useUnitPricing) {
                        const expertTotalMin = resolved.unit_price_min * quantity;
                        const expertTotalMax = resolved.unit_price_max * quantity;
                        expertAvgTotal = (expertTotalMin + expertTotalMax) / 2;
                        expertAvgUnitPrice = (resolved.unit_price_min + resolved.unit_price_max) / 2;
                    } else {
                        expertAvgTotal = (resolved.unit_price_min + resolved.unit_price_max) / 2;
                        expertAvgUnitPrice = expertAvgTotal;
                    }
                    if (expertAvgTotal >= item.budget_min && expertAvgTotal <= item.budget_max) {
                        let marketUnitPrice = null;
                        if (item.subcategory) {
                            try {
                                const { data: priceData } = await supabase.from('market_prices').select('market_price').eq('subcategory', item.subcategory).is('tag_filter', null).maybeSingle();
                                if (priceData) marketUnitPrice = priceData.market_price;
                            } catch (_) {}
                        }
                        if (marketUnitPrice && marketUnitPrice > 0) {
                            const deviation = Math.abs(expertAvgUnitPrice - marketUnitPrice) / marketUnitPrice;
                            const priceScore = Math.round(40 * Math.max(0, 1 - deviation));
                            score += priceScore;
                            reasons.push(`價格合理度 ${priceScore}/40`);
                        } else {
                            const overlapMin = Math.max(item.budget_min, resolved.unit_price_min * (useUnitPricing ? quantity : 1));
                            const overlapMax = Math.min(item.budget_max, resolved.unit_price_max * (useUnitPricing ? quantity : 1));
                            if (overlapMax >= overlapMin) {
                                const overlapRange = overlapMax - overlapMin;
                                const itemRange = item.budget_max - item.budget_min;
                                const overlapRatio = itemRange > 0 ? overlapRange / itemRange : 1;
                                score += Math.round(overlapRatio * 40);
                                reasons.push('價格區間重疊');
                            }
                        }
                    }
                }
                const itemTagsForScore = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
                const itemText = `${item.item_name} ${item.item_description || ''}`.toLowerCase();
                let matchedKeywords = [];
                if (listing.tags && listing.tags.length > 0) {
                    for (const tag of listing.tags) {
                        const tagLower = (tag || '').toLowerCase();
                        if (tagLower && itemText.includes(tagLower)) matchedKeywords.push(tag);
                    }
                    for (const lt of listing.tags) {
                        const ltNorm = normalizeTagForMatch(lt);
                        if (!ltNorm) continue;
                        if (itemTagsForScore.some(t => normalizeTagForMatch(t) === ltNorm) && !matchedKeywords.some(m => normalizeTagForMatch(m) === ltNorm)) matchedKeywords.push(lt);
                    }
                    if (itemTags.length > 0 && matchedKeywords.length === 0) {
                        const overlap = listing.tags.filter(lt => itemTags.some(t => normalizeTagForMatch(t) === normalizeTagForMatch(lt)));
                        if (overlap.length > 0) matchedKeywords = overlap;
                    }
                }
                if (matchedKeywords.length > 0) {
                    const totalItems = rows.length;
                    const denominator = totalItems * 1.5;
                    const scorePerTag = 40 / denominator;
                    const keywordScore = Math.min(40, Math.round(matchedKeywords.length * scorePerTag));
                    score += keywordScore;
                    reasons.push(`關鍵字/標籤: ${matchedKeywords.slice(0, 3).join('、')}`);
                }
                if (score >= 30 && (!bestByListing[listing.id] || score > bestByListing[listing.id].score)) {
                    bestByListing[listing.id] = { listing, score, reasons, item_name: item.item_name };
                }
            }
        }
        const best = Object.values(bestByListing).sort((a, b) => b.score - a.score)[0];
        if (!best) {
            return res.json({ match: false, message: '目前您的報價項目與此專案工項尚無符合條件的匹配（分數門檻 30）' });
        }
        res.json({
            match: true,
            score: best.score,
            reasons: best.reasons,
            listing_id: best.listing.id,
            listing_title: best.listing.title,
            item_name: best.item_name
        });
    } catch (e) {
        console.error('POST /api/match/vendor/preview-project:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * 專家端預媒合摘要：與發案端一樣「一次試算」— 用我的報價對所有已發包專案試算，回傳符合專案數（不需選專案）
 * GET /api/match/vendor/preview-summary
 */
app.get('/api/match/vendor/preview-summary', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: expertListings } = await supabase
            .from('listings')
            .select('id, expert_id, title, category, subcategory, price_min, price_max, price_tiers, unit, tags, service_location, is_remote')
            .eq('expert_id', user.id)
            .eq('status', 'active');
        if (!expertListings || expertListings.length === 0) {
            return res.json({ total_projects: 0, matched_projects: 0, message: '您尚無有效報價項目，請先新增報價' });
        }

        const { data: publishedItems } = await supabase
            .from('project_items')
            .select('project_id')
            .eq('status', 'published');
        if (!publishedItems || publishedItems.length === 0) {
            return res.json({ total_projects: 0, matched_projects: 0, message: '目前沒有已發包的專案' });
        }
        const projectIds = [...new Set(publishedItems.map(p => p.project_id))].slice(0, 50);
        const totalProjects = projectIds.length;

        const { data: projects } = await supabase.from('projects').select('id, project_location').in('id', projectIds);
        const projectMap = {};
        (projects || []).forEach(p => { projectMap[p.id] = p; });

        const { data: allItems } = await supabase
            .from('project_items')
            .select('id, project_id, item_name, category_name, subcategory, quantity, unit, budget_min, budget_max, requirements')
            .eq('status', 'published')
            .in('project_id', projectIds);
        const itemsByProject = {};
        (allItems || []).forEach(i => {
            if (!itemsByProject[i.project_id]) itemsByProject[i.project_id] = [];
            itemsByProject[i.project_id].push(i);
        });

        let categoryNameToKey = {};
        try {
            const { data: catRows } = await supabase.from('ai_categories').select('key, name');
            if (catRows && catRows.length) catRows.forEach(r => { if (r.key) categoryNameToKey[r.key] = r.key; if (r.name) categoryNameToKey[r.name] = r.key; });
        } catch (_) {}

        let matched = 0;
        for (const pid of projectIds) {
            const project = projectMap[pid];
            const rows = itemsByProject[pid] || [];
            if (!project || rows.length === 0) continue;
            const projectLocation = Array.isArray(project.project_location) ? project.project_location : [];
            const bestByListing = {};
            for (const item of rows) {
                const categoryKey = (item.category_name && categoryNameToKey[item.category_name]) ? categoryNameToKey[item.category_name] : (item.category_name || null);
                let list = expertListings;
                if (categoryKey) list = list.filter(l => l.category === categoryKey);
                const locationFiltered = list.filter(l => {
                    if (!projectLocation || projectLocation.length === 0) return true;
                    if (l.is_remote) return true;
                    if (l.service_location && l.service_location.length > 0) return projectLocation.some(loc => l.service_location.includes(loc) || l.service_location.includes('全台灣'));
                    return true;
                });
                const itemTags = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
                const tagFiltered = itemTags.length > 0 ? locationFiltered.filter(l => tagsOverlapNormalized(itemTags, l.tags || [])) : locationFiltered;
                const quantity = (item.quantity != null && item.quantity > 0) ? Number(item.quantity) : 1;
                for (const listing of tagFiltered) {
                    let score = 0;
                    if (categoryKey && listing.category === categoryKey) score += 10;
                    if (item.subcategory && listing.subcategory === item.subcategory) score += 10;
                    const resolved = resolveUnitPriceForQuantity(listing, quantity);
                    const useUnitPricing = Boolean(item.unit && item.quantity != null && item.quantity > 0);
                    if (item.budget_min != null && item.budget_max != null && resolved.unit_price_min != null && resolved.unit_price_max != null) {
                        const expertAvgTotal = useUnitPricing ? (resolved.unit_price_min * quantity + resolved.unit_price_max * quantity) / 2 : (resolved.unit_price_min + resolved.unit_price_max) / 2;
                        if (expertAvgTotal >= item.budget_min && expertAvgTotal <= item.budget_max) {
                            const overlapMin = Math.max(item.budget_min, (resolved.unit_price_min || 0) * (useUnitPricing ? quantity : 1));
                            const overlapMax = Math.min(item.budget_max, (resolved.unit_price_max || 0) * (useUnitPricing ? quantity : 1));
                            if (overlapMax >= overlapMin && (item.budget_max - item.budget_min) > 0)
                                score += Math.round(40 * (overlapMax - overlapMin) / (item.budget_max - item.budget_min));
                            else score += 40;
                        }
                    }
                    const itemTagsForScore = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
                    const itemText = `${item.item_name} ${item.item_description || ''}`.toLowerCase();
                    let matchedKw = 0;
                    if (listing.tags && listing.tags.length > 0) {
                        for (const lt of listing.tags) {
                            const ln = normalizeTagForMatch(lt);
                            if (ln && itemTagsForScore.some(t => normalizeTagForMatch(t) === ln)) matchedKw++;
                        }
                        if (matchedKw > 0) score += Math.min(40, matchedKw * 15);
                    }
                    if (score >= 30 && (!bestByListing[listing.id] || score > bestByListing[listing.id].score))
                        bestByListing[listing.id] = { score };
                }
            }
            const best = Object.values(bestByListing).sort((a, b) => b.score - a.score)[0];
            if (best && best.score >= 30) matched++;
        }
        res.json({
            total_projects: totalProjects,
            matched_projects: matched,
            message: totalProjects === 0 ? '目前沒有已發包的專案' : `目前有 ${totalProjects} 個已發包專案，其中 ${matched} 個與您的報價相符`
        });
    } catch (e) {
        console.error('GET /api/match/vendor/preview-summary:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * 專家端申請媒合：對單一專案執行媒合邏輯，通過則寫入 matches（一筆專案擇一最佳 listing）
 * POST /api/match/vendor/apply
 * body: { project_id, listing_id? }
 */
app.post('/api/match/vendor/apply', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { project_id, listing_id } = req.body || {};
        if (!project_id) return res.status(400).json({ error: '請提供 project_id' });

        const { data: project } = await supabase.from('projects').select('id, owner_id, project_location').eq('id', project_id).single();
        if (!project) return res.status(404).json({ error: '找不到專案' });

        const { data: rows } = await supabase
            .from('project_items')
            .select('id, project_id, item_name, item_description, category_name, subcategory, quantity, unit, budget_min, budget_max, requirements')
            .eq('project_id', project_id)
            .eq('status', 'published');
        if (!rows || rows.length === 0) return res.status(400).json({ error: '此專案尚無已發包項目' });

        const { data: expertListingsData } = await supabase
            .from('listings')
            .select('id, expert_id, title, category, subcategory, description, price_min, price_max, price_tiers, unit, tags, service_location, is_remote')
            .eq('expert_id', user.id)
            .eq('status', 'active');
        const expertListings = (expertListingsData || []).filter(l => !listing_id || l.id === listing_id);
        if (expertListings.length === 0) return res.status(400).json({ error: '找不到指定的報價項目或您尚無有效報價' });

        let categoryNameToKey = {};
        try {
            const { data: catRows } = await supabase.from('ai_categories').select('key, name');
            if (catRows && catRows.length) {
                catRows.forEach(r => { if (r.key) categoryNameToKey[r.key] = r.key; if (r.name) categoryNameToKey[r.name] = r.key; });
            }
        } catch (_) {}
        const projectLocation = Array.isArray(project.project_location) ? project.project_location : [];
        const bestByListing = {};
        for (const item of rows) {
            const categoryKeyForQuery = (item.category_name && categoryNameToKey[item.category_name]) ? categoryNameToKey[item.category_name] : (item.category_name || null);
            let list = expertListings;
            if (categoryKeyForQuery) list = list.filter(l => l.category === categoryKeyForQuery);
            const locationFiltered = list.filter(l => {
                if (!projectLocation || projectLocation.length === 0) return true;
                if (l.is_remote) return true;
                if (l.service_location && l.service_location.length > 0) return projectLocation.some(loc => l.service_location.includes(loc) || l.service_location.includes('全台灣'));
                return true;
            });
            const itemTags = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
            const tagFiltered = itemTags.length > 0 ? locationFiltered.filter(l => tagsOverlapNormalized(itemTags, l.tags || [])) : locationFiltered;
            const quantity = (item.quantity != null && item.quantity > 0) ? Number(item.quantity) : 1;
            for (const listing of tagFiltered) {
                let score = 0;
                const reasons = [];
                if (listing.is_remote) reasons.push('✓ 可遠端服務');
                else if (projectLocation && projectLocation.length > 0 && listing.service_location) {
                    const matched = projectLocation.filter(loc => listing.service_location.includes(loc) || listing.service_location.includes('全台灣'));
                    if (matched.length > 0) reasons.push(`✓ 服務區域: ${matched.join('、')}`);
                }
                if (categoryKeyForQuery && listing.category === categoryKeyForQuery) { score += 10; reasons.push('✓ 主分類匹配'); }
                if (item.subcategory && listing.subcategory === item.subcategory) { score += 10; reasons.push('✓ 子分類匹配'); }
                const resolved = resolveUnitPriceForQuantity(listing, quantity);
                const useUnitPricing = Boolean(item.unit && item.quantity != null && item.quantity > 0);
                if (item.budget_min != null && item.budget_max != null && resolved.unit_price_min != null && resolved.unit_price_max != null) {
                    let expertAvgTotal, expertAvgUnitPrice;
                    if (useUnitPricing) {
                        expertAvgTotal = (resolved.unit_price_min * quantity + resolved.unit_price_max * quantity) / 2;
                        expertAvgUnitPrice = (resolved.unit_price_min + resolved.unit_price_max) / 2;
                    } else {
                        expertAvgTotal = (resolved.unit_price_min + resolved.unit_price_max) / 2;
                        expertAvgUnitPrice = expertAvgTotal;
                    }
                    if (expertAvgTotal >= item.budget_min && expertAvgTotal <= item.budget_max) {
                        let marketUnitPrice = null;
                        if (item.subcategory) {
                            try {
                                const { data: priceData } = await supabase.from('market_prices').select('market_price').eq('subcategory', item.subcategory).is('tag_filter', null).maybeSingle();
                                if (priceData) marketUnitPrice = priceData.market_price;
                            } catch (_) {}
                        }
                        if (marketUnitPrice && marketUnitPrice > 0) {
                            const deviation = Math.abs(expertAvgUnitPrice - marketUnitPrice) / marketUnitPrice;
                            score += Math.round(40 * Math.max(0, 1 - deviation));
                        } else {
                            const overlapMin = Math.max(item.budget_min, resolved.unit_price_min * (useUnitPricing ? quantity : 1));
                            const overlapMax = Math.min(item.budget_max, resolved.unit_price_max * (useUnitPricing ? quantity : 1));
                            if (overlapMax >= overlapMin) {
                                const overlapRange = overlapMax - overlapMin;
                                const itemRange = item.budget_max - item.budget_min;
                                score += Math.round((itemRange > 0 ? overlapRange / itemRange : 1) * 40);
                            }
                        }
                    }
                }
                const itemTagsForScore = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
                const itemText = `${item.item_name} ${item.item_description || ''}`.toLowerCase();
                let matchedKeywords = [];
                if (listing.tags && listing.tags.length > 0) {
                    for (const tag of listing.tags) { if ((tag || '').toLowerCase() && itemText.includes((tag || '').toLowerCase())) matchedKeywords.push(tag); }
                    for (const lt of listing.tags) {
                        const ltNorm = normalizeTagForMatch(lt);
                        if (ltNorm && itemTagsForScore.some(t => normalizeTagForMatch(t) === ltNorm) && !matchedKeywords.some(m => normalizeTagForMatch(m) === ltNorm)) matchedKeywords.push(lt);
                    }
                    if (itemTags.length > 0 && matchedKeywords.length === 0) {
                        const overlap = listing.tags.filter(lt => itemTags.some(t => normalizeTagForMatch(t) === normalizeTagForMatch(lt)));
                        if (overlap.length > 0) matchedKeywords = overlap;
                    }
                }
                if (matchedKeywords.length > 0) {
                    const totalItems = rows.length;
                    const keywordScore = Math.min(40, Math.round(matchedKeywords.length * (40 / (totalItems * 1.5))));
                    score += keywordScore;
                }
                if (score >= 30 && (!bestByListing[listing.id] || score > bestByListing[listing.id].score)) {
                    bestByListing[listing.id] = { listing, score, reasons, item_id: item.id, item_name: item.item_name };
                }
            }
        }
        const best = Object.values(bestByListing).sort((a, b) => b.score - a.score)[0];
        if (!best) return res.status(400).json({ error: '目前您的報價與此專案工項未達媒合門檻（30 分）' });

        const { data: existing } = await supabase.from('matches').select('id').eq('project_id', project_id).eq('expert_listing_id', best.listing.id).maybeSingle();
        if (existing) return res.json({ success: true, already_matched: true, message: '您已媒合過此專案' });

        const { error: insertErr } = await supabase.from('matches').insert({
            project_id,
            expert_listing_id: best.listing.id,
            expert_id: user.id,
            client_id: project.owner_id,
            match_score: best.score,
            match_reasons: { item_id: best.item_id, item_name: best.item_name, reasons: best.reasons },
            status: 'active'
        });
        if (insertErr) return res.status(500).json({ error: '寫入媒合記錄失敗：' + insertErr.message });
        res.json({ success: true, message: '媒合成功', match_score: best.score });
    } catch (e) {
        console.error('POST /api/match/vendor/apply:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * 專家端：取得「我媒合到的專案」列表（供 matched-projects 使用）
 * GET /api/match/vendor/my-matches
 */
app.get('/api/match/vendor/my-matches', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: matches } = await supabase
            .from('matches')
            .select('id, project_id, expert_listing_id, match_score, status, created_at')
            .eq('expert_id', user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        if (!matches || matches.length === 0) return res.json({ matches: [] });

        const projectIds = [...new Set(matches.map(m => m.project_id))];
        const { data: projects } = await supabase.from('projects').select('id, title, project_location, owner_id').in('id', projectIds);
        const projectMap = {};
        (projects || []).forEach(p => { projectMap[p.id] = p; });

        const clientIds = [...new Set((projects || []).map(p => p.owner_id).filter(Boolean))];
        let contactMap = {};
        if (clientIds.length > 0) {
            const { data: contacts } = await supabase.from('contact_info').select('user_id, phone, mobile, email, line_id').in('user_id', clientIds);
            if (contacts) contacts.forEach(c => { contactMap[c.user_id] = c; });
        }
        let nameMap = {};
        try {
            const { data: profs } = await supabase.from('profiles').select('id, full_name, raw_user_meta_data').in('id', clientIds);
            if (profs) profs.forEach(p => { nameMap[p.id] = p.full_name || p.raw_user_meta_data?.full_name || null; });
        } catch (_) {}

        const listingIds = matches.map(m => m.expert_listing_id).filter(Boolean);
        let listingsMap = {};
        if (listingIds.length > 0) {
            const { data: listings } = await supabase.from('listings').select('id, title').in('id', listingIds);
            if (listings) listings.forEach(l => { listingsMap[l.id] = l; });
        }

        const list = matches.map(m => {
            const proj = projectMap[m.project_id];
            const client = proj ? contactMap[proj.owner_id] : null;
            const listing = listingsMap[m.expert_listing_id];
            return {
                match_id: m.id,
                project_id: m.project_id,
                project_title: proj ? (proj.title || '未命名專案') : '',
                project_location: proj ? (proj.project_location || []) : [],
                match_score: m.match_score,
                status: m.status,
                created_at: m.created_at,
                listing_title: listing ? listing.title : '',
                client_id: proj ? proj.owner_id : null,
                client_name: proj ? (nameMap[proj.owner_id] || null) : null,
                contact: proj && client ? { phone: client.phone || null, mobile: client.mobile || null, email: client.email || null, line_id: client.line_id || null } : null
            };
        });
        res.json({ matches: list });
    } catch (e) {
        console.error('GET /api/match/vendor/my-matches:', e);
        res.status(500).json({ error: e.message });
    }
});

// ==================== 專家公開自介（發包廠商／訪客查看） ====================
/**
 * GET /api/expert/public-profile?expert_id= — 取得專家公開自介（聯絡方式依可見設定）
 */
app.get('/api/expert/public-profile', async (req, res) => {
    try {
        const expertId = req.query.expert_id;
        if (!expertId) return res.status(400).json({ error: '缺少 expert_id' });

        let fullName = '專家', avatarUrl = null, bio = '';
        try {
            const { data: profile } = await supabase.from('profiles').select('id, full_name, avatar_url, raw_user_meta_data').eq('id', expertId).maybeSingle();
            if (profile) {
                fullName = profile.full_name || profile.raw_user_meta_data?.full_name || '專家';
                avatarUrl = profile.avatar_url || profile.raw_user_meta_data?.avatar_url || null;
                bio = profile.raw_user_meta_data?.bio || '';
            }
        } catch (_) {}

        let contact = {};
        let contactRow = null;
        try {
            const { data } = await supabase.from('contact_info').select('*').eq('user_id', expertId).maybeSingle();
            contactRow = data;
        } catch (_) {}
        if (contactRow) {
            if (!fullName || fullName === '專家') fullName = contactRow.company_name || fullName;
            if (bio && !contactRow.bio) {} else if (contactRow.bio) bio = contactRow.bio;
            const vis = (key) => contactRow[key] !== false && contactRow[key] !== undefined;
            if (vis('phone_visible') && contactRow.phone) contact.phone = contactRow.phone;
            if (vis('mobile_visible') && contactRow.mobile) contact.mobile = contactRow.mobile;
            if (vis('email_visible') && contactRow.email) contact.email = contactRow.email;
            if (vis('line_visible') && contactRow.line_id) contact.line_id = contactRow.line_id;
            if (vis('wechat_visible') && contactRow.wechat_id) contact.wechat_id = contactRow.wechat_id;
            if (vis('website_visible') && contactRow.website_url) contact.website_url = contactRow.website_url;
            if (vis('portfolio_visible') && contactRow.portfolio_url) contact.portfolio_url = contactRow.portfolio_url;
            if (contactRow.company_name) contact.company_name = contactRow.company_name;
            if (contactRow.company_address) contact.company_address = contactRow.company_address;
            if (contactRow.bio) contact.bio = contactRow.bio;
            if (Object.keys(contact).length === 0 && (contactRow.phone || contactRow.mobile || contactRow.email || contactRow.line_id)) {
                if (contactRow.phone) contact.phone = contactRow.phone;
                if (contactRow.mobile) contact.mobile = contactRow.mobile;
                if (contactRow.email) contact.email = contactRow.email;
                if (contactRow.line_id) contact.line_id = contactRow.line_id;
            }
        }

        let portfolio = [];
        try {
            const { data: port } = await supabase.from('expert_portfolio').select('id, title, description, image_url, sort_order').eq('expert_id', expertId).order('sort_order', { ascending: true });
            portfolio = port || [];
        } catch (_) {}
        res.json({
            expert_id: expertId,
            full_name: fullName,
            avatar_url: avatarUrl,
            bio: contact.bio || bio || '',
            contact,
            portfolio
        });
    } catch (e) {
        console.error('GET /api/expert/public-profile:', e);
        res.status(500).json({ error: (e && e.message) || '系統錯誤' });
    }
});

// ==================== 承包商／專家作品集 API ====================
/**
 * GET /api/expert/portfolio — 取得作品集（?expert_id= 可查他人，無則查當前登入者）
 */
app.get('/api/expert/portfolio', async (req, res) => {
    try {
        const expertId = req.query.expert_id;
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        let targetId = expertId;
        if (!targetId && token) {
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) targetId = user.id;
        }
        if (!targetId) return res.json({ items: [] });
        const { data, error } = await supabase
            .from('expert_portfolio')
            .select('id, expert_id, title, description, image_url, sort_order, created_at')
            .eq('expert_id', targetId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        res.json({ items: data || [] });
    } catch (e) {
        console.error('GET /api/expert/portfolio:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * 報價健檢：與同分類同單位之同業報價比較分布位置，不建議降價，建議以作品證明價值
 * GET /api/expert/quote-health-check
 */
function percentile(sortedArr, p) {
    if (!sortedArr || sortedArr.length === 0) return null;
    const n = sortedArr.length;
    const idx = Math.min(Math.floor((n - 1) * p), n - 1);
    return sortedArr[idx];
}
app.get('/api/expert/quote-health-check', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: myListings, error: myErr } = await supabase
            .from('listings')
            .select('id, title, category, unit, price_min, price_max')
            .eq('expert_id', user.id)
            .eq('status', 'active');
        if (myErr) return res.status(500).json({ error: myErr.message });
        if (!myListings || myListings.length === 0) {
            return res.json({ items: [], message: '您尚無有效報價項目，無法進行健檢' });
        }

        const items = [];
        for (const listing of myListings) {
            const category = listing.category || '';
            const unit = (listing.unit || '').trim() || null;
            const myMid = (listing.price_min != null && listing.price_max != null)
                ? (Number(listing.price_min) + Number(listing.price_max)) / 2
                : (listing.price_min != null ? Number(listing.price_min) : listing.price_max != null ? Number(listing.price_max) : null);
            if (myMid == null || !category) {
                items.push({
                    listing_id: listing.id,
                    title: listing.title,
                    category,
                    unit,
                    band: null,
                    message: '此報價缺少分類或價格，無法比較',
                    suggestion: '可透過作品集與案例讓客戶了解您的服務價值。',
                    peer_count: 0
                });
                continue;
            }

            let peerQuery = supabase
                .from('listings')
                .select('price_min, price_max')
                .eq('category', category)
                .eq('status', 'active')
                .neq('expert_id', user.id);
            if (unit) peerQuery = peerQuery.eq('unit', unit);
            const { data: peers, error: peerErr } = await peerQuery;
            if (peerErr || !peers || peers.length < 3) {
                items.push({
                    listing_id: listing.id,
                    title: listing.title,
                    category,
                    unit,
                    band: null,
                    message: '同分類、同單位的同業報價數量不足，尚無足夠資料可比較。',
                    suggestion: '可透過作品集與案例讓客戶了解您的服務價值。',
                    peer_count: peers ? peers.length : 0
                });
                continue;
            }

            const peerPrices = peers
                .map(p => {
                    const a = p.price_min != null ? Number(p.price_min) : null;
                    const b = p.price_max != null ? Number(p.price_max) : null;
                    if (a != null && b != null) return (a + b) / 2;
                    if (a != null) return a;
                    if (b != null) return b;
                    return null;
                })
                .filter(v => v != null && !Number.isNaN(v));
            if (peerPrices.length < 3) {
                items.push({
                    listing_id: listing.id,
                    title: listing.title,
                    category,
                    unit,
                    band: null,
                    message: '同業報價資料不足，尚無足夠資料可比較。',
                    suggestion: '可透過作品集與案例讓客戶了解您的服務價值。',
                    peer_count: peerPrices.length
                });
                continue;
            }

            peerPrices.sort((a, b) => a - b);
            const p25 = percentile(peerPrices, 0.25);
            const p50 = percentile(peerPrices, 0.5);
            const p75 = percentile(peerPrices, 0.75);
            let band, message, suggestion;
            if (myMid > p75) {
                band = '前段';
                message = '您的報價落在同分類報價的 **前段**（高於約 75% 同業）。';
                suggestion = '可透過 **作品集與案例** 說明服務差異與品質，吸引重視成果的客戶。';
            } else if (myMid < p25) {
                band = '後段';
                message = '您的報價落在同分類報價的 **後段**。';
                suggestion = '建立口碑與案例後，可適度在報價中反映您的價值；**上傳作品** 有助客戶理解您的服務水準。';
            } else {
                band = '中段';
                message = '您的報價落在同分類報價的 **中段**，與多數同業區間相近。';
                suggestion = '可透過 **完整作品與經歷** 讓客戶更容易辨識您的優勢。';
            }
            items.push({
                listing_id: listing.id,
                title: listing.title,
                category,
                unit,
                my_price: Math.round(myMid),
                band,
                message,
                suggestion,
                peer_count: peerPrices.length,
                p25: Math.round(p25),
                p50: Math.round(p50),
                p75: Math.round(p75)
            });
        }

        res.json({ items, message: '報價健檢不與同業競價，建議以作品與服務證明爭取客戶。' });
    } catch (e) {
        console.error('GET /api/expert/quote-health-check:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/expert/portfolio — 新增作品（僅當前登入專家）
 */
app.post('/api/expert/portfolio', express.json(), async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { title, description, image_url, sort_order } = req.body || {};
        if (!title || !title.trim()) return res.status(400).json({ error: '請填寫作品標題' });
        const { data, error } = await supabase
            .from('expert_portfolio')
            .insert({
                expert_id: user.id,
                title: (title || '').trim(),
                description: description ? String(description).trim() : null,
                image_url: image_url ? String(image_url).trim() : null,
                sort_order: sort_order != null ? Number(sort_order) : 0
            })
            .select()
            .single();
        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data);
    } catch (e) {
        console.error('POST /api/expert/portfolio:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * PUT /api/expert/portfolio/:id — 更新作品（僅本人）
 */
app.put('/api/expert/portfolio/:id', express.json(), async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { id } = req.params;
        const { title, description, image_url, sort_order } = req.body || {};
        const { data: row, error: fetchErr } = await supabase
            .from('expert_portfolio')
            .select('id, expert_id')
            .eq('id', id)
            .single();
        if (fetchErr || !row || row.expert_id !== user.id) return res.status(404).json({ error: '找不到作品或無權限' });
        const updates = {};
        if (title !== undefined) updates.title = String(title).trim();
        if (description !== undefined) updates.description = description ? String(description).trim() : null;
        if (image_url !== undefined) updates.image_url = image_url ? String(image_url).trim() : null;
        if (sort_order !== undefined) updates.sort_order = Number(sort_order);
        updates.updated_at = new Date().toISOString();
        const { data, error } = await supabase.from('expert_portfolio').update(updates).eq('id', id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) {
        console.error('PUT /api/expert/portfolio:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * DELETE /api/expert/portfolio/:id — 刪除作品（僅本人）
 */
app.delete('/api/expert/portfolio/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { id } = req.params;
        const { data: row, error: fetchErr } = await supabase
            .from('expert_portfolio')
            .select('id, expert_id')
            .eq('id', id)
            .single();
        if (fetchErr || !row || row.expert_id !== user.id) return res.status(404).json({ error: '找不到作品或無權限' });
        const { error: delErr } = await supabase.from('expert_portfolio').delete().eq('id', id);
        if (delErr) return res.status(500).json({ error: delErr.message });
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/expert/portfolio:', e);
        res.status(500).json({ error: e.message });
    }
});

// ==================== 預媒合 API ====================
/**
 * 預媒合測試：根據預算範圍，顯示符合的專家百分比
 * POST /api/match/preview
 */
app.post('/api/match/preview', async (req, res) => {
    try {
        const { project_id, category, subcategory, budget_min, budget_max, quantity, unit, tags: bodyTags } = req.body;
        
        // 驗證必要參數
        if (!budget_min || !budget_max) {
            return res.status(400).json({ error: '請提供完整的預算範圍' });
        }
        
        if (budget_min > budget_max) {
            return res.status(400).json({ error: '最低預算不能大於最高預算' });
        }
        
        const qty = (quantity != null && quantity > 0) ? Number(quantity) : 1;
        const useUnitMode = Boolean(unit && quantity != null && quantity > 0);
        
        console.log('🔍 預媒合測試 (V2.0):', { category, subcategory, budget_min, budget_max, quantity: qty, unit: unit || '(無)' });
        
        // 分類名稱→key（與 run-split 一致，listings 存的是 key）
        let categoryKeyForQuery = category;
        try {
            const { data: catRows } = await supabase.from('ai_categories').select('key, name');
            if (catRows && catRows.length) {
                const nameToKey = {};
                catRows.forEach(r => { if (r.key) nameToKey[r.key] = r.key; if (r.name) nameToKey[r.name] = r.key; });
                if (nameToKey[category]) categoryKeyForQuery = nameToKey[category];
            }
        } catch (_) {}
        
        // ==================== 階段 1：查詢該分類的專家數量與市場價格 (V2.0) ====================
        
        // 查詢該分類的專家（含 unit、price_tiers、tags 以支援單價×數量、階梯定價與標籤篩選）
        const { data: listings, error: listingsError } = await supabase
            .from('listings')
            .select('price_min, price_max, price_tiers, unit, tags')
            .eq('category', categoryKeyForQuery)
            .eq('status', 'active');
        
        const totalInCategory = listings ? listings.length : 0; // 該分類總專家數（未篩單位／標籤）
        
        // 彙整「同分類專家」的標籤（出現次數），供發案方參考以利修正工項標籤
        const expertTagsInCategory = [];
        if (listings && listings.length > 0) {
            const tagCount = {};
            listings.forEach(l => {
                (l.tags || []).filter(t => t && String(t).trim()).forEach(t => {
                    const tag = String(t).trim();
                    tagCount[tag] = (tagCount[tag] || 0) + 1;
                });
            });
            expertTagsInCategory.push(...Object.entries(tagCount)
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 35));
        }
        
        // ==================== 階段 2：篩出符合標籤的專家（單位僅供對照／參考，不用來過濾） ====================
        let candidateListings = listings && listings.length > 0 ? [...listings] : [];
        const requestTags = Array.isArray(bodyTags) && bodyTags.length > 0 ? bodyTags : null;
        if (requestTags && requestTags.length > 0 && candidateListings.length > 0) {
            candidateListings = candidateListings.filter(l => tagsOverlapNormalized(requestTags, l.tags || []));
        }
        
        let totalExperts = candidateListings.length; // 符合標籤的專家數（單位不參與篩選）
        let avgMarketPrice = 0;
        
        // 市場估算價「只來自實際符合條件的專家」：有歷史資料才顯示，不猜測
        if (candidateListings.length > 0) {
            // 優先從市場價格表讀取（須為該子分類之歷史資料）
            if (subcategory) {
                try {
                    const { data: marketPriceData } = await supabase
                        .from('market_prices')
                        .select('market_price')
                        .eq('subcategory', subcategory)
                        .is('tag_filter', null)
                        .maybeSingle();
                    
                    if (marketPriceData && marketPriceData.market_price) {
                        avgMarketPrice = marketPriceData.market_price;
                        console.log(`📊 市場價格 (來自市場價格表): 子分類=${subcategory}, 市場價=${avgMarketPrice}`);
                    }
                } catch (e) {
                    console.error('查詢市場價格表失敗:', e);
                }
            }
            // 若無市場價格表，用「符合條件的專家」底價計算（排除離群值 + 25%）
            if (!avgMarketPrice) {
                const prices = candidateListings
                    .map(l => (useUnitMode && qty ? (() => { const r = resolveUnitPriceForQuantity(l, qty); return (r.unit_price_min + r.unit_price_max) / 2; })() : (l.price_min || 0)))
                    .filter(p => p > 0);
                if (prices.length >= 10) {
                    const sorted = prices.sort((a, b) => a - b);
                    const startIdx = Math.floor(sorted.length * 0.05);
                    const endIdx = Math.ceil(sorted.length * 0.95);
                    const slice = sorted.slice(startIdx, endIdx);
                    avgMarketPrice = Math.round((slice.reduce((s, p) => s + p, 0) / slice.length) * 1.25);
                } else if (prices.length > 0) {
                    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
                    avgMarketPrice = Math.round(avg * 1.25);
                }
                if (avgMarketPrice) console.log(`📊 市場價格 (符合條件專家計算): ${candidateListings.length} 位, 市場價=${avgMarketPrice}`);
            }
        }
        // 無符合條件的專家時不猜測、不顯示任何市場價
        
        // ==================== 階段 3：判斷預算是否合理（僅在有市場價時） ====================
        const marketTotal = useUnitMode ? avgMarketPrice * qty : avgMarketPrice;
        const budgetRatio = marketTotal > 0 ? budget_min / marketTotal : 1;
        let budgetStatus = 'normal';
        if (marketTotal > 0) {
            if (budgetRatio < 0.8) budgetStatus = 'low';
            else if (budgetRatio > 1.2) budgetStatus = 'high';
        }
        console.log(`💰 預算分析: 客戶總預算=${budget_min}~${budget_max}, 符合條件專家=${totalExperts}, 市場${useUnitMode ? `單價×${qty}=總價` : '估算'}=${Math.round(marketTotal)}, 狀態=${budgetStatus}`);
        
        // ==================== 階段 4：計算「報價落在預算區間內」的專家人數 ====================
        let matchedExperts = 0;
        if (candidateListings.length > 0) {
            if (useUnitMode) {
                matchedExperts = candidateListings.filter(l => {
                    const resolved = resolveUnitPriceForQuantity(l, qty);
                    const expertAvgUnit = (resolved.unit_price_min + resolved.unit_price_max) / 2;
                    const expertAvgTotal = expertAvgUnit * qty;
                    return expertAvgTotal >= budget_min && expertAvgTotal <= budget_max;
                }).length;
            } else {
                matchedExperts = candidateListings.filter(l => {
                    return (l.price_min || 0) <= budget_max && (l.price_max || Infinity) >= budget_min;
                }).length;
            }
            console.log(`✅ 真實媒合結果: 符合單位/條件 ${totalExperts} 位 → 報價在預算區間內 ${matchedExperts} 位`);
        }
        // 無符合條件的專家時 matchedExperts 維持 0，不猜測
        
        // ==================== 階段 5：計算百分比和預期回應數 ====================
        
        // 計算百分比
        const matchPercentage = totalExperts > 0 
            ? Math.round((matchedExperts / totalExperts) * 100)
            : 0;
        
        // 預期回應數量（通常是符合專家的 25-45%）
        const minResponses = Math.max(1, Math.floor(matchedExperts * 0.25));
        const maxResponses = Math.max(minResponses, Math.ceil(matchedExperts * 0.45));
        const estimatedResponses = matchedExperts > 0 
            ? `${minResponses}-${maxResponses} 位專家`
            : '0 位專家';
        
        // 當符合條件的專家為 0 時，不回傳市場價（避免顯示來自別處的數字造成混淆）
        const displayMarketPrice = totalExperts > 0 ? avgMarketPrice : 0; // 沒有人符合時不顯示「市場估算成交價」
        
        // 返回結果（含同類專家常用標籤，供發案方參考修正；單位僅供對照，不參與篩選）
        res.json({
            success: true,
            total_experts: totalExperts, // 符合標籤的專家數（單位不篩選）
            total_in_category: totalInCategory, // 該分類總專家數，供顯示用
            matched_experts: matchedExperts, // 報價落在您預算區間內的專家人數
            match_percentage: matchPercentage,
            estimated_responses: estimatedResponses,
            budget_status: budgetStatus,
            avg_market_price: displayMarketPrice, // 僅在「有符合條件的專家」時才回傳，否則為 0
            no_experts_for_unit: false, // 單位不再用於過濾，保留欄位相容
            experts_tag_match_only: totalExperts, // 與 total_experts 一致（單位不篩選）
            units_used_by_tag_matched: (candidateListings || []).length > 0 ? [...new Set((candidateListings || []).map(l => (l.unit || '').toString().trim()).filter(Boolean))] : [], // 供參考：符合專家的單位
            is_real_data: listings && listings.length > 0,
            use_unit_pricing: useUnitMode,
            message: `您的預算範圍符合 ${matchPercentage}% 的專家`,
            note: useUnitMode
                ? '💡 已依「數量×單位」計算：專家單價×您的數量＝專家總價，再與您的總預算比對'
                : '💡 提示：市場價格基於專家底價並排除離群值，加成25%估算實際成交價',
            expert_tags_in_category: expertTagsInCategory // [{ tag, count }, ...] 同分類專家常用標籤，供發案方修正工項標籤
        });
        
    } catch (error) {
        console.error('❌ 預媒合測試失敗:', error);
        res.status(500).json({ error: '預媒合測試失敗', details: error.message });
    }
});

/**
 * POST /api/match/run-split
 * 發包 API：執行真正的媒合，將選中的 project_items 與專家 listings 進行媒合
 * 並寫入 matches 表
 */
app.post('/api/match/run-split', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入後再送出媒合' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { project_id: clientProjectId, item_ids, owner_id: bodyOwnerId, project_location: bodyProjectLocation } = req.body;
        
        if (!Array.isArray(item_ids) || item_ids.length === 0) {
            return res.status(400).json({ error: '請提供至少一個 item_id' });
        }
        
        console.log('🚀 開始執行媒合:', { project_id: clientProjectId, item_ids });
        
        // ==================== 步驟 1：依 item_ids 取得專案項目（草稿與已發包皆可勾選重新發包） ====================
        const { data: rows, error: itemsError } = await supabase
            .from('project_items')
            .select('id, project_id, item_name, item_description, category_name, subcategory, quantity, unit, budget_min, budget_max, requirements')
            .in('id', item_ids);
        
        if (itemsError) {
            console.error('❌ 查詢專案項目失敗:', itemsError);
            return res.status(500).json({ error: '查詢專案項目失敗', details: itemsError.message });
        }
        
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: '找不到可發包的項目（請確認已勾選要發包的項目）' });
        }
        
        const project_id = rows[0].project_id;
        const sameProject = rows.every(r => r.project_id === project_id);
        if (!sameProject) {
            return res.status(400).json({ error: '所選項目必須屬於同一專案' });
        }
        
        // 與預媒合一致：專案資料由前端帶上（前端已用登入者身份讀過），後端不查 projects 就不會「找不到專案」
        let clientId = bodyOwnerId;
        let projectLocation = Array.isArray(bodyProjectLocation) ? bodyProjectLocation : [];
        if (!clientId) {
            const { data: proj, error: projErr } = await supabase
                .from('projects')
                .select('owner_id, project_location')
                .eq('id', project_id)
                .single();
            if (projErr || !proj) {
                console.error('❌ 查詢專案失敗（請由專案詳情頁點「送出媒合」，會自動帶入專案資料）:', projErr?.message || projErr);
                return res.status(404).json({ error: '找不到專案' });
            }
            clientId = proj.owner_id;
            projectLocation = proj.project_location || [];
        }
        if (clientId !== user.id) {
            return res.status(403).json({ error: '只能對自己的專案送出媒合' });
        }
        const projectItems = rows;
        console.log(`📦 找到 ${projectItems.length} 個待發包項目，專案 ID: ${project_id}`);
        
        // 分類名稱→key 對照（listings 存的是 key，project 可能存 key 或中文名）
        let categoryNameToKey = {};
        try {
            const { data: catRows } = await supabase.from('ai_categories').select('key, name');
            if (catRows && catRows.length) {
                catRows.forEach(r => {
                    if (r.key) categoryNameToKey[r.key] = r.key;
                    if (r.name) categoryNameToKey[r.name] = r.key;
                });
            }
        } catch (_) {}
        
        // ==================== 步驟 3：逐項媒合（累積後依 project_id + expert_listing_id 去重再寫入，避免違反 UNIQUE） ====================
        
        const matchAccumulator = new Map(); // key: `${project_id}|${expert_listing_id}`, value: { project_id, expert_listing_id, expert_id, client_id, match_score, match_reasons, status }
        const matchResults = [];
        
        for (const item of projectItems) {
            const categoryKeyForQuery = (item.category_name && categoryNameToKey[item.category_name])
                ? categoryNameToKey[item.category_name]
                : (item.category_name || null);
            console.log(`\n🔍 媒合項目: ${item.item_name} (分類: ${item.category_name} → 查詢 key: ${categoryKeyForQuery})`);
            
            // 3.1 搜尋符合的專家 listings（用 key 查詢，listings.category 存的是 key）
            let query = supabase
                .from('listings')
                .select(`
                    id,
                    expert_id,
                    title,
                    category,
                    subcategory,
                    description,
                    price_min,
                    price_max,
                    price_tiers,
                    unit,
                    tags,
                    service_location,
                    is_remote
                `)
                .eq('status', 'active');
            
            if (categoryKeyForQuery) {
                query = query.eq('category', categoryKeyForQuery);
            }
            
            const { data: listings, error: listingsError } = await query;
            
            if (listingsError) {
                console.error(`❌ 查詢專家失敗 (${item.item_name}):`, listingsError);
                continue;
            }
            
            if (!listings || listings.length === 0) {
                console.log(`⚠️  該分類無專家: ${categoryKeyForQuery || item.category_name}`);
                matchResults.push({
                    item_id: item.id,
                    item_name: item.item_name,
                    matched_count: 0,
                    message: '該分類目前無專家'
                });
                continue;
            }
            
            console.log(`找到 ${listings.length} 位專家，開始過濾地點並計算媒合分數...`);
            
            // 3.2 【過濾條件】地點匹配 - 必須符合才能進入媒合
            const locationFilteredListings = listings.filter(listing => {
                // 如果專案沒有指定地點，則不過濾
                if (!projectLocation || projectLocation.length === 0) {
                    return true;
                }
                
                // 如果專家可遠端服務，直接通過
                if (listing.is_remote) {
                    return true;
                }
                
                // 如果專家有服務區域資料
                if (listing.service_location && listing.service_location.length > 0) {
                    // 檢查是否有交集
                    const hasMatch = projectLocation.some(loc => 
                        listing.service_location.includes(loc) || 
                        listing.service_location.includes('全台灣')
                    );
                    return hasMatch;
                }
                
                // 沒有服務區域資料的專家，保守起見不過濾（可能是舊資料）
                return true;
            });
            
            console.log(`📍 地點過濾後: ${locationFilteredListings.length}/${listings.length} 位專家`);
            
            if (locationFilteredListings.length === 0) {
                matchResults.push({
                    item_id: item.id,
                    item_name: item.item_name,
                    matched_count: 0,
                    message: '該地區無專家服務'
                });
                continue;
            }
            
            // 單位僅供對照／參考，不用來過濾；直接以地點過濾後的列表進行標籤篩選
            // 標籤：刪除「工程」「課程」等通用尾字後兩邊相同即算相符，再過濾
            const itemTags = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
            let tagFilteredListings = locationFilteredListings;
            if (itemTags.length > 0) {
                tagFilteredListings = locationFilteredListings.filter(listing => tagsOverlapNormalized(itemTags, listing.tags || []));
                console.log(`🏷️ 標籤對齊（去尾字後相同即相符）: 工項 ${itemTags.length} 個 → ${tagFilteredListings.length}/${locationFilteredListings.length} 位專家`);
                if (tagFilteredListings.length === 0) {
                    matchResults.push({
                        item_id: item.id,
                        item_name: item.item_name,
                        matched_count: 0,
                        message: `無標籤相符的專家（工項標籤：${itemTags.slice(0, 5).join('、')}${itemTags.length > 5 ? '…' : ''}）；單位僅供參考，未參與篩選`
                    });
                    continue;
                }
            }
            
            // 3.3 計算每個 listing 的媒合分數（總分 100）- V2.0 演算法（單價×客戶數量＝專家總價）；單位供報價對照用
            const quantity = (item.quantity != null && item.quantity > 0) ? Number(item.quantity) : 1;
            const useUnitPricing = Boolean(item.unit && item.quantity != null && item.quantity > 0);
            
            const scoredListings = await Promise.all(tagFilteredListings.map(async listing => {
                let score = 0;
                const reasons = [];
                
                // 記錄地點匹配方式（不計分）
                if (listing.is_remote) {
                    reasons.push('✓ 可遠端服務');
                } else if (projectLocation && projectLocation.length > 0 && listing.service_location) {
                    const matchedLocations = projectLocation.filter(loc => 
                        listing.service_location.includes(loc) || 
                        listing.service_location.includes('全台灣')
                    );
                    if (matchedLocations.length > 0) {
                        reasons.push(`✓ 服務區域: ${matchedLocations.join('、')}`);
                    }
                }
                
                // 【評分項目 1】主分類匹配 (10分)（用解析後的 key 比對）
                if (categoryKeyForQuery && listing.category) {
                    if (categoryKeyForQuery === listing.category) {
                        score += 10;
                        reasons.push('✓ 主分類匹配');
                    }
                }
                
                // 【評分項目 2】子分類匹配 (10分)
                if (item.subcategory && listing.subcategory) {
                    if (item.subcategory === listing.subcategory) {
                        score += 10;
                        reasons.push('✓ 子分類匹配');
                    }
                }
                
                // 【評分項目 3】價格合理度 (40分)
                // 正確邏輯：發包數量給媒合用，用來乘「專家的單價」得到專家總價，再與客戶總預算比對
                // 承包商可設 price_tiers：不同數量區間對應不同單價區間，依客戶數量取對應階梯
                const resolved = resolveUnitPriceForQuantity(listing, quantity);
                if (item.budget_min != null && item.budget_max != null && resolved.unit_price_min != null && resolved.unit_price_max != null) {
                    let expertAvgTotal;   // 專家總價（均）
                    let expertAvgUnitPrice; // 專家單價（均），用於與市場單價比較
                    
                    if (useUnitPricing) {
                        // 專家單價（可能來自 price_tiers 或 price_min/max）× 客戶數量 = 專家總價
                        const expertTotalMin = resolved.unit_price_min * quantity;
                        const expertTotalMax = resolved.unit_price_max * quantity;
                        expertAvgTotal = (expertTotalMin + expertTotalMax) / 2;
                        expertAvgUnitPrice = (resolved.unit_price_min + resolved.unit_price_max) / 2;
                    } else {
                        expertAvgTotal = (resolved.unit_price_min + resolved.unit_price_max) / 2;
                        expertAvgUnitPrice = expertAvgTotal;
                    }
                    
                    // 價格過濾：專家總價（均）必須在客戶總預算範圍內
                    if (expertAvgTotal >= item.budget_min && expertAvgTotal <= item.budget_max) {
                        // 市場價格表存的是「市場單價」
                        let marketUnitPrice = null;
                        
                        if (item.subcategory) {
                            try {
                                const { data: rule } = await supabase
                                    .from('price_calculation_rules')
                                    .select('enable_tag_split, split_tags')
                                    .eq('subcategory', item.subcategory)
                                    .maybeSingle();
                                
                                if (rule?.enable_tag_split && rule.split_tags && listing.tags) {
                                    const matchedTag = listing.tags.find(t => rule.split_tags.includes(t));
                                    if (matchedTag) {
                                        const { data: priceData } = await supabase
                                            .from('market_prices')
                                            .select('market_price')
                                            .eq('subcategory', item.subcategory)
                                            .contains('tag_filter', [matchedTag])
                                            .maybeSingle();
                                        if (priceData) marketUnitPrice = priceData.market_price;
                                    }
                                }
                                if (!marketUnitPrice) {
                                    const { data: priceData } = await supabase
                                        .from('market_prices')
                                        .select('market_price')
                                        .eq('subcategory', item.subcategory)
                                        .is('tag_filter', null)
                                        .maybeSingle();
                                    if (priceData) marketUnitPrice = priceData.market_price;
                                }
                            } catch (e) {
                                console.error('查詢市場價失敗:', e);
                            }
                        }
                        
                        // 價格評分：以「專家單價」與「市場單價」偏差計算
                        if (marketUnitPrice && marketUnitPrice > 0) {
                            const deviation = Math.abs(expertAvgUnitPrice - marketUnitPrice) / marketUnitPrice;
                            const priceScore = Math.round(40 * Math.max(0, 1 - deviation));
                            score += priceScore;
                            reasons.push(`價格合理度 ${priceScore}/40 (偏差 ${Math.round(deviation * 100)}%)`);
                        } else {
                            const overlapMin = Math.max(item.budget_min, resolved.unit_price_min * (useUnitPricing ? quantity : 1));
                            const overlapMax = Math.min(item.budget_max, resolved.unit_price_max * (useUnitPricing ? quantity : 1));
                            if (overlapMax >= overlapMin) {
                                const overlapRange = overlapMax - overlapMin;
                                const itemRange = item.budget_max - item.budget_min;
                                const overlapRatio = itemRange > 0 ? overlapRange / itemRange : 1;
                                const priceScore = Math.round(overlapRatio * 40);
                                score += priceScore;
                                reasons.push(`價格區間重疊 ${Math.round(overlapRatio * 100)}%`);
                            }
                        }
                    }
                }
                
                // 【評分項目 4】關鍵字／標籤相關度 (40分)：工項說明含專家 tag、或工項 tags 與專家 tags 去尾字後相同即計入
                // 註：大量 37 分 = 主分類10 + 子分類10 + 價格約17（預算區間重疊率約42%）+ 關鍵字0；多因工項未填標籤或標籤未對上
                const itemTagsForScore = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
                const itemText = `${item.item_name} ${item.item_description || ''}`.toLowerCase();
                let matchedKeywords = [];
                if (listing.tags && listing.tags.length > 0) {
                    for (const tag of listing.tags) {
                        const tagLower = (tag || '').toLowerCase();
                        if (tagLower && itemText.includes(tagLower)) matchedKeywords.push(tag);
                    }
                    for (const lt of listing.tags) {
                        const ltNorm = normalizeTagForMatch(lt);
                        if (!ltNorm) continue;
                        const hasMatch = itemTagsForScore.some(t => normalizeTagForMatch(t) === ltNorm);
                        if (hasMatch && !matchedKeywords.some(m => normalizeTagForMatch(m) === ltNorm)) matchedKeywords.push(lt);
                    }
                    // 已通過標籤篩選表示工項有標籤且與此專家有交集，若上面未計入（例如正規化差異）則再依篩選邏輯補一次
                    if (itemTags.length > 0 && matchedKeywords.length === 0) {
                        const overlap = listing.tags.filter(lt => itemTags.some(t => normalizeTagForMatch(t) === normalizeTagForMatch(lt)));
                        if (overlap.length > 0) matchedKeywords = overlap;
                    }
                }
                if (matchedKeywords.length > 0) {
                    const totalProjectItems = projectItems.length;
                    const denominator = totalProjectItems * 1.5;
                    const scorePerTag = 40 / denominator;
                    const keywordScore = Math.min(40, Math.round(matchedKeywords.length * scorePerTag));
                    score += keywordScore;
                    reasons.push(`關鍵字/標籤匹配: ${matchedKeywords.slice(0, 3).join('、')} (${matchedKeywords.length}個)`);
                }
                
                return {
                    listing,
                    score,
                    reasons
                };
            }));
            
            // 3.4 篩選分數 >= 30 的專家（至少有基本匹配度：主/子分類匹配 + 部分價格/關鍵字）
            const qualifiedListings = scoredListings.filter(s => s.score >= 30);
            
            console.log(`✅ 符合條件的專家 (V2.0 演算法): ${qualifiedListings.length}/${tagFilteredListings.length}`);
            
            if (qualifiedListings.length === 0) {
                matchResults.push({
                    item_id: item.id,
                    item_name: item.item_name,
                    matched_count: 0,
                    message: '沒有符合條件的專家（分數 < 30，建議調整預算或需求）'
                });
                continue;
            }
            
            // 3.5 累積媒合記錄（同一專案+同一 listing 只保留一筆，取最高分）
            let itemMatchedCount = 0;
            for (const s of qualifiedListings) {
                const key = `${project_id}|${s.listing.id}`;
                const existing = matchAccumulator.get(key);
                const record = {
                    project_id: project_id,
                    expert_listing_id: s.listing.id,
                    expert_id: s.listing.expert_id,
                    client_id: clientId,
                    match_score: s.score,
                    match_reasons: {
                        item_id: item.id,
                        item_name: item.item_name,
                        reasons: s.reasons
                    },
                    status: 'active'
                };
                if (!existing || s.score > existing.match_score) {
                    matchAccumulator.set(key, record);
                }
                itemMatchedCount++;
            }
            
            matchResults.push({
                item_id: item.id,
                item_name: item.item_name,
                matched_count: itemMatchedCount,
                top_matches: qualifiedListings.slice(0, 5).map(s => ({
                    expert_id: s.listing.expert_id,
                    listing_title: s.listing.title,
                    score: s.score,
                    reasons: s.reasons
                }))
            });
            console.log(`✅ 本項目符合 ${itemMatchedCount} 位專家（已累積，稍後統一寫入）`);
        }
        
        // 3.6 一次寫入 matches 表（去重後每組 project_id + expert_listing_id 一筆）
        const matchRecords = Array.from(matchAccumulator.values()).map(r => ({
            project_id: r.project_id,
            expert_listing_id: r.expert_listing_id,
            expert_id: r.expert_id,
            client_id: r.client_id,
            match_score: r.match_score,
            match_reasons: r.match_reasons,
            status: r.status
        }));
        let totalMatches = 0;
        if (matchRecords.length > 0) {
            const { data: insertedMatches, error: matchError } = await supabase
                .from('matches')
                .upsert(matchRecords, { onConflict: 'project_id,expert_listing_id' })
                .select();
            if (matchError) {
                console.error('❌ 寫入媒合記錄失敗:', matchError);
                return res.status(500).json({ error: '寫入媒合記錄失敗', details: matchError.message });
            }
            totalMatches = (insertedMatches || []).length;
            console.log(`✅ 已寫入 ${totalMatches} 筆媒合記錄（專案–專家去重後）`);
        }
        
        // ==================== 步驟 4：更新項目狀態為「已發包」 ====================
        
        const { error: updateError } = await supabase
            .from('project_items')
            .update({ 
                status: 'published',
                published_at: new Date().toISOString()
            })
            .in('id', item_ids);
        
        if (updateError) {
            console.error('❌ 更新項目狀態失敗:', updateError);
        }
        
        // ==================== 步驟 5：返回結果 ====================
        
        console.log(`\n🎉 媒合完成！共建立 ${totalMatches} 筆媒合記錄`);
        
        res.json({
            success: true,
            total_items: projectItems.length,
            total_matches: totalMatches,
            results: matchResults,
            message: `已成功發包 ${projectItems.length} 個項目，媒合到 ${totalMatches} 位專家`,
            next_steps: [
                '媒合引擎已分析每個項目需求',
                '已搜尋符合的專家並計算媒合分數',
                '專家將在通知中看到您的專案',
                '您可以在專案詳情頁查看媒合結果'
            ]
        });
        
    } catch (error) {
        console.error('❌ 發包媒合失敗:', error);
        res.status(500).json({ 
            error: '發包媒合失敗', 
            details: error.message 
        });
    }
});

// 背景執行分類／DB 初始化（listen 已於檔案前段執行）
bootstrapCategories().finally(() => {
    ensureAiCategoriesTableAndSeed().catch(err => console.warn('ensureAiCategoriesTableAndSeed:', err && err.message));
});
