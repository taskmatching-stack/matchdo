'use strict';

/** 與 docs/add-promo-theme-scene-slots.sql 場景種子同步（slot=scene） */
const PROMO_SCENE_DEFAULTS = [
    {
        key: 'scene_clean_studio',
        name: '乾淨棚拍場景',
        description: '簡潔商業棚拍環境，適合主視覺',
        scene_prompt: 'place the product against a seamless advertising backdrop with even wrap light and gentle form shadows on the subject. Catalog-ready commercial still. Finished hero photograph, not a behind-the-scenes studio view.',
        composition_hint: 'seamless advertising backdrop. product clearly isolated as hero. catalog still, not a behind-the-scenes studio. not a lifestyle room story',
        category: 'scene',
        sort_order: 10
    },
    {
        key: 'scene_retail_display',
        name: '零售陳列場景',
        description: '店頭／陳列架廣告感',
        scene_prompt: 'place the product in a premium retail display advertising environment suitable for in-store promo',
        composition_hint: 'retail shelf or display context that supports the product as the advertised hero',
        category: 'scene',
        sort_order: 20
    },
    {
        key: 'scene_exhibition',
        name: '展場／活動攤位',
        description: '展覽會場或活動攤位主視覺感',
        scene_prompt: 'place the product in an exhibition booth or trade-show advertising environment with clean campaign lighting',
        composition_hint: 'booth / event promo framing; commercial event energy without cluttered lifestyle narrative',
        category: 'scene',
        sort_order: 30
    },
    {
        key: 'scene_soft_gradient',
        name: '柔色漸層背景',
        description: '抽象柔色漸層，偏品牌廣告',
        scene_prompt: 'place the product against a soft abstract gradient advertising backdrop with premium brand lighting',
        composition_hint: 'minimal abstract commercial environment; product remains the sole hero',
        category: 'scene',
        sort_order: 40
    },
    {
        key: 'scene_outdoor_campaign',
        name: '戶外廣告場景',
        description: '戶外廣告／活動宣傳感（非居家）',
        scene_prompt: 'place the product in an outdoor commercial campaign advertising environment with dramatic natural or campaign lighting',
        composition_hint: 'outdoor campaign ad look; forbid inventing unrelated home-interior lifestyle stories',
        category: 'scene',
        sort_order: 50
    }
];

function isMissingColumnError(error, col) {
    if (!error) return false;
    const msg = String(error.message || '');
    return error.code === '42703' || error.code === 'PGRST204'
        || (col && msg.includes(col))
        || /column.*does not exist|Could not find.*column|schema cache/i.test(msg);
}

async function applyPromoSceneDefaults(supabase) {
    const probe = await supabase.from('promo_scene_templates').select('key, slot').limit(1);
    if (probe.error && isMissingColumnError(probe.error, 'slot')) {
        return {
            success: false,
            code: 'SLOT_MIGRATION_REQUIRED',
            message: '資料表尚無 slot 欄位。請至「資料庫維護」執行「情境圖主題／場景 slot」，或於 Supabase 執行 docs/add-promo-theme-scene-slots.sql'
        };
    }
    if (probe.error && probe.error.code === '42P01') {
        return {
            success: false,
            code: 'TABLE_MISSING',
            message: '請先執行 docs/add-product-promo-image.sql 建立 promo_scene_templates 表'
        };
    }

    const now = new Date().toISOString();
    let applied = 0;
    const errors = [];

    for (const t of PROMO_SCENE_DEFAULTS) {
        const payload = {
            key: t.key,
            name: t.name,
            description: t.description,
            scene_prompt: t.scene_prompt,
            composition_hint: t.composition_hint,
            category: t.category,
            recommended_ratios: ['1:1', '4:3', '16:9'],
            slot: 'scene',
            sort_order: t.sort_order,
            is_active: true,
            updated_at: now
        };
        let { error } = await supabase.from('promo_scene_templates').upsert(payload, { onConflict: 'key' });
        if (error && isMissingColumnError(error, 'slot')) {
            delete payload.slot;
            ({ error } = await supabase.from('promo_scene_templates').upsert(payload, { onConflict: 'key' }));
            if (!error) {
                errors.push(t.key + '：已寫入但無 slot 欄，請執行 add-promo-theme-scene-slots.sql');
            }
        }
        if (error) errors.push(t.key + '：' + (error.message || error.code));
        else applied += 1;
    }

    return {
        success: errors.length === 0,
        applied,
        total: PROMO_SCENE_DEFAULTS.length,
        errors,
        message: errors.length
            ? '部分場景寫入失敗'
            : ('已寫入 ' + applied + ' 筆場景模板；請在上方「場景」分頁編輯名稱與提示詞')
    };
}

function countSceneTemplates(items) {
    return (items || []).filter((r) => {
        const slot = String(r.slot || '').toLowerCase();
        const key = String(r.key || '').toLowerCase();
        const cat = String(r.category || '').toLowerCase();
        return slot === 'scene' || key.startsWith('scene_') || cat === 'scene';
    }).length;
}

/** 與 docs/add-promo-shoot-modes.sql 人像 8 主題同步（slot=theme, audience=portrait） */
const PROMO_PORTRAIT_THEME_DEFAULTS = [
    {
        key: 'portrait_corporate',
        name: '商業形象',
        name_en: 'Corporate portrait',
        description: '專業可信的商業人像',
        scene_prompt: 'professional corporate portrait photography, trustworthy expression, clean background, business lighting',
        composition_hint: 'commercial headshot or half-body; professional campaign quality',
        category: 'portrait',
        sort_order: 110
    },
    {
        key: 'portrait_fashion_lookbook',
        name: '時尚型錄',
        name_en: 'Fashion lookbook',
        description: '編輯時尚型錄人像',
        scene_prompt: 'editorial fashion lookbook portrait, garment lines visible, fashion campaign composition',
        composition_hint: 'lookbook framing; apparel and styling readable',
        category: 'portrait',
        sort_order: 120
    },
    {
        key: 'portrait_lifestyle',
        name: '生活情境',
        name_en: 'Lifestyle',
        description: '自然敘事生活人像',
        scene_prompt: 'natural lifestyle portrait photography, narrative everyday environment, authentic mood',
        composition_hint: 'lifestyle story framing; approachable and real',
        category: 'portrait',
        sort_order: 130
    },
    {
        key: 'portrait_sports',
        name: '運動',
        name_en: 'Sports',
        description: '動感運動人像',
        scene_prompt: 'dynamic sports portrait photography, athletic energy, studio or action context',
        composition_hint: 'athletic campaign energy; subject power and motion',
        category: 'portrait',
        sort_order: 140
    },
    {
        key: 'portrait_beauty',
        name: '美妝',
        name_en: 'Beauty',
        description: '美妝膚質人像',
        scene_prompt: 'beauty portrait photography, skin texture and makeup detail, soft beauty lighting',
        composition_hint: 'beauty campaign close-up or beauty half-body',
        category: 'portrait',
        sort_order: 150
    },
    {
        key: 'portrait_formal_id',
        name: '證件／正式肖像',
        name_en: 'Formal ID portrait',
        description: '正式證件感肖像',
        scene_prompt: 'formal ID-style portrait, front-facing, even lighting, plain background, formal posture',
        composition_hint: 'official portrait framing; neutral background',
        category: 'portrait',
        sort_order: 160
    },
    {
        key: 'portrait_brand_image',
        name: '品牌形象',
        name_en: 'Brand image',
        description: '品牌 campaign 人像',
        scene_prompt: 'premium brand image portrait, campaign consistency, elevated commercial mood',
        composition_hint: 'brand campaign hero portrait',
        category: 'portrait',
        sort_order: 170
    },
    {
        key: 'portrait_social_content',
        name: '社群內容',
        name_en: 'Social content',
        description: '社群友善人像',
        scene_prompt: 'engaging social media portrait, vertical-friendly framing, approachable expression',
        composition_hint: 'social content portrait; friendly and shareable',
        category: 'portrait',
        sort_order: 180
    }
];

function resolvePortraitThemeAudience(row) {
    const aud = String((row && row.audience) || '').trim().toLowerCase();
    if (aud === 'portrait') return true;
    const key = String((row && row.key) || '').toLowerCase();
    const slot = String((row && row.slot) || '').toLowerCase();
    return slot === 'theme' && key.indexOf('portrait_') === 0;
}

function countPortraitThemeTemplates(items) {
    return (items || []).filter((r) => {
        const slot = String(r.slot || '').toLowerCase();
        if (slot === 'scene') return false;
        return resolvePortraitThemeAudience(r);
    }).length;
}

async function applyPromoPortraitThemeDefaults(supabase) {
    const probe = await supabase.from('promo_scene_templates').select('key, audience').limit(1);
    if (probe.error && probe.error.code === '42P01') {
        return {
            success: false,
            code: 'TABLE_MISSING',
            message: '請先執行 docs/add-product-promo-image.sql 建立 promo_scene_templates 表'
        };
    }
    if (probe.error && isMissingColumnError(probe.error, 'audience')) {
        return {
            success: false,
            code: 'AUDIENCE_MIGRATION_REQUIRED',
            message: '資料表尚無 audience 欄位。請至「資料庫維護」執行「商攝・人像主題 audience + 8 類 seed」，或於 Supabase 執行 docs/add-promo-shoot-modes.sql'
        };
    }

    const now = new Date().toISOString();
    let applied = 0;
    const errors = [];

    for (const t of PROMO_PORTRAIT_THEME_DEFAULTS) {
        const payload = {
            key: t.key,
            name: t.name,
            name_en: t.name_en,
            description: t.description,
            scene_prompt: t.scene_prompt,
            composition_hint: t.composition_hint,
            category: t.category,
            recommended_ratios: ['1:1', '4:3', '16:9'],
            slot: 'theme',
            audience: 'portrait',
            sort_order: t.sort_order,
            is_active: true,
            updated_at: now
        };
        let { error } = await supabase.from('promo_scene_templates').upsert(payload, { onConflict: 'key' });
        if (error) errors.push(t.key + '：' + (error.message || error.code));
        else applied += 1;
    }

    return {
        success: errors.length === 0,
        applied,
        total: PROMO_PORTRAIT_THEME_DEFAULTS.length,
        errors,
        message: errors.length
            ? '部分人像主題寫入失敗'
            : ('已寫入 ' + applied + ' 筆人像主題；請在「主題 → 人像攝影」分頁編輯')
    };
}

module.exports = {
    PROMO_SCENE_DEFAULTS,
    PROMO_PORTRAIT_THEME_DEFAULTS,
    applyPromoSceneDefaults,
    applyPromoPortraitThemeDefaults,
    countSceneTemplates,
    countPortraitThemeTemplates,
    resolvePortraitThemeAudience
};
