'use strict';

const objectStorage = require('./object-storage');
const ugcAccessLog = require('./ugc-access-log');

const RETENTION_COLUMN_NAMES = [
    'generation_completed_at',
    'last_accessed_at',
    'free_retention_started_at',
    'retention_tier',
    'storage_tier',
    'soft_deleted_at',
    'wall_category_key',
    'wall_rotated_off_at',
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

function wallSubcategorySparseMax() {
    return envInt('UGC_WALL_SUBCATEGORY_SPARSE_MAX', 48);
}

function wallRotationDays() {
    return envInt('UGC_WALL_ROTATION_DAYS', coldlineDays());
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

function wallCategoryBucket(key) {
    const k = String(key || '').trim();
    return k || '__none__';
}

function describeRetentionForUser(row) {
    if (!row) return null;
    if (row.soft_deleted_at) {
        return {
            level: 'pending_removal',
            label: '將從帳號移除',
            hint: '圖片已標記移除；重新訂閱可恢復長期保存'
        };
    }
    const tier = row.retention_tier || 'free';
    if (isRetentionExemptTier(tier)) {
        return { level: 'long_term', label: '長期保存', hint: '' };
    }
    if (row.storage_tier === 'coldline') {
        return {
            level: 'idle',
            label: '較久未開啟',
            hint: '開啟圖片後會恢復正常保存；免費方案至少 90 天儲存保證'
        };
    }
    return {
        level: 'standard',
        label: '正常保存',
        hint: '免費方案至少 90 天儲存保證'
    };
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

async function hasMediaWallFavorite(supabase, itemId, itemType) {
    const id = String(itemId || '').trim();
    if (!supabase || !id) return false;
    const candidates = [id];
    const t = String(itemType || '').trim();
    if (t) candidates.push(t + ':' + id);
    for (let i = 0; i < candidates.length; i++) {
        const { count, error } = await supabase
            .from('media_wall_favorites')
            .select('id', { count: 'exact', head: true })
            .eq('item_id', candidates[i]);
        if (!error && (Number(count) || 0) > 0) return true;
    }
    return false;
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

async function markTableRowAccessed(supabase, table, id, opts) {
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
    const itemType = ugcAccessLog.itemTypeFromTable(table);
    if (itemType) {
        ugcAccessLog.logUgcAccess(supabase, {
            itemType: itemType,
            itemId: tid,
            accessPath: (opts && opts.accessPath) || 'unknown',
            viewerUserId: (opts && opts.viewerUserId) || null,
            metadata: (opts && opts.metadata) || {}
        }).catch(function () {});
    }
    return { ok: !error, restored: updates.storage_tier === 'standard' };
}

async function markMediaWallItemAccessed(supabase, type, id, opts) {
    const t = String(type || '').trim();
    const tid = String(id || '').trim();
    if (t === 'user_design') return markTableRowAccessed(supabase, 'custom_products', tid, opts);
    if (t === 'promo_scene') return markTableRowAccessed(supabase, 'product_promo_generations', tid, opts);
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
        .select('id, show_on_homepage, content_kind, wall_rotated_off_at')
        .eq('owner_id', userId)
        .is('soft_deleted_at', null);
    for (let i = 0; i < (designs || []).length; i++) {
        const row = designs[i];
        if (row.show_on_homepage === true) continue;
        if (row.wall_rotated_off_at) continue;
        const patch = { show_on_homepage: true, wall_rotated_off_at: null };
        const { error } = await supabase.from('custom_products').update(patch).eq('id', row.id);
        if (!error) updated += 1;
    }
    const { data: promos } = await supabase
        .from('product_promo_generations')
        .select('id, show_on_homepage, content_kind, wall_rotated_off_at')
        .eq('user_id', userId)
        .is('soft_deleted_at', null);
    for (let j = 0; j < (promos || []).length; j++) {
        const row = promos[j];
        if (isPortraitContentKind(row.content_kind)) continue;
        if (row.show_on_homepage === true) continue;
        if (row.wall_rotated_off_at) continue;
        const patch = { show_on_homepage: true, wall_rotated_off_at: null };
        const { error } = await supabase.from('product_promo_generations').update(patch).eq('id', row.id);
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
        const favType = spec.table === 'custom_products' ? 'user_design' : 'promo_scene';
        const favorited = await hasMediaWallFavorite(supabase, row.id, favType);

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

async function fetchWallRotationPool(supabase) {
    const items = [];
    for (let s = 0; s < UGC_SPECS.length; s++) {
        const spec = UGC_SPECS[s];
        const { data, error } = await supabase
            .from(spec.table)
            .select('id, wall_category_key, retention_tier, content_kind, show_on_homepage, soft_deleted_at, wall_rotated_off_at, last_accessed_at, free_retention_started_at, generation_completed_at, created_at')
            .eq('show_on_homepage', true)
            .is('soft_deleted_at', null)
            .eq('retention_tier', 'free')
            .limit(2000);
        if (error) {
            if (error.code === '42703') continue;
            throw error;
        }
        for (let i = 0; i < (data || []).length; i++) {
            const row = data[i];
            if (isPortraitContentKind(row.content_kind)) continue;
            items.push({
                table: spec.table,
                id: row.id,
                wall_category_key: wallCategoryBucket(row.wall_category_key),
                row: row,
                favType: spec.table === 'custom_products' ? 'user_design' : 'promo_scene'
            });
        }
    }
    return items;
}

async function enforceSparseCategoryWallRotation(supabase) {
    const stats = { rotated: 0, crowded_categories: 0, errors: [] };
    const sparseMax = wallSubcategorySparseMax();
    const rotationMs = msDays(wallRotationDays());
    const now = new Date();
    let items = [];
    try {
        items = await fetchWallRotationPool(supabase);
    } catch (e) {
        stats.errors.push('wall_rotation: ' + (e && e.message ? e.message : String(e)));
        return stats;
    }
    const counts = {};
    items.forEach(function (item) {
        counts[item.wall_category_key] = (counts[item.wall_category_key] || 0) + 1;
    });
    const crowded = Object.keys(counts).filter(function (k) { return counts[k] >= sparseMax; });
    stats.crowded_categories = crowded.length;
    if (!crowded.length) return stats;
    const crowdedSet = new Set(crowded);
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!crowdedSet.has(item.wall_category_key)) continue;
        const anchor = effectiveRetentionAnchor(item.row);
        if (!anchor) continue;
        if (now.getTime() - anchor.getTime() < rotationMs) continue;
        const favorited = await hasMediaWallFavorite(supabase, item.id, item.favType);
        if (favorited) continue;
        const patch = { show_on_homepage: false, wall_rotated_off_at: nowIso(), updated_at: nowIso() };
        const { error } = await supabase.from(item.table).update(patch).eq('id', item.id);
        if (error) {
            if (error.code === '42703') {
                const fb = await supabase.from(item.table).update({ show_on_homepage: false, updated_at: nowIso() }).eq('id', item.id);
                if (!fb.error) stats.rotated += 1;
                else stats.errors.push(item.table + ':' + item.id + ':' + fb.error.message);
            } else {
                stats.errors.push(item.table + ':' + item.id + ':' + error.message);
            }
        } else {
            stats.rotated += 1;
        }
    }
    return stats;
}

async function countTableRows(supabase, table, applyFilter) {
    let q = supabase.from(table).select('id', { count: 'exact', head: true });
    if (applyFilter) q = applyFilter(q);
    const { count, error } = await q;
    if (error) {
        if (error.code === '42703') return { count: null, missing: true };
        throw error;
    }
    return { count: Number(count) || 0, missing: false };
}

async function fetchAdminRetentionStats(supabase) {
    const out = {
        tables_ready: true,
        totals: {
            coldline: 0,
            standard_free: 0,
            soft_pending: 0,
            paid: 0,
            staff: 0,
            on_wall_free: 0
        },
        by_table: {}
    };
    const coldMs = msDays(coldlineDays());
    const deleteMs = msDays(deleteAfterColdlineDays());
    const softGraceMs = msDays(softDeleteGraceDays());
    const soonMs = msDays(30);
    const now = Date.now();
    out.totals.expiring_to_coldline_30d = 0;
    out.totals.expiring_soft_delete_15d = 0;

    for (let s = 0; s < UGC_SPECS.length; s++) {
        const spec = UGC_SPECS[s];
        const tbl = { coldline: 0, standard_free: 0, soft_pending: 0, paid: 0, staff: 0, on_wall_free: 0, expiring_to_coldline_30d: 0, expiring_soft_delete_15d: 0, missing_columns: false };
        try {
            const cold = await countTableRows(supabase, spec.table, function (q) {
                return q.eq('storage_tier', 'coldline').is('soft_deleted_at', null);
            });
            const stdFree = await countTableRows(supabase, spec.table, function (q) {
                return q.eq('retention_tier', 'free').eq('storage_tier', 'standard').is('soft_deleted_at', null);
            });
            const soft = await countTableRows(supabase, spec.table, function (q) {
                return q.not('soft_deleted_at', 'is', null);
            });
            const paid = await countTableRows(supabase, spec.table, function (q) {
                return q.eq('retention_tier', 'paid').is('soft_deleted_at', null);
            });
            const staff = await countTableRows(supabase, spec.table, function (q) {
                return q.eq('retention_tier', 'staff').is('soft_deleted_at', null);
            });
            const onWall = await countTableRows(supabase, spec.table, function (q) {
                return q.eq('retention_tier', 'free').eq('show_on_homepage', true).is('soft_deleted_at', null);
            });
            if (cold.missing || stdFree.missing) {
                tbl.missing_columns = true;
                out.tables_ready = false;
            } else {
                tbl.coldline = cold.count;
                tbl.standard_free = stdFree.count;
                tbl.soft_pending = soft.count;
                tbl.paid = paid.count;
                tbl.staff = staff.count;
                tbl.on_wall_free = onWall.count;
                out.totals.coldline += cold.count;
                out.totals.standard_free += stdFree.count;
                out.totals.soft_pending += soft.count;
                out.totals.paid += paid.count;
                out.totals.staff += staff.count;
                out.totals.on_wall_free += onWall.count;
            }

            const { data: scanRows, error: scanErr } = await supabase
                .from(spec.table)
                .select('id, retention_tier, storage_tier, soft_deleted_at, last_accessed_at, free_retention_started_at, generation_completed_at, created_at')
                .in('retention_tier', ['free'])
                .limit(1000);
            if (!scanErr && scanRows) {
                for (let i = 0; i < scanRows.length; i++) {
                    const row = scanRows[i];
                    if (row.soft_deleted_at) {
                        const softAt = new Date(row.soft_deleted_at).getTime();
                        const hardAt = softAt + softGraceMs;
                        if (hardAt > now && hardAt - now <= msDays(15)) {
                            tbl.expiring_soft_delete_15d += 1;
                            out.totals.expiring_soft_delete_15d += 1;
                        }
                        continue;
                    }
                    const anchor = effectiveRetentionAnchor(row);
                    if (!anchor) continue;
                    if (row.storage_tier !== 'coldline') {
                        const coldAt = anchor.getTime() + coldMs;
                        const remain = coldAt - now;
                        if (remain > 0 && remain <= soonMs) {
                            tbl.expiring_to_coldline_30d += 1;
                            out.totals.expiring_to_coldline_30d += 1;
                        }
                    } else {
                        const deleteAt = anchor.getTime() + coldMs + deleteMs;
                        const delRemain = deleteAt - now;
                        if (delRemain > 0 && delRemain <= msDays(15)) {
                            tbl.expiring_soft_delete_15d += 1;
                            out.totals.expiring_soft_delete_15d += 1;
                        }
                    }
                }
            }
        } catch (e) {
            out.tables_ready = false;
            tbl.error = e && e.message ? e.message : String(e);
        }
        out.by_table[spec.table] = tbl;
    }
    out.config = {
        coldline_days: coldlineDays(),
        delete_after_coldline_days: deleteAfterColdlineDays(),
        soft_delete_grace_days: softDeleteGraceDays(),
        wall_sparse_max: wallSubcategorySparseMax(),
        wall_rotation_days: wallRotationDays()
    };
    return out;
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
    const rotRes = await enforceSparseCategoryWallRotation(supabase);
    stats.wallRotated = rotRes.rotated;
    stats.wallCrowdedCategories = rotRes.crowded_categories;
    if (rotRes.errors && rotRes.errors.length) {
        stats.errors = stats.errors.concat(rotRes.errors);
    }
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
    enforceSparseCategoryWallRotation,
    fetchAdminRetentionStats,
    describeRetentionForUser,
    rowIsSoftDeleted,
    coldlineDays,
    wallGraceDays,
    wallSubcategorySparseMax,
    wallRotationDays
};
