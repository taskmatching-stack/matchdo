'use strict';

function emptyCounts() {
    return {
        prototype_records: 0,
        prototype_images: 0,
        material_records: 0,
        material_images: 0,
        official_prototype_records: 0,
        vendor_prototype_records: 0,
        official_prototype_images: 0,
        vendor_prototype_images: 0,
        official_material_records: 0,
        vendor_material_records: 0,
        official_material_images: 0,
        vendor_material_images: 0
    };
}

function addCounts(target, delta) {
    target.prototype_records += delta.prototype_records || 0;
    target.prototype_images += delta.prototype_images || 0;
    target.material_records += delta.material_records || 0;
    target.material_images += delta.material_images || 0;
    target.official_prototype_records += delta.official_prototype_records || 0;
    target.vendor_prototype_records += delta.vendor_prototype_records || 0;
    target.official_prototype_images += delta.official_prototype_images || 0;
    target.vendor_prototype_images += delta.vendor_prototype_images || 0;
    target.official_material_records += delta.official_material_records || 0;
    target.vendor_material_records += delta.vendor_material_records || 0;
    target.official_material_images += delta.official_material_images || 0;
    target.vendor_material_images += delta.vendor_material_images || 0;
}

function galleryUrlCount(raw) {
    if (raw == null || raw === '') return 0;
    let arr = raw;
    if (typeof raw === 'string') {
        try { arr = JSON.parse(raw); } catch (_) { return 0; }
    }
    if (!Array.isArray(arr)) return 0;
    let n = 0;
    arr.forEach(function (entry) {
        let url = '';
        if (typeof entry === 'string') url = entry.trim();
        else if (entry && typeof entry === 'object') url = String(entry.url || '').trim();
        if (url) n += 1;
    });
    return n;
}

function effectiveAssetKind(row) {
    if (!row) return 'prototype';
    const k = String(row.asset_kind || '').trim().toLowerCase();
    if (k === 'material' || k === 'part' || k === 'prototype') return k;
    if (row.part_key) return 'part';
    return 'prototype';
}

function countAssetImages(row) {
    let n = 0;
    if (row && row.image_url && String(row.image_url).trim()) n += 1;
    n += galleryUrlCount(row && row.gallery_images);
    return n;
}

function assetDelta(row, isOfficial) {
    const kind = effectiveAssetKind(row);
    const images = countAssetImages(row);
    const delta = emptyCounts();
    if (kind === 'material') {
        delta.material_records = 1;
        delta.material_images = images;
        if (isOfficial) {
            delta.official_material_records = 1;
            delta.official_material_images = images;
        } else {
            delta.vendor_material_records = 1;
            delta.vendor_material_images = images;
        }
    } else if (kind === 'prototype') {
        delta.prototype_records = 1;
        delta.prototype_images = images;
        if (isOfficial) {
            delta.official_prototype_records = 1;
            delta.official_prototype_images = images;
        } else {
            delta.vendor_prototype_records = 1;
            delta.vendor_prototype_images = images;
        }
    }
    return delta;
}

function subKey(raw) {
    const s = String(raw || '').trim();
    return s || '(未指定子分類)';
}

function ensureSubBucket(map, subcategoryKey, subNameByKey, subActiveByKey) {
    const k = subKey(subcategoryKey);
    if (!map[k]) {
        map[k] = Object.assign({
            subcategory_key: k === '(未指定子分類)' ? null : k,
            subcategory_name: k,
            is_active: (subActiveByKey && subcategoryKey && subActiveByKey[subcategoryKey] !== undefined)
                ? subActiveByKey[subcategoryKey]
                : true
        }, emptyCounts());
    }
    if (subNameByKey && subcategoryKey && subNameByKey[subcategoryKey]) {
        map[k].subcategory_name = subNameByKey[subcategoryKey];
    }
    if (subActiveByKey && subcategoryKey && subActiveByKey[subcategoryKey] !== undefined) {
        map[k].is_active = subActiveByKey[subcategoryKey];
    }
    return map[k];
}

function pickCountFields(totals) {
    return {
        prototype_records: totals.prototype_records,
        prototype_images: totals.prototype_images,
        material_records: totals.material_records,
        material_images: totals.material_images,
        official_prototype_records: totals.official_prototype_records,
        vendor_prototype_records: totals.vendor_prototype_records,
        official_prototype_images: totals.official_prototype_images,
        vendor_prototype_images: totals.vendor_prototype_images,
        official_material_records: totals.official_material_records,
        vendor_material_records: totals.vendor_material_records,
        official_material_images: totals.official_material_images,
        vendor_material_images: totals.vendor_material_images
    };
}

function sortSubcategoryRows(subs, subSortOrder) {
    return (subs || []).slice().sort(function (a, b2) {
        const ka = a.subcategory_key || '';
        const kb = b2.subcategory_key || '';
        const oa = (subSortOrder && subSortOrder[ka] != null) ? subSortOrder[ka] : 9999;
        const ob = (subSortOrder && subSortOrder[kb] != null) ? subSortOrder[kb] : 9999;
        if (oa !== ob) return oa - ob;
        return String(a.subcategory_name || '').localeCompare(String(b2.subcategory_name || ''));
    });
}

/**
 * @param {Array} assets vendor_assets rows (need manufacturer_id for official/vendor split)
 * @param {Array} categories custom_product_categories with subcategories[]
 */
function aggregateVendorAssetCategoryStats(assets, categories, opts) {
    const options = opts || {};
    const includeInactive = options.include_inactive !== false;
    const officialManufacturerId = options.official_manufacturer_id || null;
    const catList = Array.isArray(categories) ? categories : [];
    const catByKey = {};
    catList.forEach(function (c) {
        if (!c || !c.key) return;
        if (!includeInactive && c.is_active === false) return;
        const subNameByKey = {};
        const subActiveByKey = {};
        const subSortOrder = {};
        const subcategories = {};
        (c.subcategories || []).forEach(function (s) {
            if (!s || !s.key) return;
            if (!includeInactive && s.is_active === false) return;
            subNameByKey[s.key] = s.name || s.key;
            subActiveByKey[s.key] = s.is_active !== false;
            subSortOrder[s.key] = s.sort_order != null ? s.sort_order : 0;
            ensureSubBucket(subcategories, s.key, subNameByKey, subActiveByKey);
        });
        catByKey[c.key] = {
            category_key: c.key,
            category_name: c.name || c.key,
            is_active: c.is_active !== false,
            sort_order: c.sort_order != null ? c.sort_order : 0,
            subNameByKey: subNameByKey,
            subActiveByKey: subActiveByKey,
            subSortOrder: subSortOrder,
            subcategories: subcategories,
            totals: emptyCounts()
        };
    });

    const orphanByKey = {};
    const orphanTotals = emptyCounts();
    const unknownCategoryKeys = {};

    (assets || []).forEach(function (row) {
        if (!row) return;
        const ck = String(row.category_key || '').trim() || '(無分類)';
        const isOfficial = !!(officialManufacturerId && String(row.manufacturer_id || '') === String(officialManufacturerId));
        const delta = assetDelta(row, isOfficial);
        const bucket = catByKey[ck];
        if (bucket) {
            addCounts(bucket.totals, delta);
            const sub = ensureSubBucket(bucket.subcategories, row.subcategory_key, bucket.subNameByKey, bucket.subActiveByKey);
            if (row.subcategory_key && bucket.subNameByKey[row.subcategory_key]) {
                sub.subcategory_name = bucket.subNameByKey[row.subcategory_key];
            }
            addCounts(sub, delta);
            return;
        }
        addCounts(orphanTotals, delta);
        if (!orphanByKey[ck]) {
            orphanByKey[ck] = {
                category_key: ck,
                category_name: ck,
                subcategories: {},
                totals: emptyCounts()
            };
        }
        addCounts(orphanByKey[ck].totals, delta);
        const sub = ensureSubBucket(orphanByKey[ck].subcategories, row.subcategory_key, null, null);
        addCounts(sub, delta);
        unknownCategoryKeys[ck] = (unknownCategoryKeys[ck] || 0) + 1;
    });

    const summary = emptyCounts();
    const resultCategories = catList
        .filter(function (c) {
            if (!c || !c.key) return false;
            if (!includeInactive && c.is_active === false) return false;
            return !!catByKey[c.key];
        })
        .sort(function (a, b) {
            const sa = a.sort_order != null ? a.sort_order : 0;
            const sb = b.sort_order != null ? b.sort_order : 0;
            if (sa !== sb) return sa - sb;
            return String(a.key).localeCompare(String(b.key));
        })
        .map(function (c) {
            const b = catByKey[c.key];
            addCounts(summary, b.totals);
            const subs = sortSubcategoryRows(
                Object.keys(b.subcategories).map(function (sk) {
                    return b.subcategories[sk];
                }),
                b.subSortOrder
            ).map(function (sub) {
                return Object.assign({
                    subcategory_key: sub.subcategory_key,
                    subcategory_name: sub.subcategory_name,
                    is_active: sub.is_active !== false
                }, pickCountFields(sub));
            });
            return Object.assign({
                category_key: b.category_key,
                category_name: b.category_name,
                is_active: b.is_active
            }, pickCountFields(b.totals), { subcategories: subs });
        });

    addCounts(summary, orphanTotals);

    const orphanCategories = Object.keys(orphanByKey).sort().map(function (ck) {
        const b = orphanByKey[ck];
        return Object.assign({
            category_key: b.category_key,
            category_name: b.category_name,
            subcategories: Object.keys(b.subcategories).map(function (sk) {
                const sub = b.subcategories[sk];
                return Object.assign({
                    subcategory_key: sub.subcategory_key,
                    subcategory_name: sub.subcategory_name,
                    is_active: sub.is_active !== false
                }, pickCountFields(sub));
            })
        }, pickCountFields(b.totals));
    });

    return {
        summary: Object.assign({
            asset_rows_scanned: (assets || []).length,
            category_count: resultCategories.length,
            orphan_category_count: orphanCategories.length,
            official_manufacturer_id: officialManufacturerId
        }, pickCountFields(summary)),
        categories: resultCategories,
        orphan_categories: orphanCategories,
        unknown_category_keys: Object.keys(unknownCategoryKeys).sort()
    };
}

module.exports = {
    emptyCounts,
    countAssetImages,
    effectiveAssetKind,
    aggregateVendorAssetCategoryStats
};
