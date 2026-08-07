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

module.exports = {
    manufacturerIsSeedVendor: manufacturerIsSeedVendor,
    manufacturerSeedPublicReleased: manufacturerSeedPublicReleased,
    manufacturerVisibleToPublicAudience: manufacturerVisibleToPublicAudience,
    vendorAssetVisibleToPublicAudience: vendorAssetVisibleToPublicAudience,
    fetchManufacturersForAudienceFilter: fetchManufacturersForAudienceFilter,
    filterPortfolioRowsForAudience: filterPortfolioRowsForAudience,
    filterVendorAssetRowsForAudience: filterVendorAssetRowsForAudience,
    isPortfolioRowVisibleToAudience: isPortfolioRowVisibleToAudience,
    isVendorAssetRowVisibleToAudience: isVendorAssetRowVisibleToAudience
};
