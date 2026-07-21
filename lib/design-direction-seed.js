'use strict';

/** 舊「再製服務」主分類 key — 套用設計風向種子時會停用並刪其子分類 */
const LEGACY_REMAKE_KEYS = [
    'apparel_remake', 'furniture_remake', 'leather_care', 'shoes_repair',
    'electronics_mod', 'bag_repair', 'home_refurbish'
];

/** 與 docs/seed-design-direction-categories.sql 同步 */
const DESIGN_DIRECTION_CATEGORIES = [
    { key: 'formal_wear', name: '正裝與禮服', name_en: 'Formal & occasionwear', sort_order: 10, prompt: '【設計風向｜設計意圖分析】主品類：正裝與禮服；子品類：{subcategory}。依參考圖與使用者描述，解析風格調性、廓形結構、材質與色彩、穿著情境、目標客群；並綜合系統附錄之平台同品類生圖分類量與 tags 趨勢，指出對齊或差異化機會。供設計探索與生圖方向，勿輸出改裝、翻新、再製或舊物改造方案。' },
    { key: 'sports_gear', name: '專業運動裝備', name_en: 'Sports gear', sort_order: 20, prompt: '【設計風向｜設計意圖分析】主品類：專業運動裝備；子品類：{subcategory}。解析機能取向、運動情境、材質透氣／防護、配色與品牌風格、目標運動族群。聚焦新設計方向，勿寫改裝或舊品翻新。' },
    { key: 'craft_shoes_boots', name: '工藝皮鞋與靴', name_en: 'Craft shoes & boots', sort_order: 30, prompt: '【設計風向｜設計意圖分析】主品類：工藝皮鞋與靴；子品類：{subcategory}。解析楦型、鞋面結構、皮革／材質質感、工藝細節、穿著場合與風格調性。聚焦新設計探索，勿寫換底、改色等維修再製。' },
    { key: 'street_sneakers', name: '潮流球鞋與休閒', name_en: 'Sneakers & casual footwear', sort_order: 40, prompt: '【設計風向｜設計意圖分析】主品類：潮流球鞋與休閒鞋；子品類：{subcategory}。解析鞋型輪廓、中底／鞋面層次、配色故事、次文化／潮流調性、目標客群。勿寫舊鞋改裝或塗鴉翻新方案。' },
    { key: 'luxury_bags', name: '精品包袋', name_en: 'Luxury bags', sort_order: 50, prompt: '【設計風向｜設計意圖分析】主品類：精品包袋；子品類：{subcategory}。解析包型結構、五金與細節、材質與工藝、使用情境、品牌風格語意。聚焦新設計方向，勿寫拆解改小包等再製。' },
    { key: 'leather_accessories', name: '時尚皮件配件', name_en: 'Leather accessories', sort_order: 60, prompt: '【設計風向｜設計意圖分析】主品類：時尚皮件配件；子品類：{subcategory}。解析小皮件／配件造型、材質紋理、色彩、工藝與日常使用情境。勿寫舊料拼接再製。' },
    { key: 'sofa_seating', name: '居家沙發與坐具', name_en: 'Sofas & seating', sort_order: 70, prompt: '【設計風向｜設計意圖分析】主品類：居家沙發與坐具；子品類：{subcategory}。解析坐具形體、軟包／框架比例、面料與色彩、空間風格、居住情境。聚焦新設計，勿寫舊沙發換皮翻新。' },
    { key: 'system_furniture', name: '系統家具與桌台', name_en: 'System furniture', sort_order: 80, prompt: '【設計風向｜設計意圖分析】主品類：系統家具與桌台；子品類：{subcategory}。解析模組邏輯、線條與比例、材質表面、收納／機能與空間使用情境。勿寫舊家具改裝。' },
    { key: 'jewelry', name: '珠寶與高級飾品', name_en: 'Jewelry', sort_order: 90, prompt: '【設計風向｜設計意圖分析】主品類：珠寶與高級飾品；子品類：{subcategory}。解析造型語彙、材質與寶石／金屬、佩戴場合、風格調性與目標客群。勿寫舊料重鑲再製。' },
    { key: 'watches_tech', name: '鐘錶與科技配件', name_en: 'Watches & tech accessories', sort_order: 100, prompt: '【設計風向｜設計意圖分析】主品類：鐘錶與科技配件；子品類：{subcategory}。解析錶盤／殼型或科技配件造型、材質、色彩、使用情境與風格。勿寫 Mod 改裝或舊殼翻新。' },
    { key: 'streetwear', name: '潮流與機能服飾', name_en: 'Streetwear & techwear', sort_order: 110, prompt: '【設計風向｜設計意圖分析】主品類：潮流與機能服飾；子品類：{subcategory}。解析街頭／機能風格、廓形、細節（口袋、拉鍊、標識）、配色與文化參照。勿寫舊衣加工或破壞洗舊再製。' },
    { key: 'lifestyle_pet', name: '生活精品與寵物', name_en: 'Lifestyle & pet', sort_order: 120, prompt: '【設計風向｜設計意圖分析】主品類：生活精品與寵物；子品類：{subcategory}。解析生活用品或寵物用品的造型、材質、色彩、使用情境與風格一致性。聚焦新設計方向。' }
];

const DESIGN_DIRECTION_SUBCATEGORIES = [
    ['formal_wear', 'suit', '西裝', 10], ['formal_wear', 'shirt', '襯衫', 20], ['formal_wear', 'evening_gown', '晚禮服', 30],
    ['formal_wear', 'wedding', '婚紗', 40], ['formal_wear', 'cheongsam', '旗袍', 50], ['formal_wear', 'overcoat', '大衣', 60],
    ['sports_gear', 'basketball_football', '籃球/足球系列', 10], ['sports_gear', 'baseball', '棒球裝備', 20], ['sports_gear', 'golf', '高爾夫裝', 30], ['sports_gear', 'protective', '防摔衣', 40],
    ['craft_shoes_boots', 'oxford_derby', '牛津/德比鞋', 10], ['craft_shoes_boots', 'loafer', '樂福鞋', 20], ['craft_shoes_boots', 'boots', '手工皮靴', 30], ['craft_shoes_boots', 'heels', '高跟鞋', 40],
    ['street_sneakers', 'skate', '滑板鞋', 10], ['street_sneakers', 'dad_shoes', '老爹鞋', 20], ['street_sneakers', 'sport_sandals', '運動涼鞋', 30], ['street_sneakers', 'canvas', '帆布鞋', 40],
    ['luxury_bags', 'briefcase', '公事包', 10], ['luxury_bags', 'handbag', '手提包', 20], ['luxury_bags', 'backpack', '後背包', 30], ['luxury_bags', 'tote', '托特包', 40], ['luxury_bags', 'clutch', '晚宴包', 50],
    ['leather_accessories', 'wallet', '皮夾', 10], ['leather_accessories', 'belt', '皮帶', 20], ['leather_accessories', 'watch_strap', '錶帶', 30], ['leather_accessories', 'card_holder', '證件套', 40], ['leather_accessories', 'camera_strap', '相機帶', 50], ['leather_accessories', 'key_holder', '鑰匙包', 60],
    ['sofa_seating', 'l_sofa', 'L型沙發', 10], ['sofa_seating', 'armchair', '單人椅', 20], ['sofa_seating', 'recliner', '功能沙發', 30], ['sofa_seating', 'dining_chair', '餐椅', 40], ['sofa_seating', 'bench', '長凳', 50],
    ['system_furniture', 'dining_table', '餐桌', 10], ['system_furniture', 'desk', '書桌', 20], ['system_furniture', 'island', '中島', 30], ['system_furniture', 'storage', '收納櫃', 40], ['system_furniture', 'bed_frame', '床架', 50], ['system_furniture', 'screen', '屏風', 60],
    ['jewelry', 'ring', '戒指', 10], ['jewelry', 'necklace', '項鍊', 20], ['jewelry', 'earrings', '耳環', 30], ['jewelry', 'cufflinks', '袖扣', 40], ['jewelry', 'brooch', '胸針', 50], ['jewelry', 'bracelet', '手鍊', 60],
    ['watches_tech', 'mechanical_watch', '機械錶', 10], ['watches_tech', 'smart_watch_band', '智慧手錶帶', 20], ['watches_tech', 'phone_case', '手機殼', 30], ['watches_tech', 'laptop_bag', '筆電包', 40], ['watches_tech', 'keyboard', '鍵盤', 50],
    ['streetwear', 'hoodie', '帽T', 10], ['streetwear', 'cargo', '工裝褲', 20], ['streetwear', 'denim_jacket', '單寧夾克', 30], ['streetwear', 'yoga', '瑜珈服', 40], ['streetwear', 'flight_jacket', '飛行外套', 50],
    ['lifestyle_pet', 'umbrella', '傘具', 10], ['lifestyle_pet', 'eyewear', '眼鏡', 20], ['lifestyle_pet', 'pet_collar', '寵物項圈/胸背帶', 30], ['lifestyle_pet', 'fragrance', '香氛瓶', 40], ['lifestyle_pet', 'stationery', '文具', 50]
];

function isMissingColumnError(error, col) {
    if (!error) return false;
    const msg = String(error.message || '');
    return error.code === '42703' || error.code === 'PGRST204'
        || (col && msg.includes(col))
        || /column.*does not exist|Could not find.*column|schema cache/i.test(msg);
}

async function applyDesignDirectionSeed(supabase) {
    const now = new Date().toISOString();
    const stats = { categories: 0, subcategories: 0, legacy_deactivated: 0, errors: [] };

    const { error: deactErr } = await supabase
        .from('remake_categories')
        .update({ is_active: false, updated_at: now })
        .in('key', LEGACY_REMAKE_KEYS);
    if (deactErr) stats.errors.push('停用舊再製分類：' + (deactErr.message || deactErr.code));
    else stats.legacy_deactivated = LEGACY_REMAKE_KEYS.length;

    const { error: delSubErr } = await supabase
        .from('remake_subcategories')
        .delete()
        .in('category_key', LEGACY_REMAKE_KEYS);
    if (delSubErr) stats.errors.push('刪除舊再製子分類：' + (delSubErr.message || delSubErr.code));

    for (const c of DESIGN_DIRECTION_CATEGORIES) {
        const base = {
            key: c.key,
            name: c.name,
            prompt: c.prompt,
            sort_order: c.sort_order,
            is_active: true,
            updated_at: now
        };
        let payload = { ...base, name_en: c.name_en || null };
        let { error } = await supabase.from('remake_categories').upsert(payload, { onConflict: 'key' });
        if (error && isMissingColumnError(error, 'name_en')) {
            ({ error } = await supabase.from('remake_categories').upsert(base, { onConflict: 'key' }));
        }
        if (error) stats.errors.push('主分類 ' + c.key + '：' + (error.message || error.code));
        else stats.categories += 1;
    }

    for (const row of DESIGN_DIRECTION_SUBCATEGORIES) {
        const [category_key, key, name, sort_order] = row;
        const payload = {
            category_key,
            key,
            name,
            prompt: '',
            sort_order,
            is_active: true,
            updated_at: now
        };
        const { error } = await supabase.from('remake_subcategories').upsert(payload, { onConflict: 'category_key,key' });
        if (error) stats.errors.push('子分類 ' + category_key + '/' + key + '：' + (error.message || error.code));
        else stats.subcategories += 1;
    }

    return {
        success: stats.errors.length === 0,
        ...stats,
        message: stats.errors.length
            ? '部分項目失敗，請見 errors'
            : ('已套用設計風向種子：' + stats.categories + ' 主分類、' + stats.subcategories + ' 子分類')
    };
}

function needsDesignDirectionSeed(categories) {
    const list = categories || [];
    const activeKeys = new Set(list.filter((c) => c.is_active !== false).map((c) => c.key));
    const hasLegacy = LEGACY_REMAKE_KEYS.some((k) => activeKeys.has(k));
    const hasNew = activeKeys.has('formal_wear');
    return hasLegacy || !hasNew;
}

module.exports = {
    LEGACY_REMAKE_KEYS,
    DESIGN_DIRECTION_CATEGORIES,
    applyDesignDirectionSeed,
    needsDesignDirectionSeed
};
