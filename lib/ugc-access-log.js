'use strict';

const ITEM_TYPES = {
    custom_products: 'user_design',
    product_promo_generations: 'promo_scene'
};

function itemTypeFromTable(table) {
    return ITEM_TYPES[table] || null;
}

function accessPathLabel(path) {
    const p = String(path || '').trim();
    const map = {
        owner_library_detail: '本人圖庫詳情',
        media_wall_item: '靈感牆／公開詳情',
        inspiration_page: '靈感獨立頁',
        favorites_open: '收藏開啟'
    };
    return map[p] || p || '—';
}

async function logUgcAccess(supabase, opts) {
    if (!supabase || !opts) return { ok: false };
    const itemType = String(opts.itemType || '').trim();
    const itemId = String(opts.itemId || '').trim();
    const accessPath = String(opts.accessPath || 'unknown').trim();
    if (!itemType || !itemId || !accessPath) return { ok: false };
    const row = {
        item_type: itemType,
        item_id: itemId,
        access_path: accessPath,
        viewer_user_id: opts.viewerUserId || null,
        metadata_json: (opts.metadata && typeof opts.metadata === 'object') ? opts.metadata : {}
    };
    const { error } = await supabase.from('ugc_access_events').insert(row);
    if (error) {
        if (error.code === '42P01' || error.code === '42703') return { ok: false, skipped: true };
        return { ok: false, error: error.message };
    }
    return { ok: true };
}

async function fetchAccessStatsForItems(supabase, pairs) {
    const out = {};
    if (!supabase || !pairs || !pairs.length) return out;
    const byType = {};
    pairs.forEach(function (p) {
        const itemType = String(p.item_type || '').trim();
        const itemId = String(p.item_id || '').trim();
        if (!itemType || !itemId) return;
        const key = itemType + ':' + itemId;
        if (out[key]) return;
        out[key] = { access_count: 0, last_access_event_at: null, last_access_path: null };
        if (!byType[itemType]) byType[itemType] = [];
        byType[itemType].push(itemId);
    });
    const types = Object.keys(byType);
    for (let t = 0; t < types.length; t++) {
        const itemType = types[t];
        const ids = [...new Set(byType[itemType])].slice(0, 200);
        if (!ids.length) continue;
        const { data, error } = await supabase
            .from('ugc_access_events')
            .select('item_id, access_path, accessed_at')
            .eq('item_type', itemType)
            .in('item_id', ids)
            .order('accessed_at', { ascending: false })
            .limit(5000);
        if (error) {
            if (error.code === '42P01') return {};
            continue;
        }
        (data || []).forEach(function (row) {
            const key = itemType + ':' + row.item_id;
            const slot = out[key];
            if (!slot) return;
            slot.access_count += 1;
            if (!slot.last_access_event_at) {
                slot.last_access_event_at = row.accessed_at;
                slot.last_access_path = row.access_path;
            }
        });
    }
    return out;
}

async function listAccessEventsForItem(supabase, itemType, itemId, opts) {
    if (!supabase || !itemType || !itemId) return { items: [], total: 0 };
    const limit = Math.min(200, Math.max(1, parseInt(opts && opts.limit, 10) || 50));
    const offset = Math.max(0, parseInt(opts && opts.offset, 10) || 0);
    const { data, error, count } = await supabase
        .from('ugc_access_events')
        .select('id, item_type, item_id, access_path, viewer_user_id, accessed_at, metadata_json', { count: 'exact' })
        .eq('item_type', String(itemType))
        .eq('item_id', String(itemId))
        .order('accessed_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) {
        if (error.code === '42P01') return { items: [], total: 0, unavailable: true };
        throw error;
    }
    const viewerIds = [...new Set((data || []).map(function (r) { return r.viewer_user_id; }).filter(Boolean))];
    const emailById = {};
    if (viewerIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, email, full_name').in('id', viewerIds);
        (profs || []).forEach(function (p) {
            if (p && p.id) emailById[p.id] = p;
        });
    }
    const items = (data || []).map(function (r) {
        const prof = r.viewer_user_id ? emailById[r.viewer_user_id] : null;
        return {
            id: r.id,
            access_path: r.access_path,
            access_path_label: accessPathLabel(r.access_path),
            accessed_at: r.accessed_at,
            viewer_user_id: r.viewer_user_id,
            viewer_email: prof ? (prof.email || null) : null,
            viewer_name: prof ? (prof.full_name || null) : null,
            metadata_json: r.metadata_json || {}
        };
    });
    return { items, total: Number(count) || items.length };
}

module.exports = {
    itemTypeFromTable,
    accessPathLabel,
    logUgcAccess,
    fetchAccessStatsForItems,
    listAccessEventsForItem
};
