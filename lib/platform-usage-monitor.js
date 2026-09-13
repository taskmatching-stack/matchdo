'use strict';

const { Pool } = require('pg');

const SUPABASE_FREE_LIMITS = {
    database_bytes: 500 * 1024 * 1024,
    storage_bytes: 1024 * 1024 * 1024,
    egress_bytes: 5 * 1024 * 1024 * 1024
};

const LEGACY_SUPABASE_URL_CHECKS = [
    ['custom_products', 'reference_image_url'],
    ['custom_products', 'ai_generated_image_url'],
    ['vendor_assets', 'image_url'],
    ['product_promo_generations', 'source_image_url'],
    ['product_promo_generations', 'result_image_url'],
    ['manufacturer_portfolio', 'image_url'],
    ['manufacturers', 'logo_url']
];

const PAYMENT_CONFIG_SNAPSHOT_KEY = 'platform_usage_supabase_snapshots';

/** 扣點 source → 中文（外部 API 監控用） */
const CREDIT_SOURCE_LABELS = {
    text_to_image: '設計稿文生圖',
    image_to_image: '設計稿圖生圖',
    official_image_to_image: '官方版型圖生圖',
    design_to_physical: '寫實化',
    vendor_asset_optimize: '素材 FLUX 優化',
    print_asset_flux: '印花重繪',
    material_dual_color_flux: '材料組合材質化',
    scene_simulate: '實境模擬',
    pattern_extract: '圖樣提取',
    embed: 'Embed 扣點',
    embed_simulator_generate: 'Embed 模擬器生圖',
    embed_simulator_scene_simulate: 'Embed 實境模擬',
    ai_upscale: 'AI 編輯區放大',
    vendor_asset_upscale: '素材頁放大',
    ai_sketch: '草圖成圖',
    ai_structure: '結構草圖',
    ai_style: '風格化',
    ai_style_transfer: '風格轉移',
    ai_erase: '魔術橡皮擦',
    ai_inpaint: '局部重繪',
    ai_outpaint: '擴圖',
    ai_remove_bg: '去背',
    ai_replace_bg_relight: '換背景／重打光',
    promo_image: '商攝／情境生圖',
    vendor_asset_upload: '素材上傳',
    vendor_asset_description: '素材 AI 描述',
    vendor_asset_regenerate_tags: '素材 AI 標籤',
    custom_product_regenerate_tags: '設計稿 AI 標籤',
    custom_product_generate_description: '設計稿 AI 描述',
    promo_regenerate_tags: '商攝 AI 標籤',
    promo_generate_description: '商攝 AI 描述',
    portfolio_upload_ai: '作品上傳 AI 標籤',
    portfolio_description: '作品 AI 描述',
    portfolio_regenerate_tags: '作品 AI 標籤',
    portfolio_series: '作品系列圖',
    portfolio_before: '作品對照圖',
    message_translate: '訊息翻譯',
    ai_service: '其他 AI 服務',
    generation: '生圖扣點'
};

/** Gemini 相關扣點：不在此頁列入外部 API 供應商統計 */
const GEMINI_EXCLUDED_CREDIT_SOURCES = new Set([
    'promo_image',
    'custom_product_regenerate_tags',
    'custom_product_generate_description',
    'promo_regenerate_tags',
    'promo_generate_description',
    'portfolio_upload_ai',
    'portfolio_description',
    'portfolio_regenerate_tags',
    'vendor_asset_regenerate_tags',
    'vendor_asset_description',
    'message_translate'
]);

const EXTERNAL_API_PROVIDERS = [
    {
        id: 'bfl',
        label: 'FLUX（BFL）',
        link: 'https://api.bfl.ai/',
        link_label: 'BFL 控制台',
        sources: [
            'text_to_image', 'image_to_image', 'official_image_to_image',
            'design_to_physical', 'vendor_asset_optimize', 'print_asset_flux',
            'scene_simulate', 'embed', 'embed_simulator_generate', 'embed_simulator_scene_simulate',
            'generation'
        ]
    },
    {
        id: 'replicate',
        label: 'Replicate（放大）',
        link: 'https://replicate.com/account/billing',
        link_label: 'Replicate 帳單',
        sources: ['ai_upscale', 'vendor_asset_upscale']
    },
    {
        id: 'stability',
        label: 'Stability AI（AI 編輯）',
        link: 'https://platform.stability.ai/account/credits',
        link_label: 'Stability 帳單',
        sources: [
            'ai_sketch', 'ai_structure', 'ai_style', 'ai_style_transfer',
            'ai_erase', 'ai_inpaint', 'ai_outpaint', 'ai_remove_bg', 'ai_replace_bg_relight'
        ]
    },
    {
        id: 'mixed_engine',
        label: '依後台引擎（FLUX／Gemini）',
        link: null,
        link_label: null,
        sources: ['pattern_extract', 'material_dual_color_flux'],
        note: '圖樣提取、材料組合可能走 FLUX 或 Gemini；僅作扣點次數 proxy。'
    }
];

const NON_API_CREDIT_SOURCES = new Set([
    'vendor_asset_upload', 'portfolio_series', 'portfolio_before', 'ai_service'
]);

function supabaseProjectRefFromUrl(url) {
    const m = String(url || '').trim().match(/https:\/\/([^.]+)\.supabase\.co/i);
    return m ? m[1] : null;
}

function monthStartIsoUtc() {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function parseJsonField(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (_) { return null; }
}

function providerLabelForSource(source) {
    const src = String(source || '').trim();
    for (let i = 0; i < EXTERNAL_API_PROVIDERS.length; i++) {
        const p = EXTERNAL_API_PROVIDERS[i];
        if ((p.sources || []).indexOf(src) >= 0) return p.label;
    }
    if (GEMINI_EXCLUDED_CREDIT_SOURCES.has(src)) return 'Gemini（本站統計）';
    if (NON_API_CREDIT_SOURCES.has(src)) return '其他扣點';
    return '未分類';
}

async function fetchSupabaseRowsUpTo(supabase, makeQuery, maxN) {
    const pageSize = 1000;
    const out = [];
    let offset = 0;
    const cap = Math.max(0, parseInt(maxN, 10) || 0) || 100000;
    while (out.length < cap) {
        const take = Math.min(pageSize, cap - out.length);
        const res = await makeQuery().range(offset, offset + take - 1);
        if (res.error) return { data: out, error: res.error, truncated: false };
        const batch = res.data || [];
        out.push.apply(out, batch);
        if (batch.length < take) break;
        offset += batch.length;
    }
    return { data: out, error: null, truncated: out.length >= cap };
}

function usageLevel(used, limit) {
    if (limit == null || limit <= 0) return 'unknown';
    const ratio = used / limit;
    if (ratio >= 1) return 'danger';
    if (ratio >= 0.8) return 'warning';
    return 'ok';
}

function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
    if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
    return n + ' B';
}

function parseSnapshotsJson(raw) {
    if (!raw) return [];
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(parsed.snapshots) ? parsed.snapshots : (Array.isArray(parsed) ? parsed : []);
    } catch (_) {
        return [];
    }
}

/** 避免連線字串 sslmode 覆寫導致 Cloud Run 出現 self-signed certificate */
function sanitizePgConnectionString(dbUrl) {
    if (!dbUrl) return null;
    return String(dbUrl)
        .replace(/[?&]sslmode=[^&]*/gi, '')
        .replace(/\?&/, '?')
        .replace(/\?$/, '');
}

function createPlatformPgPool(dbUrl) {
    const connectionString = sanitizePgConnectionString(dbUrl);
    if (!connectionString) return null;
    return new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 1,
        connectionTimeoutMillis: 12000
    });
}

async function withPlatformPgPool(dbUrl, fn) {
    const pool = createPlatformPgPool(dbUrl);
    if (!pool) return { ok: false, error: 'no_db_url', result: null };
    try {
        const result = await fn(pool);
        return { ok: true, result };
    } catch (e) {
        return { ok: false, error: e.message || String(e), result: null };
    } finally {
        await pool.end().catch(function () {});
    }
}


async function fetchManagementDatabaseQuery(projectRef, token, sql) {
    if (!projectRef || !token) return null;
    try {
        const res = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/query`, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({ query: sql, read_only: true })
        });
        if (!res.ok) return { error: res.status + ' ' + (await res.text()).slice(0, 200) };
        const data = await res.json();
        const row = Array.isArray(data) && data[0] ? data[0] : (data.result && data.result[0]);
        return row || data;
    } catch (e) {
        return { error: e.message || String(e) };
    }
}

async function collectDatabaseSizeBytes(dbUrl, projectRef, mgmtToken) {
    if (projectRef && mgmtToken) {
        const mgmt = await fetchManagementDatabaseQuery(
            projectRef,
            mgmtToken,
            'SELECT pg_database_size(current_database())::bigint AS bytes'
        );
        if (mgmt && mgmt.bytes != null && !mgmt.error) {
            return { bytes: Number(mgmt.bytes) || 0, error: null, source: 'management_api' };
        }
        if (mgmt && mgmt.error) {
            const pg = await collectDatabaseSizeBytesPg(dbUrl);
            return Object.assign(pg, { mgmt_error: mgmt.error });
        }
    }
    return collectDatabaseSizeBytesPg(dbUrl);
}

async function collectDatabaseSizeBytesPg(dbUrl) {
    if (!dbUrl) return { bytes: null, error: null, source: null };
    const wrapped = await withPlatformPgPool(dbUrl, async function (pool) {
        const { rows } = await pool.query('SELECT pg_database_size(current_database())::bigint AS bytes');
        const row = rows && rows[0] ? rows[0] : null;
        return row ? Number(row.bytes) || 0 : 0;
    });
    if (!wrapped.ok) return { bytes: null, error: wrapped.error, source: null };
    return { bytes: wrapped.result, error: null, source: 'supabase_db_url' };
}

async function collectSupabaseStorageObjectsBytes(dbUrl, projectRef, mgmtToken) {
    const sql = `SELECT coalesce(sum((metadata->>'size')::bigint), 0)::bigint AS bytes FROM storage.objects`;
    if (projectRef && mgmtToken) {
        const mgmt = await fetchManagementDatabaseQuery(projectRef, mgmtToken, sql);
        if (mgmt && mgmt.bytes != null && !mgmt.error) {
            return { bytes: Number(mgmt.bytes) || 0, error: null, source: 'management_api' };
        }
        if (mgmt && mgmt.error) {
            const pg = await collectSupabaseStorageObjectsBytesPg(dbUrl);
            return Object.assign(pg, { mgmt_error: mgmt.error });
        }
    }
    return collectSupabaseStorageObjectsBytesPg(dbUrl);
}

async function collectSupabaseStorageObjectsBytesPg(dbUrl) {
    if (!dbUrl) return { bytes: null, error: null, source: null };
    const wrapped = await withPlatformPgPool(dbUrl, async function (pool) {
        const { rows } = await pool.query(`
            SELECT coalesce(sum((metadata->>'size')::bigint), 0)::bigint AS bytes
            FROM storage.objects
        `);
        const row = rows && rows[0] ? rows[0] : null;
        return row ? Number(row.bytes) || 0 : 0;
    });
    if (!wrapped.ok) return { bytes: null, error: wrapped.error, source: null };
    return { bytes: wrapped.result, error: null, source: 'supabase_db_url' };
}

async function collectLegacySupabaseUrlRowsViaSupabase(supabase) {
    if (!supabase) return { total: null, items: [], error: 'no_supabase_client' };
    const items = [];
    let total = 0;
    try {
        for (let i = 0; i < LEGACY_SUPABASE_URL_CHECKS.length; i++) {
            const table = LEGACY_SUPABASE_URL_CHECKS[i][0];
            const col = LEGACY_SUPABASE_URL_CHECKS[i][1];
            const { count, error } = await supabase
                .from(table)
                .select('id', { count: 'exact', head: true })
                .like(col, '%supabase.co/storage%');
            if (error) continue;
            const n = Number(count) || 0;
            if (n > 0) {
                items.push({ table: table, column: col, rows: n });
                total += n;
            }
        }
        return { total, items, error: null };
    } catch (e) {
        return { total: null, items: [], error: e.message || String(e) };
    }
}

async function collectLegacySupabaseUrlRows(dbUrl, supabase) {
    const viaRest = await collectLegacySupabaseUrlRowsViaSupabase(supabase);
    if (!viaRest.error && viaRest.total != null) {
        return Object.assign({ source: 'supabase_rest' }, viaRest);
    }
    if (!dbUrl) return { total: viaRest.total, items: viaRest.items, error: viaRest.error, source: null };
    const wrapped = await withPlatformPgPool(dbUrl, async function (pool) {
        const items = [];
        let total = 0;
        for (let i = 0; i < LEGACY_SUPABASE_URL_CHECKS.length; i++) {
            const table = LEGACY_SUPABASE_URL_CHECKS[i][0];
            const col = LEGACY_SUPABASE_URL_CHECKS[i][1];
            const exists = await pool.query(
                `SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2 LIMIT 1`,
                [table, col]
            );
            if (!exists.rows.length) continue;
            const q = `SELECT count(*)::bigint AS n FROM public.${table}
                WHERE ${col} IS NOT NULL AND ${col}::text LIKE $1`;
            const { rows } = await pool.query(q, ['%supabase.co/storage%']);
            const n = rows && rows[0] ? Number(rows[0].n) || 0 : 0;
            if (n > 0) {
                items.push({ table: table, column: col, rows: n });
                total += n;
            }
        }
        return { total, items };
    });
    if (!wrapped.ok) {
        return {
            total: viaRest.total,
            items: viaRest.items,
            error: wrapped.error || viaRest.error,
            source: null
        };
    }
    return Object.assign({ error: null, source: 'supabase_db_url' }, wrapped.result);
}

async function formatManagementApiError(status, bodyText) {
    let msg = String(bodyText || '').trim();
    try {
        const j = JSON.parse(msg);
        msg = j.message || j.error || j.msg || msg;
    } catch (_) {}
    if (status) return 'HTTP ' + status + '：' + String(msg).slice(0, 160);
    return String(msg).slice(0, 160);
}

async function fetchSupabaseApiCounts(projectRef, token, interval) {
    if (!projectRef || !token) return null;
    try {
        const iv = interval || '1day';
        const res = await fetch(
            `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/analytics/endpoints/usage.api-counts?interval=${encodeURIComponent(iv)}`,
            { headers: { Authorization: 'Bearer ' + token } }
        );
        if (!res.ok) return { error: await formatManagementApiError(res.status, await res.text()) };
        const data = await res.json();
        const list = Array.isArray(data.result) ? data.result : [];
        let auth = 0;
        let rest = 0;
        let storage = 0;
        let realtime = 0;
        list.forEach(function (r) {
            auth += Number(r.total_auth_requests) || 0;
            rest += Number(r.total_rest_requests) || 0;
            storage += Number(r.total_storage_requests) || 0;
            realtime += Number(r.total_realtime_requests) || 0;
        });
        return {
            interval: iv,
            buckets: list.length,
            total_auth_requests: auth,
            total_rest_requests: rest,
            total_storage_requests: storage,
            total_realtime_requests: realtime
        };
    } catch (e) {
        return { error: e.message || String(e) };
    }
}

function labelCreditSource(source) {
    const key = String(source || '').trim();
    return CREDIT_SOURCE_LABELS[key] || key || '其他';
}

function buildProviderRollup(sourceRows) {
    const bySource = {};
    (sourceRows || []).forEach(function (r) {
        bySource[r.source] = { count: r.count, points: r.points };
    });

    const providers = EXTERNAL_API_PROVIDERS.map(function (p) {
        const items = [];
        let totalCount = 0;
        let totalPoints = 0;
        (p.sources || []).forEach(function (src) {
            const row = bySource[src];
            if (!row || row.count <= 0) return;
            items.push({
                source: src,
                label: labelCreditSource(src),
                count: row.count,
                points: row.points
            });
            totalCount += row.count;
            totalPoints += row.points;
        });
        return {
            id: p.id,
            label: p.label,
            link: p.link || null,
            link_label: p.link_label || null,
            note: p.note || null,
            total_count: totalCount,
            total_points: totalPoints,
            items: items
        };
    });

    const geminiExcluded = [];
    const otherNonApi = [];
    const unmapped = [];

    Object.keys(bySource).forEach(function (src) {
        const row = bySource[src];
        if (!row || row.count <= 0) return;
        const inProvider = EXTERNAL_API_PROVIDERS.some(function (p) {
            return (p.sources || []).indexOf(src) >= 0;
        });
        if (inProvider) return;
        const entry = {
            source: src,
            label: labelCreditSource(src),
            count: row.count,
            points: row.points
        };
        if (GEMINI_EXCLUDED_CREDIT_SOURCES.has(src)) {
            geminiExcluded.push(entry);
        } else if (NON_API_CREDIT_SOURCES.has(src)) {
            otherNonApi.push(entry);
        } else {
            unmapped.push(entry);
        }
    });

    geminiExcluded.sort(function (a, b) { return b.count - a.count; });
    otherNonApi.sort(function (a, b) { return b.count - a.count; });
    unmapped.sort(function (a, b) { return b.count - a.count; });

    return { providers, gemini_excluded: geminiExcluded, other_non_api: otherNonApi, unmapped };
}

function aggregateCreditRowsBySource(rows) {
    const bySource = {};
    (rows || []).forEach(function (r) {
        const src = (r.source && String(r.source).trim()) || 'unknown';
        const pts = Math.abs(parseInt(r.amount, 10) || 0);
        if (!bySource[src]) bySource[src] = { count: 0, points: 0 };
        bySource[src].count += 1;
        bySource[src].points += pts;
    });
    return Object.keys(bySource).map(function (src) {
        const row = bySource[src];
        return {
            source: src,
            label: labelCreditSource(src),
            count: row.count,
            points: row.points,
            gemini_excluded: GEMINI_EXCLUDED_CREDIT_SOURCES.has(src)
        };
    }).sort(function (a, b) { return b.count - a.count; });
}

function finalizeExternalUsageMonth(out) {
    out.rollup = buildProviderRollup(out.by_source || []);
    const rep = out.rollup.providers.find(function (p) { return p.id === 'replicate'; });
    out.replicate_upscale = rep ? rep.total_count : 0;
    const stab = out.rollup.providers.find(function (p) { return p.id === 'stability'; });
    out.stability_ai_edits = stab ? stab.total_count : 0;
    return out;
}

async function collectCreditUsageViaSupabase(supabase, since) {
    if (!supabase) return { by_source: [], error: 'no_supabase_client', rows_scanned: 0 };
    try {
        const fetched = await fetchSupabaseRowsUpTo(supabase, function () {
            return supabase
                .from('credit_transactions')
                .select('source, amount')
                .eq('type', 'consumed')
                .lt('amount', 0)
                .gte('created_at', since)
                .order('created_at', { ascending: false });
        }, 100000);
        if (fetched.error) return { by_source: [], error: fetched.error.message || String(fetched.error), rows_scanned: 0 };
        const bySource = aggregateCreditRowsBySource(fetched.data || []);
        bySource.forEach(function (row) {
            row.provider_label = providerLabelForSource(row.source);
        });
        return {
            by_source: bySource,
            error: null,
            rows_scanned: (fetched.data || []).length,
            truncated: !!fetched.truncated
        };
    } catch (e) {
        return { by_source: [], error: e.message || String(e), rows_scanned: 0 };
    }
}

function promoRowIsFlux(meta) {
    const m = parseJsonField(meta);
    if (!m) return false;
    if (m.image_provider === 'flux') return true;
    return !!(m.flux_model && String(m.flux_model).trim());
}

function promoRowIsGrok(meta) {
    const m = parseJsonField(meta);
    if (!m) return false;
    if (m.image_provider === 'grok') return true;
    return !!(m.grok_model && String(m.grok_model).trim());
}

function emptyImageProviderCounts(error) {
    return {
        flux_design_generations: null,
        flux_promo_generations: null,
        grok_promo_generations: null,
        promo_total_generations: null,
        error: error || null
    };
}

function parseXaiPrepaidUsd(total) {
    if (total == null) return null;
    const raw = (typeof total === 'object' && total.val != null) ? total.val : total;
    const n = Number(String(raw).trim());
    if (!Number.isFinite(n)) return null;
    return -n / 100;
}

async function resolveXaiManagementKey(supabase) {
    const envKey = String(process.env.XAI_MANAGEMENT_API_KEY || process.env.XAI_MANAGEMENT_KEY || '').trim();
    if (envKey) return { key: envKey, source: 'env' };
    if (!supabase) return { key: '', source: null };
    try {
        const { data } = await supabase.from('payment_config').select('value').eq('key', 'xai_management_api_key').maybeSingle();
        const key = String((data && data.value) || '').trim();
        return { key: key, source: key ? 'db' : null };
    } catch (_) {
        return { key: '', source: null };
    }
}

async function resolveXaiInferenceKey(supabase) {
    const envKey = String(process.env.XAI_API_KEY || process.env.GROK_API_KEY || '').trim();
    if (envKey) return { key: envKey, source: 'env' };
    if (!supabase) return { key: '', source: null };
    try {
        const { data } = await supabase.from('payment_config').select('value').eq('key', 'xai_api_key').maybeSingle();
        const key = String((data && data.value) || '').trim();
        return { key: key, source: key ? 'db' : null };
    } catch (_) {
        return { key: '', source: null };
    }
}

async function collectFluxCountsViaSupabase(supabase, since) {
    if (!supabase) {
        return emptyImageProviderCounts('no_supabase_client');
    }
    try {
        const [designRes, promoRes] = await Promise.all([
            fetchSupabaseRowsUpTo(supabase, function () {
                return supabase
                    .from('custom_products')
                    .select('id, generation_meta_json')
                    .gte('created_at', since)
                    .not('ai_generated_image_url', 'is', null)
                    .order('created_at', { ascending: false });
            }, 50000),
            fetchSupabaseRowsUpTo(supabase, function () {
                return supabase
                    .from('product_promo_generations')
                    .select('id, generation_meta_json')
                    .gte('created_at', since)
                    .order('created_at', { ascending: false });
            }, 50000)
        ]);
        if (designRes.error) {
            return emptyImageProviderCounts(designRes.error.message || String(designRes.error));
        }
        if (promoRes.error) {
            return emptyImageProviderCounts(promoRes.error.message || String(promoRes.error));
        }
        let fluxDesign = 0;
        (designRes.data || []).forEach(function (row) {
            const meta = parseJsonField(row.generation_meta_json);
            if (meta && String(meta.used_flux) === 'true') fluxDesign += 1;
        });
        let fluxPromo = 0;
        let grokPromo = 0;
        const promoTotal = (promoRes.data || []).length;
        (promoRes.data || []).forEach(function (row) {
            if (promoRowIsGrok(row.generation_meta_json)) grokPromo += 1;
            else if (promoRowIsFlux(row.generation_meta_json)) fluxPromo += 1;
        });
        return {
            flux_design_generations: fluxDesign,
            flux_promo_generations: fluxPromo,
            grok_promo_generations: grokPromo,
            promo_total_generations: promoTotal,
            error: null,
            truncated: !!(designRes.truncated || promoRes.truncated),
            source: 'supabase_rest'
        };
    } catch (e) {
        return emptyImageProviderCounts(e.message || String(e));
    }
}

async function collectFluxCountsViaPg(dbUrl, since) {
    if (!dbUrl) return emptyImageProviderCounts(null);
    const wrapped = await withPlatformPgPool(dbUrl, async function (pool) {
        const [designRow, promoFluxRow, promoGrokRow, promoTotalRow] = await Promise.all([
            pool.query(`
                SELECT count(*)::bigint AS n FROM public.custom_products
                WHERE created_at >= $1::timestamptz
                  AND coalesce(generation_meta_json->>'used_flux', 'false') = 'true'
            `, [since]),
            pool.query(`
                SELECT count(*)::bigint AS n FROM public.product_promo_generations
                WHERE created_at >= $1::timestamptz
                  AND NOT (
                    generation_meta_json->>'image_provider' = 'grok'
                    OR coalesce(generation_meta_json->>'grok_model', '') <> ''
                  )
                  AND (
                    generation_meta_json->>'image_provider' = 'flux'
                    OR coalesce(generation_meta_json->>'flux_model', '') <> ''
                  )
            `, [since]),
            pool.query(`
                SELECT count(*)::bigint AS n FROM public.product_promo_generations
                WHERE created_at >= $1::timestamptz
                  AND (
                    generation_meta_json->>'image_provider' = 'grok'
                    OR coalesce(generation_meta_json->>'grok_model', '') <> ''
                  )
            `, [since]),
            pool.query(`
                SELECT count(*)::bigint AS n FROM public.product_promo_generations
                WHERE created_at >= $1::timestamptz
            `, [since])
        ]);
        return {
            flux_design_generations: Number(designRow.rows[0] && designRow.rows[0].n) || 0,
            flux_promo_generations: Number(promoFluxRow.rows[0] && promoFluxRow.rows[0].n) || 0,
            grok_promo_generations: Number(promoGrokRow.rows[0] && promoGrokRow.rows[0].n) || 0,
            promo_total_generations: Number(promoTotalRow.rows[0] && promoTotalRow.rows[0].n) || 0
        };
    });
    if (!wrapped.ok) {
        return emptyImageProviderCounts(wrapped.error);
    }
    return Object.assign({ error: null }, wrapped.result);
}

async function collectExternalApiUsageMonth(supabase, dbUrl, monthStart) {
    const since = monthStart || monthStartIsoUtc();
    const out = {
        period_start: since,
        flux_design_generations: null,
        flux_promo_generations: null,
        grok_promo_generations: null,
        promo_total_generations: null,
        by_source: [],
        rollup: null,
        replicate_upscale: null,
        stability_ai_edits: null,
        data_source: null,
        errors: []
    };

    const creditViaSupabase = await collectCreditUsageViaSupabase(supabase, since);
    if (!creditViaSupabase.error) {
        out.by_source = creditViaSupabase.by_source;
        out.data_source = 'supabase_rest';
    } else {
        out.errors.push('扣點統計（REST）：' + creditViaSupabase.error);
        if (dbUrl) {
            const wrapped = await withPlatformPgPool(dbUrl, async function (pool) {
                const { rows } = await pool.query(`
                    SELECT source, count(*)::bigint AS n, coalesce(sum(abs(amount)), 0)::bigint AS points
                    FROM public.credit_transactions
                    WHERE created_at >= $1::timestamptz
                      AND type = 'consumed'
                      AND amount < 0
                    GROUP BY source
                    ORDER BY n DESC
                `, [since]);
                return (rows || []).map(function (r) {
                    return {
                        source: r.source,
                        label: labelCreditSource(r.source),
                        count: Number(r.n) || 0,
                        points: Number(r.points) || 0,
                        gemini_excluded: GEMINI_EXCLUDED_CREDIT_SOURCES.has(r.source)
                    };
                });
            });
            if (wrapped.ok) {
                out.by_source = wrapped.result;
                out.data_source = 'supabase_db_url';
            } else if (wrapped.error && wrapped.error !== 'no_db_url') {
                out.errors.push('扣點統計（DB）：' + wrapped.error);
            }
        }
    }

    const fluxCounts = await collectFluxCountsViaSupabase(supabase, since);
    if (!fluxCounts.error) {
        out.flux_design_generations = fluxCounts.flux_design_generations;
        out.flux_promo_generations = fluxCounts.flux_promo_generations;
        out.grok_promo_generations = fluxCounts.grok_promo_generations;
        out.promo_total_generations = fluxCounts.promo_total_generations;
        out.flux_source = fluxCounts.source || 'supabase_rest';
        if (fluxCounts.truncated) out.errors.push('FLUX／Grok 紀錄統計：已達掃描上限，數字可能偏低');
    } else if (dbUrl) {
        const fluxPg = await collectFluxCountsViaPg(dbUrl, since);
        if (fluxPg.error && fluxPg.error !== 'no_db_url') out.errors.push('FLUX／Grok 紀錄統計：' + fluxPg.error);
        out.flux_design_generations = fluxPg.flux_design_generations;
        out.flux_promo_generations = fluxPg.flux_promo_generations;
        out.grok_promo_generations = fluxPg.grok_promo_generations;
        out.promo_total_generations = fluxPg.promo_total_generations;
        out.flux_source = fluxPg.error ? null : 'supabase_db_url';
    } else {
        out.errors.push('FLUX／Grok 紀錄統計：' + fluxCounts.error);
    }

    if (creditViaSupabase.rows_scanned != null) out.credit_rows_scanned = creditViaSupabase.rows_scanned;
    if (creditViaSupabase.truncated) out.errors.push('扣點統計：已達掃描上限，數字可能偏低');

    if (out.errors.length) out.error = out.errors.join('；');
    return finalizeExternalUsageMonth(out);
}

function buildSupabaseStatus(auto, latestManual) {
    const dbBytes = auto.database_bytes != null ? auto.database_bytes
        : (latestManual && latestManual.db_size_mb != null ? latestManual.db_size_mb * 1024 * 1024 : null);
    const storageBytes = auto.storage_objects_bytes != null ? auto.storage_objects_bytes
        : (latestManual && latestManual.storage_gb != null ? latestManual.storage_gb * 1024 * 1024 * 1024 : null);
    const egressBytes = latestManual && latestManual.egress_gb != null
        ? latestManual.egress_gb * 1024 * 1024 * 1024
        : null;

    const freePlan = {
        database: {
            used_bytes: dbBytes,
            limit_bytes: SUPABASE_FREE_LIMITS.database_bytes,
            level: dbBytes != null ? usageLevel(dbBytes, SUPABASE_FREE_LIMITS.database_bytes) : 'unknown',
            label: dbBytes != null ? formatBytes(dbBytes) + ' / 500 MB' : '—'
        },
        storage: {
            used_bytes: storageBytes,
            limit_bytes: SUPABASE_FREE_LIMITS.storage_bytes,
            level: storageBytes != null ? usageLevel(storageBytes, SUPABASE_FREE_LIMITS.storage_bytes) : 'unknown',
            label: storageBytes != null ? formatBytes(storageBytes) + ' / 1 GB' : '—'
        },
        egress: {
            used_bytes: egressBytes,
            limit_bytes: SUPABASE_FREE_LIMITS.egress_bytes,
            level: egressBytes != null ? usageLevel(egressBytes, SUPABASE_FREE_LIMITS.egress_bytes) : 'unknown',
            label: egressBytes != null ? formatBytes(egressBytes) + ' / 5 GB（月）' : '—（官方無 API，可選填快照）'
        }
    };

    const levels = [freePlan.database.level, freePlan.storage.level, freePlan.egress.level];
    let overall = 'ok';
    if (levels.indexOf('danger') >= 0) overall = 'danger';
    else if (levels.indexOf('warning') >= 0) overall = 'warning';
    else if (levels.indexOf('unknown') >= 0 && levels.indexOf('ok') < 0) overall = 'unknown';

    let recommendation = '目前自動指標在 Free 安全範圍內；Egress 請每月對照 Supabase Usage 填寫快照。';
    if (freePlan.storage.level === 'danger' || freePlan.storage.level === 'warning') {
        recommendation = 'Storage 偏高：完成 GCS 雙存期後清空 Supabase Storage，再評估降 Free。';
    } else if (freePlan.database.level === 'danger' || freePlan.database.level === 'warning') {
        recommendation = 'Database 接近 Free 上限（500 MB），建議維持 Pro 或清理歷史資料。';
    } else if (freePlan.egress.level === 'danger' || freePlan.egress.level === 'warning') {
        recommendation = 'Egress 接近 Free 月上限（5 GB），建議維持 Pro 或減少 API／Storage 讀取。';
    } else if (auto.legacy_supabase_url_rows != null && auto.legacy_supabase_url_rows > 0) {
        recommendation = 'DB 內仍有 ' + auto.legacy_supabase_url_rows + ' 筆 Supabase Storage URL；Phase 5 清空後再降 Free。';
    }

    return { free_plan: freePlan, overall_level: overall, recommendation };
}

async function loadSnapshots(supabase) {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase.from('payment_config').select('value').eq('key', PAYMENT_CONFIG_SNAPSHOT_KEY).maybeSingle();
        if (error) return [];
        return parseSnapshotsJson(data && data.value);
    } catch (_) {
        return [];
    }
}

async function saveSnapshot(supabase, entry) {
    const snapshots = await loadSnapshots(supabase);
    snapshots.unshift(entry);
    const trimmed = snapshots.slice(0, 36);
    const payload = { snapshots: trimmed };
    const { error } = await supabase.from('payment_config').upsert({
        key: PAYMENT_CONFIG_SNAPSHOT_KEY,
        value: JSON.stringify(payload),
        updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
    if (error) throw error;
    return trimmed;
}

async function fetchVendorBalances(supabase) {
    const out = {
        bfl: { credits: null, error: null, endpoint: 'GET https://api.bfl.ai/v1/credits' },
        stability: { credits: null, error: null, endpoint: 'GET https://api.stability.ai/v1/user/balance' },
        replicate: { username: null, type: null, error: null, endpoint: 'GET https://api.replicate.com/v1/account', note: 'Replicate 無官方餘額 API，下方為本站放大扣點統計' },
        grok: {
            connected: false,
            name: null,
            team_id: null,
            api_key_blocked: null,
            credits_usd: null,
            key_source: null,
            error: null,
            endpoint: 'GET https://api.x.ai/v1/api-key',
            note: '生圖用推論金鑰查不到餘額；預付美元要用 Management API 金鑰'
        }
    };
    const bflKey = process.env.BFL_API_KEY;
    if (bflKey) {
        try {
            const res = await fetch('https://api.bfl.ai/v1/credits', { headers: { 'x-key': bflKey, Accept: 'application/json' } });
            const data = await res.json().catch(function () { return {}; });
            if (!res.ok) out.bfl.error = (data && data.detail) ? String(data.detail) : ('HTTP ' + res.status);
            else out.bfl.credits = data.credits != null ? Number(data.credits) : null;
        } catch (e) {
            out.bfl.error = e.message || String(e);
        }
    } else {
        out.bfl.error = '未設定 BFL_API_KEY';
    }

    const stabKey = process.env.STABILITY_API_KEY || process.env.STABILITY_AI_API_KEY || process.env.STABILITY_AI_KEY || process.env.STABILITY_KEY;
    if (stabKey) {
        try {
            const res = await fetch('https://api.stability.ai/v1/user/balance', {
                headers: { Authorization: 'Bearer ' + stabKey, Accept: 'application/json' }
            });
            const data = await res.json().catch(function () { return {}; });
            if (!res.ok) out.stability.error = (data && data.message) ? String(data.message) : ('HTTP ' + res.status);
            else out.stability.credits = data.credits != null ? Number(data.credits) : null;
        } catch (e) {
            out.stability.error = e.message || String(e);
        }
    } else {
        out.stability.error = '未設定 STABILITY_API_KEY';
    }

    const repToken = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY;
    if (repToken) {
        try {
            const res = await fetch('https://api.replicate.com/v1/account', {
                headers: { Authorization: 'Bearer ' + String(repToken).trim(), Accept: 'application/json' }
            });
            const data = await res.json().catch(function () { return {}; });
            if (!res.ok) out.replicate.error = (data && data.detail) ? String(data.detail) : ('HTTP ' + res.status);
            else {
                out.replicate.username = data.username || null;
                out.replicate.type = data.type || null;
            }
        } catch (e) {
            out.replicate.error = e.message || String(e);
        }
    } else {
        out.replicate.error = '未設定 REPLICATE_API_TOKEN';
    }

    const xai = await resolveXaiInferenceKey(supabase);
    out.grok.key_source = xai.source;
    if (xai.key) {
        try {
            const res = await fetch('https://api.x.ai/v1/api-key', {
                headers: { Authorization: 'Bearer ' + xai.key, Accept: 'application/json' }
            });
            const data = await res.json().catch(function () { return {}; });
            if (!res.ok) {
                out.grok.error = (data && (data.error && data.error.message || data.message || data.detail))
                    ? String(data.error && data.error.message || data.message || data.detail)
                    : ('HTTP ' + res.status);
            } else {
                out.grok.connected = true;
                out.grok.name = data.name || null;
                out.grok.team_id = data.team_id || null;
                out.grok.api_key_blocked = data.api_key_blocked === true || data.api_key_disabled === true || data.team_blocked === true;
                out.grok.redacted_api_key = data.redacted_api_key || null;
            }
        } catch (e) {
            out.grok.error = e.message || String(e);
        }
    } else {
        out.grok.error = '未設定 XAI_API_KEY（環境變數或後台 xai_api_key）';
    }

    const mgmt = await resolveXaiManagementKey(supabase);
    out.grok.management_key_source = mgmt.source;
    const mgmtKey = mgmt.key;
    const teamId = String(process.env.XAI_TEAM_ID || (out.grok && out.grok.team_id) || '').trim();
    if (!mgmtKey) {
        out.grok.balance_error = '未設定 Management API 金鑰（後台寬鬆尺度或 Cloud Run XAI_MANAGEMENT_API_KEY）。生圖用推論金鑰查不到餘額。';
    } else if (!teamId) {
        out.grok.balance_error = '已有 Management Key，但沒有 team_id（推論金鑰連線後才會帶出，或設 XAI_TEAM_ID）';
    } else if (mgmtKey && teamId) {
        try {
            const res = await fetch('https://management-api.x.ai/v1/billing/teams/' + encodeURIComponent(teamId) + '/prepaid/balance', {
                headers: { Authorization: 'Bearer ' + mgmtKey, Accept: 'application/json' }
            });
            const data = await res.json().catch(function () { return {}; });
            if (!res.ok) {
                const msg = (data && (data.error && data.error.message || data.message || data.detail))
                    ? String(data.error && data.error.message || data.message || data.detail)
                    : ('HTTP ' + res.status);
                out.grok.balance_error = msg;
            } else {
                const usd = parseXaiPrepaidUsd(data.total);
                if (usd == null) out.grok.balance_error = '無法解析 prepaid total';
                else out.grok.credits_usd = usd;
            }
        } catch (e) {
            out.grok.balance_error = e.message || String(e);
        }
    }
    return out;
}

async function buildPlatformUsageReport(opts) {
    const supabase = opts.supabase;
    const dbUrl = opts.dbUrl || process.env.SUPABASE_DB_URL || null;
    const supabaseUrl = opts.supabaseUrl || process.env.SUPABASE_URL || '';
    const mgmtToken = opts.mgmtToken || process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MANAGEMENT_TOKEN || '';
    const projectRef = opts.projectRef || supabaseProjectRefFromUrl(supabaseUrl);
    const warnings = [];

    const monthStart = monthStartIsoUtc();
    const [dbSizeRes, storageRes, legacyUrls, external, snapshots, vendorBalances] = await Promise.all([
        collectDatabaseSizeBytes(dbUrl, projectRef, mgmtToken),
        collectSupabaseStorageObjectsBytes(dbUrl, projectRef, mgmtToken),
        collectLegacySupabaseUrlRows(dbUrl, supabase),
        collectExternalApiUsageMonth(supabase, dbUrl, monthStart),
        loadSnapshots(supabase),
        fetchVendorBalances(supabase)
    ]);

    if (dbSizeRes.error) warnings.push('Database 自動查詢：' + dbSizeRes.error);
    if (dbSizeRes.mgmt_error) warnings.push('Management API（Database）：' + dbSizeRes.mgmt_error);
    if (storageRes.error) warnings.push('Storage 自動查詢：' + storageRes.error);
    if (storageRes.mgmt_error) warnings.push('Management API（Storage）：' + storageRes.mgmt_error);
    if (legacyUrls.error) warnings.push('Legacy URL 統計：' + legacyUrls.error);
    if (external.error) warnings.push(external.error);
    if (external.errors && external.errors.length) {
        external.errors.forEach(function (e) {
            if (warnings.indexOf(e) < 0) warnings.push(e);
        });
    }

    const databaseBytes = dbSizeRes.bytes;
    const storageBytes = storageRes.bytes;

    let apiCounts = null;
    if (projectRef && mgmtToken) {
        apiCounts = await fetchSupabaseApiCounts(projectRef, mgmtToken, '7day');
        if (apiCounts && apiCounts.error) warnings.push('近 7 日 API 請求：' + apiCounts.error);
    }

    const latestManual = snapshots.length ? snapshots[0] : null;
    const auto = {
        database_bytes: databaseBytes,
        storage_objects_bytes: storageBytes,
        legacy_supabase_url_rows: legacyUrls.total,
        legacy_supabase_url_breakdown: legacyUrls.items,
        legacy_url_source: legacyUrls.source || null,
        api_counts_7d: apiCounts && !apiCounts.error ? apiCounts : null,
        api_counts_error: apiCounts && apiCounts.error ? apiCounts.error : null,
        pg_errors: {
            database: dbSizeRes.error || null,
            storage: storageRes.error || null,
            legacy_urls: legacyUrls.error || null
        },
        data_sources: {
            database: dbSizeRes.source || (latestManual && latestManual.db_size_mb != null ? 'manual_snapshot' : 'unavailable'),
            storage_objects: storageRes.source || (latestManual && latestManual.storage_gb != null ? 'manual_snapshot' : 'unavailable'),
            egress: latestManual && latestManual.egress_gb != null ? 'manual_snapshot' : 'unavailable'
        }
    };

    const setupHints = [
        !mgmtToken ? '請在 Cloud Run 設定 SUPABASE_ACCESS_TOKEN（PAT，含 Database Read + Usage Analytics）以自動查 DB／Storage。' : null,
        mgmtToken && !dbSizeRes.source ? 'Management API 無法讀取 Database，請確認 PAT 權限。' : null,
        'Supabase Egress（GB）官方 Management API 不提供 org 級流量；僅能從 Usage 儀表板查看，或選填下方快照備份。',
        'BFL／Stability 餘額來自各平台官方 API；Replicate 無餘額 API。Grok 生圖金鑰只能查連線；預付美元需 Management API 金鑰（後台寬鬆尺度或 Cloud Run XAI_MANAGEMENT_API_KEY）。用量見本站扣點／generation_meta。'
    ].filter(Boolean);

    return {
        generated_at: new Date().toISOString(),
        month_start_utc: monthStart,
        warnings,
        supabase: {
            project_ref: projectRef || null,
            auto,
            manual_snapshots: snapshots,
            status: buildSupabaseStatus(auto, latestManual),
            dashboard_links: {
                usage: 'https://supabase.com/dashboard/org/_/usage',
                billing: 'https://supabase.com/dashboard/org/_/billing'
            },
            setup_hints: setupHints
        },
        external_apis: {
            month: external,
            vendor_balances: vendorBalances,
            links: {
                bfl: 'https://docs.bfl.ai/api-reference/get-the-users-credits',
                replicate: 'https://replicate.com/docs/reference/http',
                stability: 'https://platform.stability.ai/docs/api-reference#tag/v1user/operation/userBalance',
                grok: 'https://console.x.ai',
                gcp_billing: 'https://console.cloud.google.com/billing'
            },
            note: '本月次數／點數來自 credit_transactions；BFL／Stability 餘額為官方 API 即時查詢。Grok 預付美元需 Management API 金鑰。Gemini 生圖與標籤不在此頁統計；商攝實驗 Grok 次數見 generation_meta proxy。'
        }
    };
}

module.exports = {
    PAYMENT_CONFIG_SNAPSHOT_KEY,
    SUPABASE_FREE_LIMITS,
    EXTERNAL_API_PROVIDERS,
    CREDIT_SOURCE_LABELS,
    buildPlatformUsageReport,
    loadSnapshots,
    saveSnapshot,
    formatBytes,
    usageLevel,
    labelCreditSource,
    buildProviderRollup
};
