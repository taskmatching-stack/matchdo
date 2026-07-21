/**
 * 設計風向：從 custom_products 聚合生圖分類與 tags 數量／趨勢，供設計意圖分析 prompt 附錄。
 */

const TAG_DIMS = ['style', 'material', 'color', 'structure', 'mood', 'use_case'];
const RECENT_DAYS = 30;
const COMPARE_DAYS = 30;
const SAMPLE_LIMIT = 800;

function rowIsExcludedSample(row) {
    if (!row) return true;
    if (row.is_vendor_self_serve === true) return true;
    const aj = row.analysis_json && typeof row.analysis_json === 'object' ? row.analysis_json : {};
    if (aj.embed_visitor_design === true || aj.source === 'embed') return true;
    const dl = row.data_lineage_json && typeof row.data_lineage_json === 'object' ? row.data_lineage_json : {};
    return dl.embed_visitor_design === true || dl.source === 'embed';
}

function rowTs(row) {
    const t = row && row.created_at ? new Date(row.created_at).getTime() : NaN;
    return Number.isFinite(t) ? t : null;
}

function bumpTag(map, tag) {
    const s = String(tag || '').trim();
    if (!s) return;
    map[s] = (map[s] || 0) + 1;
}

function collectTags(row, dimMaps) {
    const byDim = row.ai_tags_by_dimension;
    if (byDim && typeof byDim === 'object') {
        TAG_DIMS.forEach(function (dim) {
            const arr = Array.isArray(byDim[dim]) ? byDim[dim] : [];
            if (!dimMaps[dim]) dimMaps[dim] = {};
            arr.forEach(function (t) { bumpTag(dimMaps[dim], t); });
        });
    }
    const flat = Array.isArray(row.ai_tags) ? row.ai_tags : [];
    if (!dimMaps.all) dimMaps.all = {};
    flat.forEach(function (t) { bumpTag(dimMaps.all, t); });
}

function topFromMap(map, limit) {
    return Object.entries(map || {})
        .sort(function (a, b) { return b[1] - a[1]; })
        .slice(0, limit)
        .map(function (e) { return { tag: e[0], count: e[1] }; });
}

function growthFromMaps(recentMap, priorMap, limit) {
    const keys = new Set([].concat(Object.keys(recentMap || {}), Object.keys(priorMap || {})));
    const out = [];
    keys.forEach(function (tag) {
        const r = (recentMap && recentMap[tag]) || 0;
        const p = (priorMap && priorMap[tag]) || 0;
        if (r < 2) return;
        let pct;
        if (p === 0) pct = r >= 3 ? 100 : null;
        else pct = Math.round(((r - p) / p) * 100);
        if (pct != null && pct > 0) out.push({ tag: tag, recent: r, prior: p, growth_pct: pct });
    });
    out.sort(function (a, b) {
        return b.growth_pct - a.growth_pct || b.recent - a.recent;
    });
    return out.slice(0, limit);
}

function pctChange(recent, prior) {
    if (prior === 0) return recent > 0 ? 100 : 0;
    return Math.round(((recent - prior) / prior) * 100);
}

function aggregateRows(rows, opts) {
    opts = opts || {};
    const subKey = (opts.subCategoryKey || '').trim();
    const now = Date.now();
    const recentMs = RECENT_DAYS * 86400000;
    const compareMs = COMPARE_DAYS * 86400000;
    const recentStart = now - recentMs;
    const priorStart = now - recentMs - compareMs;

    let total = 0;
    let subTotal = 0;
    let recentTotal = 0;
    let priorTotal = 0;
    let subRecent = 0;
    let subPrior = 0;
    const recentDim = {};
    const priorDim = {};

    (rows || []).forEach(function (row) {
        if (rowIsExcludedSample(row)) return;
        total += 1;
        const ts = rowTs(row);
        const isRecent = ts != null && ts >= recentStart;
        const isPrior = ts != null && ts >= priorStart && ts < recentStart;
        if (isRecent) recentTotal += 1;
        if (isPrior) priorTotal += 1;

        const matchSub = subKey && String(row.subcategory_key || '') === subKey;
        if (matchSub) {
            subTotal += 1;
            if (isRecent) subRecent += 1;
            if (isPrior) subPrior += 1;
        }

        if (isRecent) collectTags(row, recentDim);
        if (isPrior) collectTags(row, priorDim);
    });

    const subcategoryCounts = {};
    (rows || []).forEach(function (row) {
        if (rowIsExcludedSample(row)) return;
        const sk = String(row.subcategory_key || '').trim() || '(未指定子分類)';
        subcategoryCounts[sk] = (subcategoryCounts[sk] || 0) + 1;
    });

    return {
        sample_size: total,
        window_days: RECENT_DAYS,
        compare_days: COMPARE_DAYS,
        category_total: total,
        category_recent: recentTotal,
        category_prior: priorTotal,
        category_growth_pct: pctChange(recentTotal, priorTotal),
        subcategory_key: subKey || null,
        subcategory_total: subKey ? subTotal : null,
        subcategory_recent: subKey ? subRecent : null,
        subcategory_prior: subKey ? subPrior : null,
        subcategory_growth_pct: subKey ? pctChange(subRecent, subPrior) : null,
        subcategory_ranking: topFromMap(subcategoryCounts, 8).map(function (e) {
            return { subcategory_key: e.tag, count: e.count };
        }),
        tags_top: {
            style: topFromMap(recentDim.style, 5),
            material: topFromMap(recentDim.material, 5),
            color: topFromMap(recentDim.color, 5),
            all: topFromMap(recentDim.all, 8)
        },
        tags_rising: growthFromMaps(recentDim.all, priorDim.all, 5)
    };
}

async function fetchCategoryRows(supabase, mainCategoryKey, isSupabaseMissingColumnError) {
    const fullCols = 'id, category, subcategory_key, ai_tags, ai_tags_by_dimension, created_at, is_vendor_self_serve, analysis_json, data_lineage_json';
    const liteCols = 'id, category, subcategory_key, ai_tags, created_at, analysis_json';
    let res = await supabase
        .from('custom_products')
        .select(fullCols)
        .eq('category', mainCategoryKey)
        .not('ai_generated_image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(SAMPLE_LIMIT);
    if (res.error && isSupabaseMissingColumnError && isSupabaseMissingColumnError(res.error, 'ai_tags_by_dimension')) {
        res = await supabase
            .from('custom_products')
            .select(liteCols)
            .eq('category', mainCategoryKey)
            .not('ai_generated_image_url', 'is', null)
            .order('created_at', { ascending: false })
            .limit(SAMPLE_LIMIT);
    }
    if (res.error && isSupabaseMissingColumnError && isSupabaseMissingColumnError(res.error, 'is_vendor_self_serve')) {
        res = await supabase
            .from('custom_products')
            .select(liteCols)
            .eq('category', mainCategoryKey)
            .not('ai_generated_image_url', 'is', null)
            .order('created_at', { ascending: false })
            .limit(SAMPLE_LIMIT);
    }
    return res;
}

async function aggregateDesignDirectionMarketSignals(supabase, opts, isSupabaseMissingColumnError) {
    opts = opts || {};
    const mainCategoryKey = (opts.mainCategoryKey || opts.category_key || '').trim();
    if (!mainCategoryKey) return null;
    const subCategoryKey = (opts.subCategoryKey || opts.subcategory_key || '').trim() || null;

    const res = await fetchCategoryRows(supabase, mainCategoryKey, isSupabaseMissingColumnError);
    if (res.error) {
        console.warn('aggregateDesignDirectionMarketSignals:', res.error.message || res.error);
        return null;
    }
    const signals = aggregateRows(res.data || [], { subCategoryKey: subCategoryKey });
    signals.category_key = mainCategoryKey;
    return signals;
}

function formatTagList(items, emptyLabel) {
    if (!items || !items.length) return emptyLabel || '（樣本不足）';
    return items.map(function (it) {
        return it.tag + '×' + it.count;
    }).join('、');
}

function formatGrowthList(items) {
    if (!items || !items.length) return '（近' + RECENT_DAYS + '日無明顯成長標籤）';
    return items.map(function (it) {
        return it.tag + ' ▲' + it.growth_pct + '%（' + it.recent + '／前' + COMPARE_DAYS + '日' + it.prior + '）';
    }).join('；');
}

function formatDesignDirectionMarketSignalsAppendix(signals, subLabel) {
    if (!signals || signals.sample_size < 1) {
        return '【平台生圖數據參考】同品類域尚無足夠公開生圖樣本；請僅依參考圖與使用者描述做設計意圖分析。';
    }
    const lines = [
        '【平台生圖數據參考（近' + signals.window_days + '日 vs 前' + signals.compare_days + '日；樣本 ' + signals.sample_size + ' 筆）】',
        '請將下列分類數量與 tags 趨勢與使用者參考圖／描述綜合分析：指出對齊熱門風向、差異化或冷門機會；勿只複述數字，勿輸出改裝／再製方案。',
        '- 主分類累計生圖：' + signals.category_total + ' 筆；近' + signals.window_days + '日 ' + signals.category_recent + ' 筆（' + (signals.category_growth_pct >= 0 ? '▲' : '▼') + Math.abs(signals.category_growth_pct) + '% vs 前' + signals.compare_days + '日）'
    ];
    if (subLabel && signals.subcategory_key) {
        lines.push('- 子品類「' + subLabel + '」：' + (signals.subcategory_total || 0) + ' 筆；近' + signals.window_days + '日 ' + (signals.subcategory_recent || 0) + ' 筆（' + (signals.subcategory_growth_pct >= 0 ? '▲' : '▼') + Math.abs(signals.subcategory_growth_pct || 0) + '%）');
    }
    if (signals.subcategory_ranking && signals.subcategory_ranking.length) {
        lines.push('- 子分類生圖量 Top：' + signals.subcategory_ranking.map(function (r) {
            return r.subcategory_key + '×' + r.count;
        }).join('、'));
    }
    lines.push('- 近' + signals.window_days + '日熱門 style 標籤：' + formatTagList(signals.tags_top && signals.tags_top.style));
    lines.push('- 近' + signals.window_days + '日熱門 material 標籤：' + formatTagList(signals.tags_top && signals.tags_top.material));
    lines.push('- 近' + signals.window_days + '日熱門 color 標籤：' + formatTagList(signals.tags_top && signals.tags_top.color));
    lines.push('- 成長標籤：' + formatGrowthList(signals.tags_rising));
    return lines.join('\n');
}

module.exports = {
    aggregateDesignDirectionMarketSignals,
    formatDesignDirectionMarketSignalsAppendix,
    aggregateRows
};
