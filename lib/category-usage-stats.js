'use strict';

function emptySimpleCounts() {
    return { records: 0, images: 0 };
}

function addSimpleCounts(target, delta) {
    target.records += delta.records || 0;
    target.images += delta.images || 0;
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
            subcategory_name: (subNameByKey && subcategoryKey && subNameByKey[subcategoryKey]) || k,
            is_active: (subActiveByKey && subcategoryKey && subActiveByKey[subcategoryKey] !== undefined)
                ? subActiveByKey[subcategoryKey]
                : true
        }, emptySimpleCounts());
    } else {
        if (subNameByKey && subcategoryKey && subNameByKey[subcategoryKey]) {
            map[k].subcategory_name = subNameByKey[subcategoryKey];
        }
        if (subActiveByKey && subcategoryKey && subActiveByKey[subcategoryKey] !== undefined) {
            map[k].is_active = subActiveByKey[subcategoryKey];
        }
    }
    return map[k];
}

function buildCategoryIndex(categories, includeInactive) {
    const catByKey = {};
    const subToMain = {};
    const mainKeys = new Set();
    (categories || []).forEach(function (c) {
        if (!c || !c.key) return;
        if (!includeInactive && c.is_active === false) return;
        mainKeys.add(c.key);
        const subNameByKey = {};
        const subActiveByKey = {};
        (c.subcategories || []).forEach(function (s) {
            if (!s || !s.key) return;
            if (!includeInactive && s.is_active === false) return;
            subToMain[s.key] = c.key;
            subNameByKey[s.key] = s.name || s.key;
            subActiveByKey[s.key] = s.is_active !== false;
        });
        catByKey[c.key] = {
            category_key: c.key,
            category_name: c.name || c.key,
            is_active: c.is_active !== false,
            sort_order: c.sort_order != null ? c.sort_order : 0,
            subNameByKey: subNameByKey,
            subActiveByKey: subActiveByKey,
            subcategories: {},
            totals: emptySimpleCounts()
        };
    });
    return { catByKey, subToMain, mainKeys };
}

/**
 * @param {Array<{category_key:string,subcategory_key?:string|null,records:number,images:number}>} items
 */
function aggregateSimpleCategoryUsage(items, categories, opts) {
    const options = opts || {};
    const includeInactive = options.include_inactive !== false;
    const index = buildCategoryIndex(categories, includeInactive);
    const catByKey = index.catByKey;
    const orphanByKey = {};
    const orphanTotals = emptySimpleCounts();

    (items || []).forEach(function (item) {
        if (!item) return;
        const ck = String(item.category_key || '').trim() || '(無分類)';
        const delta = { records: item.records || 0, images: item.images || 0 };
        const bucket = catByKey[ck];
        if (bucket) {
            addSimpleCounts(bucket.totals, delta);
            const sub = ensureSubBucket(bucket.subcategories, item.subcategory_key, bucket.subNameByKey, bucket.subActiveByKey);
            addSimpleCounts(sub, delta);
            return;
        }
        addSimpleCounts(orphanTotals, delta);
        if (!orphanByKey[ck]) {
            orphanByKey[ck] = {
                category_key: ck,
                category_name: ck,
                subcategories: {},
                totals: emptySimpleCounts()
            };
        }
        addSimpleCounts(orphanByKey[ck].totals, delta);
        const sub = ensureSubBucket(orphanByKey[ck].subcategories, item.subcategory_key, null);
        addSimpleCounts(sub, delta);
    });

    const summary = emptySimpleCounts();
    const resultCategories = (categories || [])
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
            addSimpleCounts(summary, b.totals);
            const subs = Object.keys(b.subcategories).map(function (sk) { return b.subcategories[sk]; })
                .sort(function (a, b2) { return String(a.subcategory_name).localeCompare(String(b2.subcategory_name)); })
                .map(function (sub) {
                    return {
                        subcategory_key: sub.subcategory_key,
                        subcategory_name: sub.subcategory_name,
                        is_active: sub.is_active !== false,
                        records: sub.records,
                        images: sub.images
                    };
                });
            return {
                category_key: b.category_key,
                category_name: b.category_name,
                is_active: b.is_active,
                records: b.totals.records,
                images: b.totals.images,
                subcategories: subs
            };
        });

    addSimpleCounts(summary, orphanTotals);

    const orphanCategories = Object.keys(orphanByKey).sort().map(function (ck) {
        const b = orphanByKey[ck];
        return {
            category_key: b.category_key,
            category_name: b.category_name,
            records: b.totals.records,
            images: b.totals.images,
            subcategories: Object.keys(b.subcategories).map(function (sk) { return b.subcategories[sk]; })
        };
    });

    return {
        summary: Object.assign({
            rows_scanned: (items || []).length,
            category_count: resultCategories.length,
            orphan_category_count: orphanCategories.length
        }, summary),
        categories: resultCategories,
        orphan_categories: orphanCategories
    };
}

function buildSubcategoryIndex(categories, includeInactive) {
    const index = buildCategoryIndex(categories, includeInactive);
    return { subToMain: index.subToMain, mainKeys: index.mainKeys };
}

/** custom_products：category 可能存主分類或子分類 key */
function resolveCustomProductCategory(row, catIndex) {
    const cat = String((row && row.category) || '').trim();
    const sub = String((row && row.subcategory_key) || '').trim();
    const subToMain = catIndex.subToMain || {};
    const mainKeys = catIndex.mainKeys || new Set();
    if (sub && subToMain[sub]) {
        return { category_key: subToMain[sub], subcategory_key: sub };
    }
    if (sub && mainKeys.has(cat)) {
        return { category_key: cat, subcategory_key: sub };
    }
    if (cat && subToMain[cat]) {
        return { category_key: subToMain[cat], subcategory_key: cat };
    }
    if (cat && mainKeys.has(cat)) {
        return { category_key: cat, subcategory_key: null };
    }
    if (cat) return { category_key: cat, subcategory_key: sub || null };
    return { category_key: '(無分類)', subcategory_key: null };
}

function countCustomProductImages(row) {
    let n = 0;
    if (row && row.ai_generated_image_url && String(row.ai_generated_image_url).trim()) n += 1;
    if (row && row.reference_image_url && String(row.reference_image_url).trim()) n += 1;
    return n;
}

function mapCustomProductToUsageItem(row, catIndex) {
    const keys = resolveCustomProductCategory(row, catIndex);
    return {
        category_key: keys.category_key,
        subcategory_key: keys.subcategory_key,
        records: 1,
        images: countCustomProductImages(row)
    };
}

function countPromoGenerationImages(row) {
    return (row && row.result_image_url && String(row.result_image_url).trim()) ? 1 : 0;
}

module.exports = {
    emptySimpleCounts,
    aggregateSimpleCategoryUsage,
    buildSubcategoryIndex,
    resolveCustomProductCategory,
    countCustomProductImages,
    mapCustomProductToUsageItem,
    countPromoGenerationImages
};
