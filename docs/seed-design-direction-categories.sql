-- 設計風向分類種子（設計意圖分析用 — 非再製／改裝）
-- 對應前台：設計風向 → 設計意圖分析（/remake-product.html）
-- 後台：/admin/remake-categories.html
-- 執行：Supabase SQL Editor（可重複執行）

-- 1) 停用舊「再製服務」主分類（與設計風向無關）
UPDATE public.remake_categories
SET is_active = false, updated_at = NOW()
WHERE key IN (
    'apparel_remake', 'furniture_remake', 'leather_care', 'shoes_repair',
    'electronics_mod', 'bag_repair', 'home_refurbish'
);

DELETE FROM public.remake_subcategories
WHERE category_key IN (
    'apparel_remake', 'furniture_remake', 'leather_care', 'shoes_repair',
    'electronics_mod', 'bag_repair', 'home_refurbish'
);

-- 2) 主分類：品類域 + 設計意圖分析 prompt（勿寫改裝／翻新／再製）
INSERT INTO public.remake_categories (key, name, name_en, prompt, sort_order, is_active) VALUES
('formal_wear', '正裝與禮服', 'Formal & occasionwear',
 '【設計風向｜設計意圖分析】主品類：正裝與禮服；子品類：{subcategory}。依參考圖與使用者描述，解析風格調性、廓形結構、材質與色彩、穿著情境、目標客群；並綜合系統附錄之平台同品類生圖分類量與 tags 趨勢，指出對齊或差異化機會。供設計探索與生圖方向，勿輸出改裝、翻新、再製或舊物改造方案。', 10, true),
('sports_gear', '專業運動裝備', 'Sports gear',
 '【設計風向｜設計意圖分析】主品類：專業運動裝備；子品類：{subcategory}。解析機能取向、運動情境、材質透氣／防護、配色與品牌風格、目標運動族群。聚焦新設計方向，勿寫改裝或舊品翻新。', 20, true),
('craft_shoes_boots', '工藝皮鞋與靴', 'Craft shoes & boots',
 '【設計風向｜設計意圖分析】主品類：工藝皮鞋與靴；子品類：{subcategory}。解析楦型、鞋面結構、皮革／材質質感、工藝細節、穿著場合與風格調性。聚焦新設計探索，勿寫換底、改色等維修再製。', 30, true),
('street_sneakers', '潮流球鞋與休閒', 'Sneakers & casual footwear',
 '【設計風向｜設計意圖分析】主品類：潮流球鞋與休閒鞋；子品類：{subcategory}。解析鞋型輪廓、中底／鞋面層次、配色故事、次文化／潮流調性、目標客群。勿寫舊鞋改裝或塗鴉翻新方案。', 40, true),
('luxury_bags', '精品包袋', 'Luxury bags',
 '【設計風向｜設計意圖分析】主品類：精品包袋；子品類：{subcategory}。解析包型結構、五金與細節、材質與工藝、使用情境、品牌風格語意。聚焦新設計方向，勿寫拆解改小包等再製。', 50, true),
('leather_accessories', '時尚皮件配件', 'Leather accessories',
 '【設計風向｜設計意圖分析】主品類：時尚皮件配件；子品類：{subcategory}。解析小皮件／配件造型、材質紋理、色彩、工藝與日常使用情境。勿寫舊料拼接再製。', 60, true),
('sofa_seating', '居家沙發與坐具', 'Sofas & seating',
 '【設計風向｜設計意圖分析】主品類：居家沙發與坐具；子品類：{subcategory}。解析坐具形體、軟包／框架比例、面料與色彩、空間風格、居住情境。聚焦新設計，勿寫舊沙發換皮翻新。', 70, true),
('system_furniture', '系統家具與桌台', 'System furniture',
 '【設計風向｜設計意圖分析】主品類：系統家具與桌台；子品類：{subcategory}。解析模組邏輯、線條與比例、材質表面、收納／機能與空間使用情境。勿寫舊家具改裝。', 80, true),
('jewelry', '珠寶與高級飾品', 'Jewelry',
 '【設計風向｜設計意圖分析】主品類：珠寶與高級飾品；子品類：{subcategory}。解析造型語彙、材質與寶石／金屬、佩戴場合、風格調性與目標客群。勿寫舊料重鑲再製。', 90, true),
('watches_tech', '鐘錶與科技配件', 'Watches & tech accessories',
 '【設計風向｜設計意圖分析】主品類：鐘錶與科技配件；子品類：{subcategory}。解析錶盤／殼型或科技配件造型、材質、色彩、使用情境與風格。勿寫 Mod 改裝或舊殼翻新。', 100, true),
('streetwear', '潮流與機能服飾', 'Streetwear & techwear',
 '【設計風向｜設計意圖分析】主品類：潮流與機能服飾；子品類：{subcategory}。解析街頭／機能風格、廓形、細節（口袋、拉鍊、標識）、配色與文化參照。勿寫舊衣加工或破壞洗舊再製。', 110, true),
('lifestyle_pet', '生活精品與寵物', 'Lifestyle & pet',
 '【設計風向｜設計意圖分析】主品類：生活精品與寵物；子品類：{subcategory}。解析生活用品或寵物用品的造型、材質、色彩、使用情境與風格一致性。聚焦新設計方向。', 120, true)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    name_en = EXCLUDED.name_en,
    prompt = EXCLUDED.prompt,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    updated_at = NOW();

-- 3) 子分類：具體品類（供意圖分析定位；prompt 可留空以繼承主分類）
INSERT INTO public.remake_subcategories (category_key, key, name, prompt, sort_order, is_active) VALUES
('formal_wear', 'suit', '西裝', '', 10, true),
('formal_wear', 'shirt', '襯衫', '', 20, true),
('formal_wear', 'evening_gown', '晚禮服', '', 30, true),
('formal_wear', 'wedding', '婚紗', '', 40, true),
('formal_wear', 'cheongsam', '旗袍', '', 50, true),
('formal_wear', 'overcoat', '大衣', '', 60, true),
('sports_gear', 'basketball_football', '籃球/足球系列', '', 10, true),
('sports_gear', 'baseball', '棒球裝備', '', 20, true),
('sports_gear', 'golf', '高爾夫裝', '', 30, true),
('sports_gear', 'protective', '防摔衣', '', 40, true),
('craft_shoes_boots', 'oxford_derby', '牛津/德比鞋', '', 10, true),
('craft_shoes_boots', 'loafer', '樂福鞋', '', 20, true),
('craft_shoes_boots', 'boots', '手工皮靴', '', 30, true),
('craft_shoes_boots', 'heels', '高跟鞋', '', 40, true),
('street_sneakers', 'skate', '滑板鞋', '', 10, true),
('street_sneakers', 'dad_shoes', '老爹鞋', '', 20, true),
('street_sneakers', 'sport_sandals', '運動涼鞋', '', 30, true),
('street_sneakers', 'canvas', '帆布鞋', '', 40, true),
('luxury_bags', 'briefcase', '公事包', '', 10, true),
('luxury_bags', 'handbag', '手提包', '', 20, true),
('luxury_bags', 'backpack', '後背包', '', 30, true),
('luxury_bags', 'tote', '托特包', '', 40, true),
('luxury_bags', 'clutch', '晚宴包', '', 50, true),
('leather_accessories', 'wallet', '皮夾', '', 10, true),
('leather_accessories', 'belt', '皮帶', '', 20, true),
('leather_accessories', 'watch_strap', '錶帶', '', 30, true),
('leather_accessories', 'card_holder', '證件套', '', 40, true),
('leather_accessories', 'camera_strap', '相機帶', '', 50, true),
('leather_accessories', 'key_holder', '鑰匙包', '', 60, true),
('sofa_seating', 'l_sofa', 'L型沙發', '', 10, true),
('sofa_seating', 'armchair', '單人椅', '', 20, true),
('sofa_seating', 'recliner', '功能沙發', '', 30, true),
('sofa_seating', 'dining_chair', '餐椅', '', 40, true),
('sofa_seating', 'bench', '長凳', '', 50, true),
('system_furniture', 'dining_table', '餐桌', '', 10, true),
('system_furniture', 'desk', '書桌', '', 20, true),
('system_furniture', 'island', '中島', '', 30, true),
('system_furniture', 'storage', '收納櫃', '', 40, true),
('system_furniture', 'bed_frame', '床架', '', 50, true),
('system_furniture', 'screen', '屏風', '', 60, true),
('jewelry', 'ring', '戒指', '', 10, true),
('jewelry', 'necklace', '項鍊', '', 20, true),
('jewelry', 'earrings', '耳環', '', 30, true),
('jewelry', 'cufflinks', '袖扣', '', 40, true),
('jewelry', 'brooch', '胸針', '', 50, true),
('jewelry', 'bracelet', '手鍊', '', 60, true),
('watches_tech', 'mechanical_watch', '機械錶', '', 10, true),
('watches_tech', 'smart_watch_band', '智慧手錶帶', '', 20, true),
('watches_tech', 'phone_case', '手機殼', '', 30, true),
('watches_tech', 'laptop_bag', '筆電包', '', 40, true),
('watches_tech', 'keyboard', '鍵盤', '', 50, true),
('streetwear', 'hoodie', '帽T', '', 10, true),
('streetwear', 'cargo', '工裝褲', '', 20, true),
('streetwear', 'denim_jacket', '單寧夾克', '', 30, true),
('streetwear', 'yoga', '瑜珈服', '', 40, true),
('streetwear', 'flight_jacket', '飛行外套', '', 50, true),
('lifestyle_pet', 'umbrella', '傘具', '', 10, true),
('lifestyle_pet', 'eyewear', '眼鏡', '', 20, true),
('lifestyle_pet', 'pet_collar', '寵物項圈/胸背帶', '', 30, true),
('lifestyle_pet', 'fragrance', '香氛瓶', '', 40, true),
('lifestyle_pet', 'stationery', '文具', '', 50, true)
ON CONFLICT (category_key, key) DO UPDATE SET
    name = EXCLUDED.name,
    prompt = EXCLUDED.prompt,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    updated_at = NOW();

COMMENT ON TABLE public.remake_categories IS '設計風向主分類（設計意圖分析；表名沿用 remake_*）';
COMMENT ON TABLE public.remake_subcategories IS '設計風向子分類（具體品類；表名沿用 remake_*）';
