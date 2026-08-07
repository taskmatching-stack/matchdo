/**
 * 種子廠商／公開受眾可見性（首頁媒體牆、圖庫、portfolio API 共用）
 * 規格：docs/seed-vendor-admin-and-visibility-plan.md
 */
'use strict';

function manufacturerIsSeedVendor(mfr) {
    return !!(mfr && mfr.vendor_source === 'seed');
}

function manufacturerSeedPublicReleased(mfr) {
    if (!manufacturerIsSeedVendor(mfr)) return true;
    return !!(mfr.seed_public_released_at);
}

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

/** 種子廠商系列／對照：僅 admin/tester 內部預覽可出現在媒體牆 */
function portfolioRowVisibleOnMediaWall(mfr, internalPreview) {
    if (!mfr || mfr.is_active === false) return false;
    if (manufacturerIsSeedVendor(mfr)) return !!internalPreview;
    if (internalPreview) return true;
    return manufacturerVisibleToPublicAudience(mfr);
}

/** 媒體牆範例資料夾（seed-media-wall-sample.sql），非種子廠商上傳但公開會誤導 */
const DEMO_MEDIA_COLLECTION_SLUGS = new Set(['collection-1', 'collection-2']);

function mediaCollectionVisibleOnMediaWall(row, mfr, internalPreview) {
    if (!row || row.is_active === false) return false;
    const slug = String(row.slug || '').trim();
    if (!internalPreview && DEMO_MEDIA_COLLECTION_SLUGS.has(slug)) return false;
    if (!row.manufacturer_id) return true;
    if (!mfr) return false;
    if (manufacturerIsSeedVendor(mfr)) return !!internalPreview;
    if (internalPreview) return mfr.is_active !== false;
    return manufacturerVisibleToPublicAudience(mfr);
}

async function filterMediaCollectionRowsForAudience(supabase, rows, opts) {
    opts = opts || {};
    const internalPreview = !!opts.internalPreview;
    const list = rows || [];
    const mfrIds = list.map(function (r) { return r.manufacturer_id; }).filter(Boolean);
    const mfrMap = await fetchManufacturersForAudienceFilter(supabase, mfrIds, { internalPreview: internalPreview });
    return list.filter(function (row) {
        if (!row) return false;
        const mfr = row.manufacturer_id ? mfrMap[row.manufacturer_id] : null;
        return mediaCollectionVisibleOnMediaWall(row, mfr, internalPreview);
    });
}

/** 種子廠商上傳作品不得設為上媒體牆（DB 欄位一律 false） */
function seedVendorPortfolioShowOnMediaWall(mfr, requestedShow) {
    if (manufacturerIsSeedVendor(mfr)) return false;
    return requestedShow !== false && requestedShow !== 'false' && requestedShow !== 0;
}

const MFR_AUDIENCE_SELECT = 'id, name, user_id, is_active, expires_at, vendor_source, seed_public_released_at';

async function fetchManufacturersForAudienceFilter(supabase, mfrIds, opts) {
    opts = opts || {};
    const internalPreview = !!opts.internalPreview;
    const ids = [...new Set((mfrIds || []).map(function (id) { return String(id).trim(); }).filter(Boolean))];
    const map = {};
    if (!ids.length || !supabase) return map;

    async function loadByIds(idList, activeOnly) {
        if (!idList.length) return [];
        let q = supabase.from('manufacturers').select(MFR_AUDIENCE_SELECT).in('id', idList);
        if (activeOnly) q = q.eq('is_active', true);
        let { data, error } = await q;
        if (error && error.code === '42703') {
            ({ data } = await supabase.from('manufacturers').select('id, user_id, is_active, expires_at, seed_public_released_at').in('id', idList));
            (data || []).forEach(function (m) { m.vendor_source = null; });
            if (activeOnly && data) data = data.filter(function (m) { return m.is_active !== false; });
        }
        return data || [];
    }

    (await loadByIds(ids, !internalPreview)).forEach(function (m) {
        if (m && m.id) map[m.id] = m;
    });

    if (internalPreview) {
        const missing = ids.filter(function (id) { return !map[id]; });
        if (missing.length) {
            (await loadByIds(missing, false)).forEach(function (m) {
                if (m && m.id && !map[m.id]) map[m.id] = m;
            });
        }
    }

    return map;
}

async function filterPortfolioRowsForAudience(supabase, rows, opts) {
    opts = opts || {};
    const internalPreview = !!opts.internalPreview;
    const list = rows || [];
    const mfrIds = list.map(function (p) { return p.manufacturer_id; }).filter(Boolean);
    const mfrMap = await fetchManufacturersForAudienceFilter(supabase, mfrIds, { internalPreview: internalPreview });
    return list.filter(function (p) {
        if (!p) return false;
        if (p.show_on_media_wall === false && !internalPreview) return false;
        const mfr = mfrMap[p.manufacturer_id];
        if (!mfr) return false;
        if (opts.mediaWall) return portfolioRowVisibleOnMediaWall(mfr, internalPreview);
        if (internalPreview) return mfr.is_active !== false;
        return manufacturerVisibleToPublicAudience(mfr);
    });
}

async function filterVendorAssetRowsForAudience(supabase, rows, opts) {
    opts = opts || {};
    const internalPreview = !!opts.internalPreview;
    const list = rows || [];
    const mfrIds = list.map(function (r) { return r.manufacturer_id; }).filter(Boolean);
    const mfrMap = await fetchManufacturersForAudienceFilter(supabase, mfrIds, { internalPreview: internalPreview });
    return list.filter(function (r) {
        if (!r) return false;
        const mfr = mfrMap[r.manufacturer_id];
        if (!mfr) return !!internalPreview;
        if (internalPreview) return true;
        return vendorAssetVisibleToPublicAudience(mfr, r);
    });
}

async function isPortfolioRowVisibleToAudience(supabase, row, opts) {
    if (!row) return false;
    const filtered = await filterPortfolioRowsForAudience(supabase, [row], opts || {});
    return filtered.length > 0;
}

async function isVendorAssetRowVisibleToAudience(supabase, row, opts) {
    if (!row) return false;
    const filtered = await filterVendorAssetRowsForAudience(supabase, [row], opts || {});
    return filtered.length > 0;
}

function portfolioRowHasDisplayableMedia(row, nowIso) {
    if (!row) return false;
    const now = nowIso || new Date().toISOString();
    const seriesExpired = row.series_image_valid_until && row.series_image_valid_until < now;
    if (row.image_url_before) {
        const after = seriesExpired ? null : (row.image_url || null);
        return !!(after || row.image_url_before);
    }
    const imageUrl = seriesExpired ? null : (row.image_url || null);
    const seriesUrls = (Array.isArray(row.series_image_urls) && row.series_image_urls.length)
        ? (seriesExpired ? [] : row.series_image_urls)
        : (imageUrl ? [imageUrl] : []);
    return seriesUrls.length > 0;
}

/** 受眾過濾後向後掃描，以公開作品補滿 limit（維持 created_at 順序） */
async function fetchPortfolioRowsForMediaWallAudience(supabase, opts) {
    opts = opts || {};
    const limit = Math.max(0, parseInt(opts.limit, 10) || 0);
    if (!limit || !supabase || typeof opts.buildRangeQuery !== 'function') return [];
    const startOffset = Math.max(0, parseInt(opts.startOffset, 10) || 0);
    const internalPreview = !!opts.internalPreview;
    const requireDisplayableMedia = opts.requireDisplayableMedia !== false;
    const maxScan = Math.min(Math.max(parseInt(opts.maxScan, 10) || 400, limit * 2), 600);
    const nowIso = new Date().toISOString();
    const visible = [];
    const seenIds = new Set();
    let dbOffset = startOffset;
    let scanned = 0;
    const batchSize = Math.max(limit * 3, 24);

    while (visible.length < limit && scanned < maxScan) {
        const fetchN = Math.min(batchSize, maxScan - scanned);
        const rangeTo = dbOffset + fetchN - 1;
        let batch;
        try {
            batch = await opts.buildRangeQuery(dbOffset, rangeTo);
        } catch (_) {
            break;
        }
        const rows = (batch && batch.data) || [];
        if (batch && batch.error) break;
        if (!rows.length) break;
        scanned += rows.length;
        dbOffset += rows.length;
        const filtered = await filterPortfolioRowsForAudience(supabase, rows, {
            internalPreview: internalPreview,
            mediaWall: opts.mediaWall !== false
        });
        filtered.forEach(function (row) {
            if (visible.length >= limit || !row || !row.id || seenIds.has(row.id)) return;
            if (requireDisplayableMedia && !portfolioRowHasDisplayableMedia(row, nowIso)) return;
            seenIds.add(row.id);
            visible.push(row);
        });
        if (rows.length < fetchN) break;
    }
    return visible;
}

module.exports = {
    manufacturerIsSeedVendor: manufacturerIsSeedVendor,
    manufacturerSeedPublicReleased: manufacturerSeedPublicReleased,
    manufacturerVisibleToPublicAudience: manufacturerVisibleToPublicAudience,
    vendorAssetVisibleToPublicAudience: vendorAssetVisibleToPublicAudience,
    portfolioRowVisibleOnMediaWall: portfolioRowVisibleOnMediaWall,
    mediaCollectionVisibleOnMediaWall: mediaCollectionVisibleOnMediaWall,
    seedVendorPortfolioShowOnMediaWall: seedVendorPortfolioShowOnMediaWall,
    fetchManufacturersForAudienceFilter: fetchManufacturersForAudienceFilter,
    filterPortfolioRowsForAudience: filterPortfolioRowsForAudience,
    filterMediaCollectionRowsForAudience: filterMediaCollectionRowsForAudience,
    filterVendorAssetRowsForAudience: filterVendorAssetRowsForAudience,
    isPortfolioRowVisibleToAudience: isPortfolioRowVisibleToAudience,
    isVendorAssetRowVisibleToAudience: isVendorAssetRowVisibleToAudience,
    portfolioRowHasDisplayableMedia: portfolioRowHasDisplayableMedia,
    fetchPortfolioRowsForMediaWallAudience: fetchPortfolioRowsForMediaWallAudience
};
