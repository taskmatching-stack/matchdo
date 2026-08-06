'use strict';

/** 從 material_combo 物件擷取可聚合欄位（主色／配色材質、HEX、配色範例來源等） */
function parseMaterialComboSnapshot(raw, meta) {
    if (!raw || typeof raw !== 'object') return null;
    const main = raw.main && typeof raw.main === 'object' ? raw.main : {};
    const accent = raw.accent && typeof raw.accent === 'object' ? raw.accent : {};
    const third = raw.third && typeof raw.third === 'object' ? raw.third : null;
    const mainMat = String(main.material || '').trim();
    const accentMat = String(accent.material || '').trim();
    const mainHex = String(main.hex || '').trim().toUpperCase();
    const accentHex = String(accent.hex || '').trim().toUpperCase();
    if (!mainMat && !accentMat && !mainHex && !accentHex) return null;

    const colorCount = raw.color_count === 3 || third ? 3 : 2;
    const sp = raw.source_palette && typeof raw.source_palette === 'object' ? raw.source_palette : null;
    const paletteKey = sp && (sp.id || sp.name)
        ? [sp.scope || '', sp.type_name || '', sp.name || '', sp.id || ''].join('|')
        : null;

    return {
        source: (meta && meta.source) || 'unknown',
        source_id: (meta && meta.source_id) || null,
        created_at: (meta && meta.created_at) || null,
        color_count: colorCount,
        main_material: mainMat || null,
        accent_material: accentMat || null,
        third_material: third ? (String(third.material || '').trim() || null) : null,
        main_hex: mainHex || null,
        accent_hex: accentHex || null,
        third_hex: third && third.hex ? String(third.hex).trim().toUpperCase() : null,
        ratio_percents: Array.isArray(raw.ratio_percents) ? raw.ratio_percents.slice() : null,
        palette_id: sp && sp.id ? String(sp.id) : null,
        palette_scope: sp && sp.scope ? String(sp.scope) : null,
        palette_type_name: sp && sp.type_name ? String(sp.type_name) : null,
        palette_name: sp && sp.name ? String(sp.name) : null,
        palette_key: paletteKey,
        generation_id: raw.source_generation_id ? String(raw.source_generation_id) : ((meta && meta.generation_id) || null)
    };
}

function extractCombosFromReferenceSources(sources) {
    const out = [];
    const list = Array.isArray(sources) ? sources : [];
    list.forEach(function (s) {
        if (!s || !s.material_combo) return;
        const snap = parseMaterialComboSnapshot(s.material_combo, { source: 'design_reference' });
        if (snap) out.push(snap);
    });
    return out;
}

function bumpCount(map, key, inc) {
    if (!key) return;
    const k = String(key).trim();
    if (!k) return;
    map[k] = (map[k] || 0) + (inc || 1);
}

function topEntries(countMap, limit) {
    return Object.keys(countMap)
        .map(function (k) { return { label: k, count: countMap[k] }; })
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, limit || 30);
}

function topPaletteEntries(countMap, limit) {
    return Object.keys(countMap)
        .map(function (k) {
            let meta = {};
            try { meta = JSON.parse(k); } catch (_) { meta = { name: k }; }
            return Object.assign({}, meta, { count: countMap[k] });
        })
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, limit || 30);
}

/** 聚合多筆 snapshot（已 flatten） */
function aggregateMaterialComboSnapshots(snapshots, opts) {
    const options = opts || {};
    const limit = Math.min(100, Math.max(5, parseInt(options.top_limit, 10) || 30));
    const mainMat = {};
    const accentMat = {};
    const thirdMat = {};
    const pairs = {};
    const palettes = {};
    let dual = 0;
    let tri = 0;
    let fromGenerations = 0;
    let fromDesign = 0;
    let withPalette = 0;

    (snapshots || []).forEach(function (s) {
        if (!s) return;
        if (s.color_count === 3) tri += 1;
        else dual += 1;
        if (s.source === 'generation') fromGenerations += 1;
        if (s.source === 'design_reference') fromDesign += 1;
        bumpCount(mainMat, s.main_material);
        bumpCount(accentMat, s.accent_material);
        if (s.third_material) bumpCount(thirdMat, s.third_material);
        if (s.main_material || s.accent_material) {
            const pairKey = (s.main_material || '—') + ' + ' + (s.accent_material || '—')
                + (s.third_material ? (' + ' + s.third_material) : '');
            bumpCount(pairs, pairKey);
        }
        if (s.palette_key) {
            withPalette += 1;
            bumpCount(palettes, JSON.stringify({
                id: s.palette_id || null,
                scope: s.palette_scope || null,
                type_name: s.palette_type_name || null,
                name: s.palette_name || null
            }));
        }
    });

    const recent = (snapshots || []).slice()
        .sort(function (a, b) {
            const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
            const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
            return tb - ta;
        })
        .slice(0, Math.min(20, limit));

    return {
        summary: {
            total: (snapshots || []).length,
            dual_count: dual,
            tri_count: tri,
            from_generations: fromGenerations,
            from_design_references: fromDesign,
            with_palette_source: withPalette
        },
        top_main_materials: topEntries(mainMat, limit),
        top_accent_materials: topEntries(accentMat, limit),
        top_third_materials: topEntries(thirdMat, limit),
        top_material_combinations: topEntries(pairs, limit),
        top_palette_sources: topPaletteEntries(palettes, limit),
        recent_samples: recent
    };
}

module.exports = {
    parseMaterialComboSnapshot,
    extractCombosFromReferenceSources,
    aggregateMaterialComboSnapshots
};
