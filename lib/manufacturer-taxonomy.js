'use strict';

let taxonomyReadyCache = null;
let taxonomyReadyCacheAt = 0;
const TAXONOMY_READY_TTL_MS = 60 * 1000;

async function taxonomyTablesReady(client) {
    const now = Date.now();
    if (taxonomyReadyCache != null && (now - taxonomyReadyCacheAt) < TAXONOMY_READY_TTL_MS) {
        return taxonomyReadyCache;
    }
    try {
        const r = await client.query(
            `SELECT to_regclass('public.taxonomy_nodes') IS NOT NULL AS ok`
        );
        taxonomyReadyCache = !!r.rows[0]?.ok;
    } catch (_) {
        taxonomyReadyCache = false;
    }
    taxonomyReadyCacheAt = now;
    return taxonomyReadyCache;
}

async function taxonomyTablesReadySupabase(supabase) {
    try {
        const { error } = await supabase.from('taxonomy_nodes').select('key').limit(1);
        if (error && (error.code === '42P01' || String(error.message || '').includes('taxonomy_nodes'))) {
            return false;
        }
        return !error;
    } catch (_) {
        return false;
    }
}

function parseJsonStringArray(raw) {
    if (raw == null || raw === '') return [];
    if (Array.isArray(raw)) {
        return raw.map((x) => String(x).trim()).filter(Boolean);
    }
    const s = String(raw).trim();
    if (!s) return [];
    if (s.startsWith('[')) {
        try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) {
                return parsed.map((x) => String(x).trim()).filter(Boolean);
            }
        } catch (_) { /* fall through */ }
    }
    return s.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
}

function parseCapabilityKeysFromBody(body) {
    if (!body || body.capability_keys === undefined) return undefined;
    return parseJsonStringArray(body.capability_keys);
}

function parseProductionTypeKeyFromBody(body) {
    if (!body || body.production_type_key === undefined) return undefined;
    const v = String(body.production_type_key || '').trim();
    return v || null;
}

async function listTaxonomyNodes(supabase, opts) {
    const dimension = (opts && opts.dimension) ? String(opts.dimension).trim() : 'capability';
    const parentKey = (opts && opts.parent_key) ? String(opts.parent_key).trim() : null;
    const leafOnly = !!(opts && opts.leaf_only);
    let q = supabase
        .from('taxonomy_nodes')
        .select('key, dimension, parent_key, depth, name_zh, name_en, aliases, moq_hint_json, sort_order')
        .eq('dimension', dimension)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name_zh', { ascending: true });
    if (parentKey) q = q.eq('parent_key', parentKey);
    if (leafOnly) q = q.eq('depth', 2);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

async function searchTaxonomyNodes(supabase, query, opts) {
    const q = String(query || '').trim().toLowerCase();
    const dimension = (opts && opts.dimension) ? String(opts.dimension).trim() : 'capability';
    const limit = Math.min(Math.max(parseInt(opts && opts.limit, 10) || 20, 1), 50);
    if (!q) return [];
    const { data, error } = await supabase
        .from('taxonomy_nodes')
        .select('key, dimension, parent_key, depth, name_zh, name_en, aliases, sort_order')
        .eq('dimension', dimension)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
    if (error) throw error;
    const rows = data || [];
    const matched = rows.filter((row) => {
        if (dimension === 'capability' && row.depth !== 2) return false;
        const name = String(row.name_zh || '').toLowerCase();
        const nameEn = String(row.name_en || '').toLowerCase();
        const key = String(row.key || '').toLowerCase();
        if (name.includes(q) || nameEn.includes(q) || key.includes(q)) return true;
        const aliases = Array.isArray(row.aliases) ? row.aliases : [];
        return aliases.some((a) => String(a).toLowerCase().includes(q));
    });
    return matched.slice(0, limit);
}

async function validateProductionTypeKey(supabase, key) {
    if (!key) return { ok: true, key: null };
    const { data, error } = await supabase
        .from('taxonomy_nodes')
        .select('key')
        .eq('key', key)
        .eq('dimension', 'production_type')
        .eq('is_active', true)
        .maybeSingle();
    if (error) return { ok: false, error: '查詢生產模式失敗' };
    if (!data) return { ok: false, error: '無效的生產模式' };
    return { ok: true, key };
}

async function validateCapabilityLeafKeys(supabase, keys) {
    const unique = [...new Set((keys || []).map((k) => String(k).trim()).filter(Boolean))];
    if (!unique.length) return { ok: true, keys: [] };
    const { data, error } = await supabase
        .from('taxonomy_nodes')
        .select('key, depth')
        .in('key', unique)
        .eq('dimension', 'capability')
        .eq('is_active', true);
    if (error) return { ok: false, error: '查詢工藝失敗' };
    const found = new Set((data || []).filter((r) => r.depth === 2).map((r) => r.key));
    const invalid = unique.filter((k) => !found.has(k));
    if (invalid.length) {
        return { ok: false, error: '無效的工藝項目：' + invalid.slice(0, 3).join('、') };
    }
    return { ok: true, keys: unique };
}

async function replaceVendorAssetCapabilities(supabase, assetId, capabilityKeys) {
    const id = String(assetId || '').trim();
    if (!id) return;
    await supabase.from('vendor_asset_taxonomy_links').delete().eq('asset_id', id);
    const keys = capabilityKeys || [];
    if (!keys.length) return;
    const rows = keys.map((taxonomy_key) => ({ asset_id: id, taxonomy_key }));
    const { error } = await supabase.from('vendor_asset_taxonomy_links').insert(rows);
    if (error) throw error;
}

async function loadCapabilitiesByAssetIds(supabase, assetIds) {
    const ids = [...new Set((assetIds || []).map((x) => String(x).trim()).filter(Boolean))];
    const out = {};
    ids.forEach((id) => { out[id] = []; });
    if (!ids.length) return out;
    const { data: links, error: linkErr } = await supabase
        .from('vendor_asset_taxonomy_links')
        .select('asset_id, taxonomy_key')
        .in('asset_id', ids);
    if (linkErr) throw linkErr;
    const keys = [...new Set((links || []).map((l) => l.taxonomy_key))];
    if (!keys.length) return out;
    const { data: nodes, error: nodeErr } = await supabase
        .from('taxonomy_nodes')
        .select('key, name_zh, parent_key, depth, sort_order')
        .in('key', keys)
        .eq('dimension', 'capability');
    if (nodeErr) throw nodeErr;
    const nodeByKey = {};
    (nodes || []).forEach((n) => { nodeByKey[n.key] = n; });
    (links || []).forEach((l) => {
        const n = nodeByKey[l.taxonomy_key];
        if (!n) return;
        if (!out[l.asset_id]) out[l.asset_id] = [];
        out[l.asset_id].push({
            key: n.key,
            label: n.name_zh || n.key,
            parent_key: n.parent_key || null
        });
    });
    Object.keys(out).forEach((aid) => {
        out[aid].sort((a, b) => String(a.label).localeCompare(String(b.label), 'zh-Hant'));
    });
    return out;
}

async function loadProductionTypeLabels(supabase, keys) {
    const unique = [...new Set((keys || []).map((k) => String(k).trim()).filter(Boolean))];
    const out = {};
    if (!unique.length) return out;
    const { data, error } = await supabase
        .from('taxonomy_nodes')
        .select('key, name_zh')
        .in('key', unique)
        .eq('dimension', 'production_type');
    if (error) throw error;
    (data || []).forEach((r) => { out[r.key] = r.name_zh || r.key; });
    return out;
}

async function enrichVendorAssetItems(supabase, items) {
    if (!items || !items.length) return items;
    const ready = await taxonomyTablesReadySupabase(supabase);
    if (!ready) return items;
    const ids = items.map((it) => it.id).filter(Boolean);
    const ptKeys = items.map((it) => it.production_type_key).filter(Boolean);
    const [capMap, ptLabels] = await Promise.all([
        loadCapabilitiesByAssetIds(supabase, ids),
        loadProductionTypeLabels(supabase, ptKeys)
    ]);
    return items.map((it) => {
        const caps = capMap[it.id] || [];
        const ptKey = it.production_type_key || null;
        return {
            ...it,
            production_type_key: ptKey,
            production_type_label: ptKey ? (ptLabels[ptKey] || null) : null,
            capabilities: caps,
            capability_keys: caps.map((c) => c.key),
            capability_labels: caps.map((c) => c.label)
        };
    });
}

async function applyVendorAssetTaxonomyWrites(supabase, assetId, body) {
    const ready = await taxonomyTablesReadySupabase(supabase);
    if (!ready) {
        const hasCap = parseCapabilityKeysFromBody(body) !== undefined;
        const hasPt = parseProductionTypeKeyFromBody(body) !== undefined;
        if (hasCap || hasPt) {
            return '請先執行 docs/add-manufacturer-taxonomy.sql（廠商分類三維度）';
        }
        return null;
    }
    const capKeys = parseCapabilityKeysFromBody(body);
    if (capKeys !== undefined) {
        const valid = await validateCapabilityLeafKeys(supabase, capKeys);
        if (!valid.ok) return valid.error;
        await replaceVendorAssetCapabilities(supabase, assetId, valid.keys);
    }
    return null;
}

module.exports = {
    taxonomyTablesReady,
    taxonomyTablesReadySupabase,
    parseCapabilityKeysFromBody,
    parseProductionTypeKeyFromBody,
    listTaxonomyNodes,
    searchTaxonomyNodes,
    validateProductionTypeKey,
    validateCapabilityLeafKeys,
    replaceVendorAssetCapabilities,
    loadCapabilitiesByAssetIds,
    loadProductionTypeLabels,
    enrichVendorAssetItems,
    applyVendorAssetTaxonomyWrites
};
