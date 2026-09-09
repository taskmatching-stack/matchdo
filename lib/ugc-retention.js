'use strict';

const objectStorage = require('./object-storage');

const RETENTION_COLUMN_NAMES = [
    'generation_completed_at',
    'last_accessed_at',
    'free_retention_started_at',
    'retention_tier',
    'storage_tier',
    'soft_deleted_at',
    'wall_category_key',
    'content_kind'
];

const UGC_SPECS = [
    {
        table: 'custom_products',
        ownerCol: 'owner_id',
        imageCols: ['ai_generated_image_url', 'reference_image_url'],
        portraitKinds: []
    },
    {
        table: 'product_promo_generations',
        ownerCol: 'user_id',
        imageCols: ['result_image_url', 'source_image_url'],
        portraitKinds: ['promo_portrait']
    }
];

function envInt(name, fallback) {
    const n = parseInt(process.env[name], 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function coldlineDays() {
    return envInt('UGC_RETENTION_COLDLINE_DAYS', 90);
}

function deleteAfterColdlineDays() {
    return envInt('UGC_RETENTION_DELETE_AFTER_COLDLINE_DAYS', 90);
}

function softDeleteGraceDays() {
    return envInt('UGC_RETENTION_SOFT_DELETE_GRACE_DAYS', 15);
}

function wallGraceDays() {
    return envInt('UGC_WALL_GRACE_DAYS', 15);
}

function msDays(d) {
    return d * 24 * 60 * 60 * 1000;
}

function nowIso() {
    return new Date().toISOString();
}

function addDaysIso(fromDate, days) {
    return new Date(fromDate.getTime() + msDays(days)).toISOString();
}

function stripRetentionColumns(payload) {
    const p = Object.assign({}, payload);
    RETENTION_COLUMN_NAMES.forEach(function (k) { delete p[k]; });
    return p;
}

function buildRetentionFields(opts) {
    const isStaff = !!(opts && opts.isStaff);
    const isPaid = !!(opts && opts.isPaid);
    const tier = isStaff ? 'staff' : (isPaid ? 'paid' : 'free');
    const now = nowIso();
    const out = {
        generation_completed_at: now,
        last_accessed_at: now,
        storage_tier: 'standard',
        retention_tier: tier,
        soft_deleted_at: null,
        content_kind: (opts && opts.contentKind) || 'design',
        wall_category_key: (opts && opts.wallCategoryKey) ? String(opts.wallCategoryKey) : null,
        free_retention_started_at: tier === 'free' ? now : null
    };
    return out;
}

function promoContentKindFromBody(body) {
    const mode = String(
        (body && (body.shoot_mode || body.shootMode || body.generation_mode || body.generationMode)) || ''
    ).trim().toLowerCase();
    if (mode === 'portrait') return 'promo_portrait';
    if (mode === 'space') return 'promo_space';
    return 'promo_product';
}

function effectiveRetentionAnchor(row) {
    if (!row) return null;
    const candidates = [
        row.last_accessed_at,
        row.free_retention_started_at,
        row.generation_completed_at,
        row.created_at
    ].filter(Boolean).map(function (t) { return new Date(t).getTime(); }).filter(function (n) { return Number.isFinite(n); });
    if (!candidates.length) return null;
    return new Date(Math.max.apply(null, candidates));
}

function isRetentionExemptTier(tier) {
    return tier === 'paid' || tier === 'staff';
}

async function readProfileRetentionRow(supabase, userId) {
    if (!supabase || !userId) return null;
    const { data, error } = await supabase
        .from('profiles')
        .select('wall_grace_until, ugc_free_retention_started_at, last_downgrade_kind')
        .eq('id', userId)
        .maybeSingle();
    if (error && error.code === '42703') return null;
    return data || null;
}

async function readWallGraceUntil(supabase, userId) {
    const row = await readProfileRetentionRow(supabase, userId);
    return row && row.wall_grace_until ? row.wall_grace_until : null;
}

async function isWallGraceActive(supabase, userId) {
    const until = await readWallGraceUntil(supabase, userId);
    if (!until) return false;
    return new Date(until) > new Date();
}

async function resolveDowngradeKind(supabase, userId) {
    if (!supabase || !userId) return 'involuntary';
    const { data, error } = await supabase
        .from('user_subscriptions')
        .select('cancellation_reason, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error && error.code === '42703') return 'involuntary';
    if (data && String(data.cancellation_reason || '') === 'user_voluntary') return 'voluntary';
    return 'involuntary';
}

async function hasMediaWallFavorite(supabase, itemId) {
    const id = String(itemId || '').trim();
    if (!supabase || !id) return false;
    const { count, error } = await supabase
        .from('media_wall_favorites')
        .select('id', { count: 'exact', head: true })
        .eq('item_id', id);
    if (error) return false;
    return (Number(count) || 0) > 0;
}

function collectImageUrlsFromRow(row, imageCols) {
    const urls = [];
    (imageCols || []).forEach(function (col) {
        const v = row && row[col];
        if (v && String(v).trim()) urls.push(String(v).trim());
    });
    return urls;
}

async function setRowStorageTier(supabase, spec, id, storageTier) {
    const { error } = await supabase.from(spec.table).update({
        storage_tier: storageTier,
        updated_at: nowIso()
    }).eq('id', id);
    return !error;
}

async function restoreRowImagesToStandard(row, spec) {
    const urls = collectImageUrlsFromRow(row, spec.imageCols);
    let restored = 0;
    for (let i = 0; i < urls.length; i++) {
        const key = objectStorage.parseMediaUrlToObjectKey(urls[i]);
        if (!key) continue;
        const res = await objectStorage.setGcsStorageClass(key, 'STANDARD');
        if (res.ok) restored += 1;
    }
    return restored;
}

async function coldlineRowImages(row, spec) {
    const urls = collectImageUrlsFromRow(row, spec.imageCols);
    let moved = 0;
    for (let i = 0; i < urls.length; i++) {
        const key = objectStorage.parseMediaUrlToObjectKey(urls[i]);
        if (!key) continue;
        const res = await objectStorage.setGcsStorageClass(key, 'COLDLINE');
        if (res.ok) moved += 1;
    }
    return moved;
}

async function deleteRowImages(row, spec) {
    const urls = collectImageUrlsFromRow(row, spec.imageCols);
    let deleted = 0;
    for (let i = 0; i < urls.length; i++) {
        const key = objectStorage.parseMediaUrlToObjectKey(urls[i]);
        if (!key) continue;
        const res = await objectStorage.deleteGcsObject(key);
        if (res.ok) deleted += 1;
    }
    return deleted;
}

async function markTableRowAccessed(supabase, table, id) {
    const tid = String(id || '').trim();
    if (!supabase || !tid) return { ok: false };
    const spec = UGC_SPECS.find(function (s) { return s.table === table; });
    if (!spec) return { ok: false };
    const { data: row, error: selErr } = await supabase
        .from(table)
        .select('id, retention_tier, storage_tier, soft_deleted_at, ' + spec.imageCols.join(', '))
        .eq('id', tid)
        .maybeSingle();
    if (selErr || !row || row.soft_deleted_at) return { ok: false, error: selErr && selErr.message };
    const now = nowIso();
    const updates = { last_accessed_at: now };
    if (row.storage_tier === 'coldline' && !isRetentionExemptTier(row.retention_tier)) {
        await restoreRowImagesToStandard(row, spec);
        updates.storage_tier = 'standard';
    }
    const { error } = await supabase.from(table).update(updates).eq('id', tid);
    return { ok: !error, restored: updates.storage_tier === 'standard' };
}

async function markMediaWallItemAccessed(supabase, type, id) {
    const t = String(type || '').trim();
    const tid = String(id || '').trim();
    if (t === 'user_design') return markTableRowAccessed(supabase, 'custom_products', tid);
    if (t === 'promo_scene') return markTableRowAccessed(supabase, 'product_promo_generations', tid);
    return { ok: false, skipped: true };
}

function isPortraitContentKind(kind) {
    return String(kind || '') === 'promo_portrait';
}

async function enforceFreeWallForUser(supabase, userId) {
    if (!supabase || !userId) return { updated: 0 };
    let updated = 0;
    const { data: designs } = await supabase
        .from('custom_products')
        .select('id, show_on_homepage, content_kind')
        .eq('owner_id', userId)
        .is('soft_deleted_at', null);
    for (let i = 0; i < (designs || []).length; i++) {
        const row = designs[i];
        if (row.show_on_homepage === true) continue;
        const { error } = await supabase.from('custom_products').update({ show_on_homepage: true }).eq('id', row.id);
        if (!error) updated += 1;
    }
    const { data: promos } = await supabase
        .from('product_promo_generations')
        .select('id, show_on_homepage, content_kind')
        .eq('user_id', userId)
        .is('soft_deleted_at', null);
    for (let j = 0; j < (promos || []).length; j++) {
        const row = promos[j];
        if (isPortraitContentKind(row.content_kind)) continue;
        if (row.show_on_homepage === true) continue;
        const { error } = await supabase.from('product_promo_generations').update({ show_on_homepage: true }).eq('id', row.id);
        if (!error) updated += 1;
    }
    return { updated };
}

async function enforceWallGraceExpired(supabase, userId) {
    if (!supabase) return { users: 0, updated: 0 };
    const now = new Date();
    let profiles = [];
    if (userId) {
        const row = await readProfileRetentionRow(supabase, userId);
        if (row && row.wall_grace_until && new Date(row.wall_grace_until) <= now) {
            profiles.push({ id: userId });
        }
    } else {
        const { data } = await supabase
            .from('profiles')
            .select('id, wall_grace_until')
            .not('wall_grace_until', 'is', null)
            .lte('wall_grace_until', now.toISOString())
            .limit(500);
        profiles = data || [];
    }
    let totalUpdated = 0;
    for (let i = 0; i < profiles.length; i++) {
        const res = await enforceFreeWallForUser(supabase, profiles[i].id);
        totalUpdated += res.updated || 0;
        await supabase.from('profiles').update({ wall_grace_until: null }).eq('id', profiles[i].id);
    }
    return { users: profiles.length, updated: totalUpdated };
}

async function applyDowngradeToFree(supabase, userId, opts) {
    if (!supabase || !userId) return;
    const kind = (opts && opts.kind) || 'involuntary';
    const now = new Date();
    const profilePatch = {
        ugc_free_retention_started_at: now.toISOString(),
        last_downgrade_kind: kind
    };
    if (kind === 'involuntary') {
        profilePatch.wall_grace_until = addDaysIso(now, wallGraceDays());
    } else {
        profilePatch.wall_grace_until = null;
    }
    await supabase.from('profiles').update(profilePatch).eq('id', userId);

    const freeStarted = now.toISOString();
    for (let s = 0; s < UGC_SPECS.length; s++) {
        const spec = UGC_SPECS[s];
        await supabase
            .from(spec.table)
            .update({
                retention_tier: 'free',
                free_retention_started_at: freeStarted
            })
            .eq(spec.ownerCol, userId)
            .in('retention_tier', ['paid', 'staff']);
    }

    if (kind === 'voluntary') {
        await enforceFreeWallForUser(supabase, userId);
    }
}

async function applyUpgradeToPaid(supabase, userId) {
    if (!supabase || !userId) return;
    await supabase.from('profiles').update({
        wall_grace_until: null,
        last_downgrade_kind: null
    }).eq('id', userId);

    for (let s = 0; s < UGC_SPECS.length; s++) {
        const spec = UGC_SPECS[s];
        const { data: rows } = await supabase
            .from(spec.table)
            .select('id, storage_tier, ' + spec.imageCols.join(', '))
            .eq(spec.ownerCol, userId)
            .eq('retention_tier', 'free');
        await supabase.from(spec.table).update({
            retention_tier: 'paid',
            free_retention_started_at: null,
            soft_deleted_at: null
        }).eq(spec.ownerCol, userId).eq('retention_tier', 'free');
        for (let i = 0; i < (rows || []).length; i++) {
            const row = rows[i];
            if (row.storage_tier === 'coldline') {
                await restoreRowImagesToStandard(row, spec);
                await setRowStorageTier(supabase, spec, row.id, 'standard');
            }
        }
    }
}

async function sweepTable(supabase, spec, stats, now) {
    const coldMs = msDays(coldlineDays());
    const deleteMs = msDays(deleteAfterColdlineDays());
    const softGraceMs = msDays(softDeleteGraceDays());

    const { data: rows, error } = await supabase
        .from(spec.table)
        .select('id, retention_tier, storage_tier, soft_deleted_at, content_kind, last_accessed_at, free_retention_started_at, generation_completed_at, created_at, ' + spec.imageCols.join(', '))
        .eq('retention_tier', 'free')
        .limit(500);
    if (error) {
        if (error.code === '42703') return;
        stats.errors.push(spec.table + ': ' + error.message);
        return;
    }

    for (let i = 0; i < (rows || []).length; i++) {
        const row = rows[i];
        const anchor = effectiveRetentionAnchor(row);
        if (!anchor) continue;
        const idleMs = now.getTime() - anchor.getTime();
        const favorited = await hasMediaWallFavorite(supabase, row.id);

        if (!row.soft_deleted_at) {
            if (favorited) continue;

            if (row.storage_tier !== 'coldline' && idleMs >= coldMs) {
                await coldlineRowImages(row, spec);
                await setRowStorageTier(supabase, spec, row.id, 'coldline');
                stats.coldlined += 1;
                continue;
            }

            if (row.storage_tier === 'coldline' && idleMs >= coldMs + deleteMs) {
                const softPatch = { soft_deleted_at: now.toISOString(), show_on_homepage: false };
                await supabase.from(spec.table).update(softPatch).eq('id', row.id);
                stats.softDeleted += 1;
            }
            continue;
        }

        const softAt = new Date(row.soft_deleted_at);
        if (now.getTime() - softAt.getTime() >= softGraceMs) {
            if (favorited) continue;
            await deleteRowImages(row, spec);
            const nullPatch = { soft_deleted_at: now.toISOString() };
            spec.imageCols.forEach(function (col) { nullPatch[col] = null; });
            await supabase.from(spec.table).update(nullPatch).eq('id', row.id);
            stats.hardDeleted += 1;
        }
    }
}

async function runRetentionSweep(supabase) {
    const stats = { coldlined: 0, softDeleted: 0, hardDeleted: 0, errors: [] };
    const now = new Date();
    for (let s = 0; s < UGC_SPECS.length; s++) {
        await sweepTable(supabase, UGC_SPECS[s], stats, now);
    }
    const wallRes = await enforceWallGraceExpired(supabase);
    stats.wallGraceUsers = wallRes.users;
    stats.wallForced = wallRes.updated;
    return stats;
}

function rowIsSoftDeleted(row) {
    return !!(row && row.soft_deleted_at);
}

module.exports = {
    RETENTION_COLUMN_NAMES,
    stripRetentionColumns,
    buildRetentionFields,
    promoContentKindFromBody,
    readWallGraceUntil,
    isWallGraceActive,
    resolveDowngradeKind,
    applyDowngradeToFree,
    applyUpgradeToPaid,
    markTableRowAccessed,
    markMediaWallItemAccessed,
    enforceWallGraceExpired,
    enforceFreeWallForUser,
    runRetentionSweep,
    rowIsSoftDeleted,
    coldlineDays,
    wallGraceDays
};
