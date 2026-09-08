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

async function queryPoolOne(dbUrl, sql, params) {
    if (!dbUrl) return null;
    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    try {
        const { rows } = await pool.query(sql, params || []);
        return rows && rows[0] ? rows[0] : null;
    } finally {
        await pool.end().catch(function () {});
    }
}

async function collectSupabaseStorageObjectsBytes(dbUrl) {
    const row = await queryPoolOne(dbUrl, `
        SELECT coalesce(sum((metadata->>'size')::bigint), 0)::bigint AS bytes
        FROM storage.objects
    `);
    return row ? Number(row.bytes) || 0 : null;
}

async function collectDatabaseSizeBytes(dbUrl) {
    const row = await queryPoolOne(dbUrl, 'SELECT pg_database_size(current_database())::bigint AS bytes');
    return row ? Number(row.bytes) || 0 : null;
}

async function collectLegacySupabaseUrlRows(dbUrl) {
    if (!dbUrl) return { total: null, items: [] };
    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    const items = [];
    let total = 0;
    try {
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
    } finally {
        await pool.end().catch(function () {});
    }
    return { total, items };
}

async function fetchManagementDatabaseQuery(projectRef, token, sql) {
    if (!projectRef || !token) return null;
    try {
        const res = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/query`, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json'
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

async function fetchSupabaseApiCounts(projectRef, token, interval) {
    if (!projectRef || !token) return null;
    try {
        const iv = interval || '1d';
        const res = await fetch(
            `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/analytics/endpoints/usage.api-counts?interval=${encodeURIComponent(iv)}`,
            { headers: { Authorization: 'Bearer ' + token } }
        );
        if (!res.ok) return { error: res.status + ' ' + (await res.text()).slice(0, 200) };
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

async function collectExternalApiUsageMonth(dbUrl, monthStart) {
    const since = monthStart || monthStartIsoUtc();
    const out = {
        period_start: since,
        flux_design_generations: null,
        flux_promo_generations: null,
        promo_total_generations: null,
        by_source: [],
        rollup: null,
        replicate_upscale: null,
        stability_ai_edits: null
    };
    if (!dbUrl) return out;

    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    try {
        const [
            designRow,
            promoFluxRow,
            promoTotalRow,
            srcRows
        ] = await Promise.all([
            pool.query(`
                SELECT count(*)::bigint AS n FROM public.custom_products
                WHERE created_at >= $1::timestamptz
                  AND coalesce(generation_meta_json->>'used_flux', 'false') = 'true'
            `, [since]),
            pool.query(`
                SELECT count(*)::bigint AS n FROM public.product_promo_generations
                WHERE created_at >= $1::timestamptz
                  AND (
                    generation_meta_json->>'image_provider' = 'flux'
                    OR coalesce(generation_meta_json->>'flux_model', '') <> ''
                  )
            `, [since]),
            pool.query(`
                SELECT count(*)::bigint AS n FROM public.product_promo_generations
                WHERE created_at >= $1::timestamptz
            `, [since]),
            pool.query(`
                SELECT source, count(*)::bigint AS n, coalesce(sum(abs(amount)), 0)::bigint AS points
                FROM public.credit_transactions
                WHERE created_at >= $1::timestamptz
                  AND type = 'consumed'
                  AND amount < 0
                GROUP BY source
                ORDER BY n DESC
            `, [since])
        ]);

        out.flux_design_generations = Number(designRow.rows[0] && designRow.rows[0].n) || 0;
        out.flux_promo_generations = Number(promoFluxRow.rows[0] && promoFluxRow.rows[0].n) || 0;
        out.promo_total_generations = Number(promoTotalRow.rows[0] && promoTotalRow.rows[0].n) || 0;

        out.by_source = (srcRows.rows || []).map(function (r) {
            return {
                source: r.source,
                label: labelCreditSource(r.source),
                count: Number(r.n) || 0,
                points: Number(r.points) || 0,
                gemini_excluded: GEMINI_EXCLUDED_CREDIT_SOURCES.has(r.source)
            };
        });

        out.rollup = buildProviderRollup(out.by_source);

        const rep = out.rollup.providers.find(function (p) { return p.id === 'replicate'; });
        out.replicate_upscale = rep ? rep.total_count : 0;

        const stab = out.rollup.providers.find(function (p) { return p.id === 'stability'; });
        out.stability_ai_edits = stab ? stab.total_count : 0;
    } catch (e) {
        out.error = e.message || String(e);
    } finally {
        await pool.end().catch(function () {});
    }
    return out;
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
            label: egressBytes != null ? formatBytes(egressBytes) + ' / 5 GB（月）' : '—（請從 Usage 頁填寫）'
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
    const { data } = await supabase.from('payment_config').select('value').eq('key', PAYMENT_CONFIG_SNAPSHOT_KEY).maybeSingle();
    return parseSnapshotsJson(data && data.value);
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

async function buildPlatformUsageReport(opts) {
    const supabase = opts.supabase;
    const dbUrl = opts.dbUrl || process.env.SUPABASE_DB_URL || null;
    const supabaseUrl = opts.supabaseUrl || process.env.SUPABASE_URL || '';
    const mgmtToken = opts.mgmtToken || process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MANAGEMENT_TOKEN || '';
    const projectRef = opts.projectRef || supabaseProjectRefFromUrl(supabaseUrl);

    const monthStart = monthStartIsoUtc();
    const [dbSize, storageBytes, legacyUrls, external, snapshots] = await Promise.all([
        collectDatabaseSizeBytes(dbUrl),
        collectSupabaseStorageObjectsBytes(dbUrl),
        collectLegacySupabaseUrlRows(dbUrl),
        collectExternalApiUsageMonth(dbUrl, monthStart),
        loadSnapshots(supabase)
    ]);

    let mgmtDb = null;
    if (dbSize == null && projectRef && mgmtToken) {
        mgmtDb = await fetchManagementDatabaseQuery(
            projectRef,
            mgmtToken,
            'SELECT pg_database_size(current_database())::bigint AS bytes'
        );
    }
    const databaseBytes = dbSize != null ? dbSize
        : (mgmtDb && mgmtDb.bytes != null ? Number(mgmtDb.bytes) : null);

    let apiCounts = null;
    if (projectRef && mgmtToken) {
        apiCounts = await fetchSupabaseApiCounts(projectRef, mgmtToken, '1d');
    }

    const latestManual = snapshots.length ? snapshots[0] : null;
    const auto = {
        database_bytes: databaseBytes,
        storage_objects_bytes: storageBytes,
        legacy_supabase_url_rows: legacyUrls.total,
        legacy_supabase_url_breakdown: legacyUrls.items,
        api_counts_1d: apiCounts && !apiCounts.error ? apiCounts : null,
        api_counts_error: apiCounts && apiCounts.error ? apiCounts.error : null,
        data_sources: {
            database: dbSize != null ? 'supabase_db_url' : (databaseBytes != null ? 'management_api' : 'unavailable'),
            storage_objects: storageBytes != null ? 'supabase_db_url' : 'unavailable',
            egress: latestManual ? 'manual_snapshot' : 'unavailable'
        }
    };

    return {
        generated_at: new Date().toISOString(),
        month_start_utc: monthStart,
        supabase: {
            project_ref: projectRef || null,
            auto,
            manual_snapshots: snapshots,
            status: buildSupabaseStatus(auto, latestManual),
            dashboard_links: {
                usage: 'https://supabase.com/dashboard/org/_/usage',
                billing: 'https://supabase.com/dashboard/org/_/billing'
            },
            setup_hints: [
                !dbUrl ? '設定環境變數 SUPABASE_DB_URL 可自動查 DB／Storage 物件大小。' : null,
                !mgmtToken ? '選填 SUPABASE_ACCESS_TOKEN（Management API）可顯示近 24h API 請求量。' : null,
                'Egress／帳單週期總量請在 Supabase Usage 頁查看後，於下方表單填寫月快照。'
            ].filter(Boolean)
        },
        external_apis: {
            month: external,
            links: {
                bfl: 'https://api.bfl.ai/',
                replicate: 'https://replicate.com/account/billing',
                stability: 'https://platform.stability.ai/account/credits',
                gcp_billing: 'https://console.cloud.google.com/billing'
            },
            note: '次數／點數為本站扣點 proxy，非供應商帳單美金；Gemini 生圖與標籤不在此頁統計。'
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
