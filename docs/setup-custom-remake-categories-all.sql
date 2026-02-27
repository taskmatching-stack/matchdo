-- ============================================================
-- 訂製品 + 再製 分類與子分類（一次執行、可重複執行）
-- 含：表、RLS、Policy、prompt 欄位、種子資料
-- 執行：Supabase SQL Editor，整份複製貼上執行即可
-- ============================================================

-- 1. 訂製品主分類
CREATE TABLE IF NOT EXISTS public.custom_product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_custom_product_categories_key ON public.custom_product_categories(key);
CREATE INDEX IF NOT EXISTS idx_custom_product_categories_sort ON public.custom_product_categories(sort_order);
ALTER TABLE public.custom_product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_product_categories ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT '';

DROP POLICY IF EXISTS "Anyone can view active custom product categories" ON public.custom_product_categories;
CREATE POLICY "Anyone can view active custom product categories"
    ON public.custom_product_categories FOR SELECT USING (is_active = TRUE);
DROP POLICY IF EXISTS "Allow all for custom_product_categories" ON public.custom_product_categories;
CREATE POLICY "Allow all for custom_product_categories"
    ON public.custom_product_categories FOR ALL USING (true);

INSERT INTO public.custom_product_categories (key, name, prompt, sort_order) VALUES
('formal_wear', '正裝與禮服', '舊衣改款：版型現代化（如寬鬆變修身）、領型更換、婚紗改時裝。', 10),
('sports_gear', '專業運動裝備', '跨界改裝：籃球鞋改棒球釘鞋、球衣改製成隨身包、護具強化。', 20),
('craft_shoes_boots', '工藝皮鞋與靴', '機能改裝：專業換底 (Vibram)、擦色 (Patina) 重製、加裝防水內裡。', 30),
('street_sneakers', '潮流球鞋與休閒', '潮流自定義：鞋面彩繪、異材質拼接（皮革混織物）、結構化支撐改裝。', 40),
('luxury_bags', '精品包袋', '精品再製：大包拆解改小包（LV/Gucci 改製）、包身結構加固、五金升級。', 50),
('leather_accessories', '時尚皮件配件', '材料重組：利用改裝剩下的餘料 AI 拼接設計、雷射雕刻客製化。', 60),
('sofa_seating', '居家沙發與坐具', '翻新再設計：舊沙發換皮/布、填充物彈性調整、椅腳風格改裝。', 70),
('system_furniture', '系統家具與桌台', '模組化改裝：桌面重新研磨、增加智慧充電模組、尺寸縮減/擴張。', 80),
('jewelry', '珠寶與高級飾品', '舊料新鑲：祖傳珠寶重新設計款式、金屬材質電鍍改色。', 90),
('watches_tech', '鐘錶與科技配件', '鐘錶改裝 (Mod)：更換面盤、指針、錶圈；手機殼加裝背帶結構。', 100),
('streetwear', '潮流與機能服飾', '風格加工：牛仔褲重洗色、破壞加工、機能口袋加裝、電繡圖騰。', 110),
('lifestyle_pet', '生活精品與寵物', '跨界設計：寵物用品與主人物件風格同步（AI 匹配材質與色系）。', 120)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, prompt = EXCLUDED.prompt, sort_order = EXCLUDED.sort_order;

-- 2. 訂製品子分類
CREATE TABLE IF NOT EXISTS public.custom_product_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_key TEXT NOT NULL REFERENCES public.custom_product_categories(key) ON DELETE CASCADE,
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category_key, key)
);
CREATE INDEX IF NOT EXISTS idx_custom_product_subcategories_category ON public.custom_product_subcategories(category_key);
CREATE INDEX IF NOT EXISTS idx_custom_product_subcategories_sort ON public.custom_product_subcategories(category_key, sort_order);
ALTER TABLE public.custom_product_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_product_subcategories ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT '';

DROP POLICY IF EXISTS "Anyone can view active custom product subcategories" ON public.custom_product_subcategories;
CREATE POLICY "Anyone can view active custom product subcategories"
    ON public.custom_product_subcategories FOR SELECT USING (is_active = TRUE);
DROP POLICY IF EXISTS "Allow all for custom_product_subcategories" ON public.custom_product_subcategories;
CREATE POLICY "Allow all for custom_product_subcategories"
    ON public.custom_product_subcategories FOR ALL USING (true);

INSERT INTO public.custom_product_subcategories (category_key, key, name, sort_order) VALUES
('formal_wear', 'suit', '西裝', 10), ('formal_wear', 'shirt', '襯衫', 20), ('formal_wear', 'evening_gown', '晚禮服', 30), ('formal_wear', 'wedding', '婚紗', 40), ('formal_wear', 'cheongsam', '旗袍', 50), ('formal_wear', 'overcoat', '大衣', 60),
('sports_gear', 'basketball_football', '籃球/足球系列', 10), ('sports_gear', 'baseball', '棒球裝備', 20), ('sports_gear', 'golf', '高爾夫裝', 30), ('sports_gear', 'protective', '防摔衣', 40),
('craft_shoes_boots', 'oxford_derby', '牛津/德比鞋', 10), ('craft_shoes_boots', 'loafer', '樂福鞋', 20), ('craft_shoes_boots', 'boots', '手工皮靴', 30), ('craft_shoes_boots', 'heels', '高跟鞋', 40),
('street_sneakers', 'skate', '滑板鞋', 10), ('street_sneakers', 'dad_shoes', '老爹鞋', 20), ('street_sneakers', 'sport_sandals', '運動涼鞋', 30), ('street_sneakers', 'canvas', '帆布鞋', 40),
('luxury_bags', 'briefcase', '公事包', 10), ('luxury_bags', 'handbag', '手提包', 20), ('luxury_bags', 'backpack', '後背包', 30), ('luxury_bags', 'tote', '托特包', 40), ('luxury_bags', 'clutch', '晚宴包', 50),
('leather_accessories', 'wallet', '皮夾', 10), ('leather_accessories', 'belt', '皮帶', 20), ('leather_accessories', 'watch_strap', '錶帶', 30), ('leather_accessories', 'card_holder', '證件套', 40), ('leather_accessories', 'camera_strap', '相機帶', 50), ('leather_accessories', 'key_holder', '鑰匙包', 60),
('sofa_seating', 'l_sofa', 'L型沙發', 10), ('sofa_seating', 'armchair', '單人椅', 20), ('sofa_seating', 'recliner', '功能沙發', 30), ('sofa_seating', 'dining_chair', '餐椅', 40), ('sofa_seating', 'bench', '長凳', 50),
('system_furniture', 'dining_table', '餐桌', 10), ('system_furniture', 'desk', '書桌', 20), ('system_furniture', 'island', '中島', 30), ('system_furniture', 'storage', '收納櫃', 40), ('system_furniture', 'bed_frame', '床架', 50), ('system_furniture', 'screen', '屏風', 60),
('jewelry', 'ring', '戒指', 10), ('jewelry', 'necklace', '項鍊', 20), ('jewelry', 'earrings', '耳環', 30), ('jewelry', 'cufflinks', '袖扣', 40), ('jewelry', 'brooch', '胸針', 50), ('jewelry', 'bracelet', '手鍊', 60),
('watches_tech', 'mechanical_watch', '機械錶', 10), ('watches_tech', 'smart_watch_band', '智慧手錶帶', 20), ('watches_tech', 'phone_case', '手機殼', 30), ('watches_tech', 'laptop_bag', '筆電包', 40), ('watches_tech', 'keyboard', '鍵盤', 50),
('streetwear', 'hoodie', '帽T', 10), ('streetwear', 'cargo', '工裝褲', 20), ('streetwear', 'denim_jacket', '單寧夾克', 30), ('streetwear', 'yoga', '瑜珈服', 40), ('streetwear', 'flight_jacket', '飛行外套', 50),
('lifestyle_pet', 'umbrella', '傘具', 10), ('lifestyle_pet', 'eyewear', '眼鏡', 20), ('lifestyle_pet', 'pet_collar', '寵物項圈/胸背帶', 30), ('lifestyle_pet', 'fragrance', '香氛瓶', 40), ('lifestyle_pet', 'stationery', '文具', 50)
ON CONFLICT (category_key, key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- 3. 再製主分類
CREATE TABLE IF NOT EXISTS public.remake_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_remake_categories_key ON public.remake_categories(key);
CREATE INDEX IF NOT EXISTS idx_remake_categories_sort ON public.remake_categories(sort_order);
ALTER TABLE public.remake_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remake_categories ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT '';

DROP POLICY IF EXISTS "Anyone can view active remake categories" ON public.remake_categories;
CREATE POLICY "Anyone can view active remake categories"
    ON public.remake_categories FOR SELECT USING (is_active = TRUE);
DROP POLICY IF EXISTS "Allow all for remake_categories" ON public.remake_categories;
CREATE POLICY "Allow all for remake_categories"
    ON public.remake_categories FOR ALL USING (true);

INSERT INTO public.remake_categories (key, name, prompt, sort_order) VALUES
('formal_wear', '正裝與禮服', '舊衣改款：版型現代化（如寬鬆變修身）、領型更換、婚紗改時裝。', 10),
('sports_gear', '專業運動裝備', '跨界改裝：籃球鞋改棒球釘鞋、球衣改製成隨身包、護具強化。', 20),
('craft_shoes_boots', '工藝皮鞋與靴', '機能改裝：專業換底 (Vibram)、擦色 (Patina) 重製、加裝防水內裡。', 30),
('street_sneakers', '潮流球鞋與休閒', '潮流自定義：鞋面彩繪、異材質拼接（皮革混織物）、結構化支撐改裝。', 40),
('luxury_bags', '精品包袋', '精品再製：大包拆解改小包（LV/Gucci 改製）、包身結構加固、五金升級。', 50),
('leather_accessories', '時尚皮件配件', '材料重組：利用改裝剩下的餘料 AI 拼接設計、雷射雕刻客製化。', 60),
('sofa_seating', '居家沙發與坐具', '翻新再設計：舊沙發換皮/布、填充物彈性調整、椅腳風格改裝。', 70),
('system_furniture', '系統家具與桌台', '模組化改裝：桌面重新研磨、增加智慧充電模組、尺寸縮減/擴張。', 80),
('jewelry', '珠寶與高級飾品', '舊料新鑲：祖傳珠寶重新設計款式、金屬材質電鍍改色。', 90),
('watches_tech', '鐘錶與科技配件', '鐘錶改裝 (Mod)：更換面盤、指針、錶圈；手機殼加裝背帶結構。', 100),
('streetwear', '潮流與機能服飾', '風格加工：牛仔褲重洗色、破壞加工、機能口袋加裝、電繡圖騰。', 110),
('lifestyle_pet', '生活精品與寵物', '跨界設計：寵物用品與主人物件風格同步（AI 匹配材質與色系）。', 120)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, prompt = EXCLUDED.prompt, sort_order = EXCLUDED.sort_order;

-- 4. 再製子分類
CREATE TABLE IF NOT EXISTS public.remake_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_key TEXT NOT NULL REFERENCES public.remake_categories(key) ON DELETE CASCADE,
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category_key, key)
);
CREATE INDEX IF NOT EXISTS idx_remake_subcategories_category ON public.remake_subcategories(category_key);
CREATE INDEX IF NOT EXISTS idx_remake_subcategories_sort ON public.remake_subcategories(category_key, sort_order);
ALTER TABLE public.remake_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remake_subcategories ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT '';

DROP POLICY IF EXISTS "Anyone can view active remake subcategories" ON public.remake_subcategories;
CREATE POLICY "Anyone can view active remake subcategories"
    ON public.remake_subcategories FOR SELECT USING (is_active = TRUE);
DROP POLICY IF EXISTS "Allow all for remake_subcategories" ON public.remake_subcategories;
CREATE POLICY "Allow all for remake_subcategories"
    ON public.remake_subcategories FOR ALL USING (true);

INSERT INTO public.remake_subcategories (category_key, key, name, sort_order) VALUES
('formal_wear', 'suit', '西裝', 10), ('formal_wear', 'shirt', '襯衫', 20), ('formal_wear', 'evening_gown', '晚禮服', 30), ('formal_wear', 'wedding', '婚紗', 40), ('formal_wear', 'cheongsam', '旗袍', 50), ('formal_wear', 'overcoat', '大衣', 60),
('sports_gear', 'basketball_football', '籃球/足球系列', 10), ('sports_gear', 'baseball', '棒球裝備', 20), ('sports_gear', 'golf', '高爾夫裝', 30), ('sports_gear', 'protective', '防摔衣', 40),
('craft_shoes_boots', 'oxford_derby', '牛津/德比鞋', 10), ('craft_shoes_boots', 'loafer', '樂福鞋', 20), ('craft_shoes_boots', 'boots', '手工皮靴', 30), ('craft_shoes_boots', 'heels', '高跟鞋', 40),
('street_sneakers', 'skate', '滑板鞋', 10), ('street_sneakers', 'dad_shoes', '老爹鞋', 20), ('street_sneakers', 'sport_sandals', '運動涼鞋', 30), ('street_sneakers', 'canvas', '帆布鞋', 40),
('luxury_bags', 'briefcase', '公事包', 10), ('luxury_bags', 'handbag', '手提包', 20), ('luxury_bags', 'backpack', '後背包', 30), ('luxury_bags', 'tote', '托特包', 40), ('luxury_bags', 'clutch', '晚宴包', 50),
('leather_accessories', 'wallet', '皮夾', 10), ('leather_accessories', 'belt', '皮帶', 20), ('leather_accessories', 'watch_strap', '錶帶', 30), ('leather_accessories', 'card_holder', '證件套', 40), ('leather_accessories', 'camera_strap', '相機帶', 50), ('leather_accessories', 'key_holder', '鑰匙包', 60),
('sofa_seating', 'l_sofa', 'L型沙發', 10), ('sofa_seating', 'armchair', '單人椅', 20), ('sofa_seating', 'recliner', '功能沙發', 30), ('sofa_seating', 'dining_chair', '餐椅', 40), ('sofa_seating', 'bench', '長凳', 50),
('system_furniture', 'dining_table', '餐桌', 10), ('system_furniture', 'desk', '書桌', 20), ('system_furniture', 'island', '中島', 30), ('system_furniture', 'storage', '收納櫃', 40), ('system_furniture', 'bed_frame', '床架', 50), ('system_furniture', 'screen', '屏風', 60),
('jewelry', 'ring', '戒指', 10), ('jewelry', 'necklace', '項鍊', 20), ('jewelry', 'earrings', '耳環', 30), ('jewelry', 'cufflinks', '袖扣', 40), ('jewelry', 'brooch', '胸針', 50), ('jewelry', 'bracelet', '手鍊', 60),
('watches_tech', 'mechanical_watch', '機械錶', 10), ('watches_tech', 'smart_watch_band', '智慧手錶帶', 20), ('watches_tech', 'phone_case', '手機殼', 30), ('watches_tech', 'laptop_bag', '筆電包', 40), ('watches_tech', 'keyboard', '鍵盤', 50),
('streetwear', 'hoodie', '帽T', 10), ('streetwear', 'cargo', '工裝褲', 20), ('streetwear', 'denim_jacket', '單寧夾克', 30), ('streetwear', 'yoga', '瑜珈服', 40), ('streetwear', 'flight_jacket', '飛行外套', 50),
('lifestyle_pet', 'umbrella', '傘具', 10), ('lifestyle_pet', 'eyewear', '眼鏡', 20), ('lifestyle_pet', 'pet_collar', '寵物項圈/胸背帶', 30), ('lifestyle_pet', 'fragrance', '香氛瓶', 40), ('lifestyle_pet', 'stationery', '文具', 50)
ON CONFLICT (category_key, key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;
