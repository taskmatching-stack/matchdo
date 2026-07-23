'use strict';

/** 與 docs/add-promo-theme-scene-slots.sql 場景種子同步（slot=scene） */
const PROMO_SCENE_DEFAULTS = [
    {
        key: 'scene_clean_studio',
        name: '乾淨棚拍場景',
        description: '簡潔商業棚拍環境，適合主視覺',
        scene_prompt: 'place the product in a clean commercial studio advertising environment with controlled seamless backdrop and polished studio lighting',
        composition_hint: 'studio advertising set; product clearly isolated as hero; not a lifestyle room story',
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

module.exports = {
    PROMO_SCENE_DEFAULTS,
    applyPromoSceneDefaults,
    countSceneTemplates
};
