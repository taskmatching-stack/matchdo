'use strict';

/**
 * 訂製生圖資料血緣：判定生圖帳號是否引用自己廠商素材（僅後端／分析用，不暴露給前端）。
 * is_vendor_self_serve = 僅當 has_self_vendor_reference（從素材庫選到自己廠素材），
 * 上傳參考圖但未選素材庫不算。
 */

async function computeCustomProductLineage(supabase, generatorUserId, referenceSourcesRaw) {
    const generatorUserIdStr = (generatorUserId || '').trim();
    const rawList = Array.isArray(referenceSourcesRaw) ? referenceSourcesRaw : [];

    let generatorManufacturerId = null;
    if (generatorUserIdStr) {
        const { data: mfr } = await supabase
            .from('manufacturers')
            .select('id')
            .eq('user_id', generatorUserIdStr)
            .maybeSingle();
        if (mfr && mfr.id) generatorManufacturerId = mfr.id;
    }

    const mfrIds = [...new Set(rawList.map((s) => (s && s.manufacturer_id) || '').filter(Boolean))];
    const mfrUserById = {};
    if (mfrIds.length) {
        const { data: mfrs } = await supabase
            .from('manufacturers')
            .select('id, user_id')
            .in('id', mfrIds);
        (mfrs || []).forEach((m) => {
            if (m && m.id) mfrUserById[m.id] = m.user_id || null;
        });
    }

    const referenceFlags = [];
    let hasSelfVendorReference = false;

    const referenceSources = rawList.map((s) => {
        const manufacturerId = (s && s.manufacturer_id) || null;
        const manufacturerUserId = manufacturerId ? (mfrUserById[manufacturerId] || null) : null;
        const isSame =
            !!(generatorUserIdStr && manufacturerUserId && manufacturerUserId === generatorUserIdStr);
        if (isSame) hasSelfVendorReference = true;
        referenceFlags.push({
            vendor_asset_id: s.vendor_asset_id || null,
            manufacturer_id: manufacturerId,
            manufacturer_user_id: manufacturerUserId,
            is_same_account_as_generator: isSame
        });
        const levels = (s && s.customization_levels) ? (Array.isArray(s.customization_levels) ? s.customization_levels : []) : [];
        const moq = (s && s.min_order_quantity != null && Number.isFinite(Number(s.min_order_quantity))) ? Number(s.min_order_quantity) : null;
        const patternIntent = (s && s.pattern_intent != null) ? String(s.pattern_intent).trim().toLowerCase() : '';
        const out = {
            vendor_asset_id: s.vendor_asset_id || null,
            manufacturer_id: manufacturerId,
            manufacturer_name: (s && s.manufacturer_name) || '',
            manufacturer_profile_url: (s && s.manufacturer_profile_url) || '',
            image_url: (s && s.image_url) || '',
            asset_kind: (s && s.asset_kind) || null,
            title: (s && s.title) ? String(s.title).trim() : undefined,
            user_note: (s && s.user_note) ? String(s.user_note).trim() : undefined,
            customization_levels: levels.length ? levels : undefined,
            min_order_quantity: moq != null && moq >= 1 ? moq : undefined,
            manufacturer_user_id: manufacturerUserId,
            is_same_account_as_generator: isSame
        };
        if (patternIntent === 'style' || patternIntent === 'print') out.pattern_intent = patternIntent;
        const applyMode = (s && s.pattern_apply_mode != null) ? String(s.pattern_apply_mode).trim().toLowerCase() : '';
        if (applyMode === 'original' || applyMode === 'remove_bg' || applyMode === 'motif_extract') out.pattern_apply_mode = applyMode;
        else if (s && s.pattern_remove_bg === true) out.pattern_remove_bg = true;
        const galleryLabel = (s && s.gallery_label != null) ? String(s.gallery_label).trim() : '';
        const imageLabel = (s && s.image_label != null) ? String(s.image_label).trim() : '';
        if (galleryLabel) out.gallery_label = galleryLabel;
        else if (imageLabel) out.gallery_label = imageLabel;
        if (imageLabel) out.image_label = imageLabel;
        return out;
    });

    const isVendorSelfServe = !!(generatorManufacturerId && hasSelfVendorReference);

    return {
        generator_manufacturer_id: generatorManufacturerId,
        has_self_vendor_reference: hasSelfVendorReference,
        is_vendor_self_serve: isVendorSelfServe,
        reference_sources: referenceSources.length ? referenceSources : null,
        data_lineage_json: {
            generator_user_id: generatorUserIdStr || null,
            generator_manufacturer_id: generatorManufacturerId,
            has_self_vendor_reference: hasSelfVendorReference,
            is_vendor_self_serve: isVendorSelfServe,
            computed_at: new Date().toISOString(),
            reference_flags: referenceFlags
        }
    };
}

/** 移除僅供內部分析的欄位，避免前端得知規則 */
function stripInternalCustomProductFields(row) {
    if (!row || typeof row !== 'object') return row;
    const o = { ...row };
    delete o.is_vendor_self_serve;
    delete o.has_self_vendor_reference;
    delete o.generator_manufacturer_id;
    delete o.data_lineage_json;
    delete o.designer_country_code;
    delete o.designer_region_codes;
    delete o.designer_region_source;
    delete o.designer_ui_locale;
    delete o.designer_region_json;
    if (Array.isArray(o.reference_sources)) {
        o.reference_sources = o.reference_sources.map((s) => {
            if (!s || typeof s !== 'object') return s;
            const x = { ...s };
            delete x.manufacturer_user_id;
            delete x.is_same_account_as_generator;
            return x;
        });
    }
    return o;
}

module.exports = {
    computeCustomProductLineage,
    stripInternalCustomProductFields
};
