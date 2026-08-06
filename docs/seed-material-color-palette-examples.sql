-- 材料組合「配色範例」官方種子資料：風格類型字典＋雙色／三色配色（含英文欄位）
-- 依「尼龍布寵物用品色卡」快速配色參考表整理；並將原表混在一起的「大師/設計靈感」拆為
-- 「藝術家」與「設計師/流派」兩類，且為每個風格類型至少補到 6 組雙色＋5 組三色
-- （原表偏少的：基礎百搭、運動撞色、低調質感、安全反光、清爽甜美、設計師/流派、莫蘭迪風、
--  馬卡龍風、北歐設計風、精品風、藝術家、品牌 皆有新增；雙色共 77 組、三色共 84 組）。
--
-- 執行順序（Supabase SQL Editor 或後台「資料庫維護」）：
--   1. docs/add-material-color-palettes.sql（若尚未建表）
--   2. docs/add-material-color-palette-ratios.sql
--   3. docs/add-material-color-palette-notes.sql
--   4. docs/add-material-color-palette-i18n.sql
--   5. 本檔（可重複執行；type 依 name 去重，配色依 type_id+name+color_count 去重）
--
-- 圖片素材來源色號僅為近似對照參考（大師畫作／品牌識別色不代表官方 Pantone 授權色號），
-- 圖樣與商標請勿直接複製，僅供選色靈感。

-- =========================================================
-- 1) 風格類型字典（13 類；含英文名稱）
-- =========================================================
INSERT INTO public.material_color_palette_types (name, name_en, sort_order, is_active)
SELECT v.name, v.name_en, v.sort_order, true
FROM (VALUES
    ('基礎百搭', 'Basic & Versatile', 10),
    ('大地戶外', 'Earthy & Outdoor', 20),
    ('安全反光', 'Safety & Hi-Vis', 30),
    ('運動撞色', 'Sporty Color-Block', 40),
    ('清爽甜美', 'Fresh & Sweet', 50),
    ('低調質感', 'Understated & Refined', 60),
    ('莫蘭迪風', 'Morandi', 70),
    ('馬卡龍風', 'Macaron', 80),
    ('北歐設計風', 'Nordic Design', 90),
    ('精品風', 'Luxury', 100),
    ('藝術家', 'Artist-Inspired', 110),
    ('設計師/流派', 'Designer & Movement', 120),
    ('品牌', 'Brand-Inspired', 130)
) AS v(name, name_en, sort_order)
WHERE NOT EXISTS (
    SELECT 1 FROM public.material_color_palette_types t WHERE t.name = v.name
);

-- =========================================================
-- 2) 雙色搭配（color_count = 2）
-- =========================================================
WITH new_dual (type_name, name, name_en, primary_hex, accent_hex, ratio_preset, ratio_percents, note, note_en, sort_order) AS (
    VALUES
    ('基礎百搭', '黑 + 灰', 'Black + Grey', '#1A1A1A', '#8A8D8F', 'dual_75_25', '[75,25]'::jsonb, '低調百搭，中性款式', 'Understated and versatile, a neutral staple', 10),
    ('基礎百搭', '丈青 + 淺灰', 'Navy + Light Grey', '#1F2A44', '#C4C6C8', 'dual_75_25', '[75,25]'::jsonb, '沉穩商務感', 'An understated, business-ready feel', 20),
    ('基礎百搭', '黑 + 白', 'Black + White', '#1A1A1A', '#F5F5F0', 'dual_50_50', '[50,50]'::jsonb, '經典基礎對比，百搭首選', 'Classic basic contrast, the most versatile pick', 30),
    ('基礎百搭', '灰 + 白', 'Grey + White', '#8A8D8F', '#F5F5F0', 'dual_75_25', '[75,25]'::jsonb, '淺色系基礎百搭', 'A light, basic everyday pairing', 40),
    ('基礎百搭', '丈青 + 白', 'Navy + White', '#1F2A44', '#F5F5F0', 'dual_75_25', '[75,25]'::jsonb, '深藍白對比，簡潔耐看', 'Navy-white contrast, clean and timeless', 50),
    ('基礎百搭', '黑 + 淺灰', 'Black + Light Grey', '#1A1A1A', '#C4C6C8', 'dual_75_25', '[75,25]'::jsonb, '黑灰經典層次', 'A classic black-grey layered look', 60),

    ('大地戶外', '軍綠 + 卡其', 'Olive Green + Khaki', '#4B5320', '#C3A473', 'dual_75_25', '[75,25]'::jsonb, '戶外/軍規風經典搭配', 'A classic outdoor / tactical-style pairing', 10),
    ('大地戶外', '咖啡 + 卡其', 'Coffee Brown + Khaki', '#5B4636', '#C3A473', 'dual_75_25', '[75,25]'::jsonb, '皮革感戶外風', 'A leather-look outdoor style', 20),
    ('大地戶外', '酒紅 + 卡其', 'Burgundy + Khaki', '#7B1E2B', '#C3A473', 'dual_75_25', '[75,25]'::jsonb, '復古/大地色系', 'A vintage, earth-tone pairing', 30),
    ('大地戶外', '軍綠 + 咖啡', 'Olive Green + Coffee Brown', '#4B5320', '#5B4636', 'dual_75_25', '[75,25]'::jsonb, '深沉大地感，戶外機能款常見', 'A deep earthy feel, common on outdoor functional gear', 40),
    ('大地戶外', '卡其 + 黑', 'Khaki + Black', '#C3A473', '#1A1A1A', 'dual_75_25', '[75,25]'::jsonb, '卡其配深黑，戶外機能感加深', 'Khaki with deep black, deepening the outdoor-functional feel', 50),
    ('大地戶外', '酒紅 + 咖啡', 'Burgundy + Coffee Brown', '#7B1E2B', '#5B4636', 'dual_75_25', '[75,25]'::jsonb, '深沉復古大地色', 'A deep, vintage earth-tone pairing', 60),

    ('安全反光', '黑 + 橘', 'Black + Orange', '#1A1A1A', '#E8712B', 'dual_75_25', '[75,25]'::jsonb, '高對比，安全性/機能風常用組合', 'High contrast, a common safety / functional-style combo', 10),
    ('安全反光', '黑 + 螢光黃', 'Black + Neon Yellow', '#1A1A1A', '#D8E82E', 'dual_75_25', '[75,25]'::jsonb, '夜間反光/安全訴求', 'For night-time reflectivity and safety needs', 20),
    ('安全反光', '大紅 + 黑', 'Red + Black', '#C8102E', '#1A1A1A', 'dual_75_25', '[75,25]'::jsonb, '經典對比，能見度高', 'A classic high-visibility contrast', 30),
    ('安全反光', '灰 + 螢光黃', 'Grey + Neon Yellow', '#8A8D8F', '#D8E82E', 'dual_75_25', '[75,25]'::jsonb, '中性灰搭配高辨識螢光，兼顧沉穩與安全', 'Neutral grey paired with hi-vis neon, balancing subtlety and safety', 40),
    ('安全反光', '丈青 + 螢光黃', 'Navy + Neon Yellow', '#1F2A44', '#D8E82E', 'dual_75_25', '[75,25]'::jsonb, '深藍主體，螢光黃提升夜間辨識', 'Navy body with neon yellow boosting night visibility', 50),
    ('安全反光', '橘 + 螢光黃', 'Orange + Neon Yellow', '#E8712B', '#D8E82E', 'dual_50_50', '[50,50]'::jsonb, '雙重高辨識色，安全/機能款常見', 'Dual hi-vis colors, common on safety / functional styles', 60),

    ('運動撞色', '灰 + 橘', 'Grey + Orange', '#8A8D8F', '#E8712B', 'dual_75_25', '[75,25]'::jsonb, '運動機能風撞色', 'A sporty, functional color-block', 10),
    ('運動撞色', '寶藍 + 黑', 'Royal Blue + Black', '#1E4D8C', '#1A1A1A', 'dual_75_25', '[75,25]'::jsonb, '動感對比，男性向常見', 'A dynamic contrast, common in menswear-leaning styles', 20),
    ('運動撞色', '白 + 寶藍', 'White + Royal Blue', '#F5F5F0', '#1E4D8C', 'dual_75_25', '[75,25]'::jsonb, '清爽運動對比', 'A fresh, sporty contrast', 30),
    ('運動撞色', '黑 + 螢光黃綠', 'Black + Volt', '#1A1A1A', '#D8FF00', 'dual_75_25', '[75,25]'::jsonb, '科技感撞色，機能運動款常見', 'A tech-inspired color-block, common on performance sportswear', 40),
    ('運動撞色', '灰 + 寶藍', 'Grey + Royal Blue', '#8A8D8F', '#1E4D8C', 'dual_75_25', '[75,25]'::jsonb, '中性灰配活力藍', 'Neutral grey with an energetic blue', 50),
    ('運動撞色', '白 + 橘', 'White + Orange', '#F5F5F0', '#E8712B', 'dual_75_25', '[75,25]'::jsonb, '清爽對比，戶外運動款常見', 'A fresh contrast, common on outdoor sport styles', 60),

    ('清爽甜美', '粉紅 + 白', 'Pink + White', '#E8A0BF', '#F5F5F0', 'dual_75_25', '[75,25]'::jsonb, '可愛風，幼犬/女性向', 'A cute style, popular for puppy / feminine-leaning items', 10),
    ('清爽甜美', '天空藍 + 白', 'Sky Blue + White', '#7FB2DA', '#F5F5F0', 'dual_75_25', '[75,25]'::jsonb, '清爽夏季款', 'A fresh, summery style', 20),
    ('清爽甜美', '寶藍 + 白', 'Royal Blue + White', '#1E4D8C', '#F5F5F0', 'dual_75_25', '[75,25]'::jsonb, '活潑對比', 'A lively contrast', 30),
    ('清爽甜美', '粉紅 + 天空藍', 'Pink + Sky Blue', '#E8A0BF', '#7FB2DA', 'dual_75_25', '[75,25]'::jsonb, '柔和雙色，幼犬款常見', 'A soft duo-tone, common for puppy items', 40),
    ('清爽甜美', '白 + 馬卡龍薰衣草紫', 'White + Macaron Lavender', '#F5F5F0', '#D8BFD8', 'dual_75_25', '[75,25]'::jsonb, '清爽夢幻感', 'A fresh, dreamy feel', 50),
    ('清爽甜美', '粉紅 + 馬卡龍薄荷綠', 'Pink + Macaron Mint', '#E8A0BF', '#B4E7CE', 'dual_75_25', '[75,25]'::jsonb, '甜美中帶清新綠意', 'Sweet with a touch of fresh green', 60),

    ('低調質感', '紫 + 灰', 'Purple + Grey', '#5B3A76', '#8A8D8F', 'dual_75_25', '[75,25]'::jsonb, '低飽和度時尚感', 'A low-saturation, fashion-forward feel', 10),
    ('低調質感', '珍珠灰 + 丈青', 'Pearl Grey + Navy', '#B8B0A8', '#1F2A44', 'dual_75_25', '[75,25]'::jsonb, '低調有質感，耐看不俗', 'Understated and refined, timeless without being plain', 20),
    ('低調質感', '莫蘭迪駝色 + 黑', 'Morandi Camel + Black', '#B5A99A', '#1A1A1A', 'dual_75_25', '[75,25]'::jsonb, '裸色配深黑，簡約高級感', 'A nude tone with deep black for minimalist elegance', 30),
    ('低調質感', '莫蘭迪灰紫 + 黑', 'Morandi Dusty Purple + Black', '#A79BA6', '#1A1A1A', 'dual_75_25', '[75,25]'::jsonb, '低調高級，紫調更顯個性', 'Understated and refined, the purple hue adds character', 40),
    ('低調質感', '酒紅 + 灰', 'Burgundy + Grey', '#7B1E2B', '#8A8D8F', 'dual_75_25', '[75,25]'::jsonb, '沉穩色調，耐看不張揚', 'Composed tones, understated yet appealing', 50),
    ('低調質感', '丈青 + 莫蘭迪駝色', 'Navy + Morandi Camel', '#1F2A44', '#B5A99A', 'dual_75_25', '[75,25]'::jsonb, '深藍配裸色，質感對比', 'Navy paired with a nude tone for refined contrast', 60),

    ('莫蘭迪風', '莫蘭迪灰藍 + 莫蘭迪駝色', 'Morandi Dusty Blue + Morandi Camel', '#8B9DA6', '#B5A99A', 'dual_75_25', '[75,25]'::jsonb, '高質感低飽和裸色系，質感款熱門搭配', 'A refined, low-saturation nude pairing, popular for premium lines', 10),
    ('莫蘭迪風', '莫蘭迪鼠尾草綠 + 莫蘭迪霧粉', 'Morandi Sage Green + Morandi Dusty Pink', '#9CAF88', '#C9A9A6', 'dual_75_25', '[75,25]'::jsonb, '柔和文青風，女性向質感款', 'A soft, indie-art feel, refined and feminine-leaning', 20),
    ('莫蘭迪風', '莫蘭迪灰紫 + 淺灰', 'Morandi Dusty Purple + Light Grey', '#A79BA6', '#C4C6C8', 'dual_75_25', '[75,25]'::jsonb, '低調高級感', 'A subtle sense of refinement', 30),
    ('莫蘭迪風', '莫蘭迪霧粉 + 莫蘭迪灰藍', 'Morandi Dusty Pink + Morandi Dusty Blue', '#C9A9A6', '#8B9DA6', 'dual_75_25', '[75,25]'::jsonb, '粉藍對比，溫柔又不失個性', 'A pink-blue contrast, gentle yet distinctive', 40),

    ('馬卡龍風', '馬卡龍粉 + 馬卡龍薄荷綠', 'Macaron Pink + Macaron Mint', '#FADADD', '#B4E7CE', 'dual_75_25', '[75,25]'::jsonb, '甜美減齡，幼犬/貓用品常見', 'Sweet and youthful, common for puppy / kitten items', 10),
    ('馬卡龍風', '馬卡龍鵝黃 + 馬卡龍天空藍', 'Macaron Yellow + Macaron Sky Blue', '#FFF3B0', '#AEE2FF', 'dual_75_25', '[75,25]'::jsonb, '活潑清新配色', 'A lively, fresh color pairing', 20),
    ('馬卡龍風', '馬卡龍薰衣草紫 + 白', 'Macaron Lavender + White', '#D8BFD8', '#F5F5F0', 'dual_75_25', '[75,25]'::jsonb, '夢幻療癒風', 'A dreamy, soothing style', 30),
    ('馬卡龍風', '馬卡龍蜜桃橘 + 馬卡龍薄荷綠', 'Macaron Peach + Macaron Mint', '#FFD6A5', '#B4E7CE', 'dual_75_25', '[75,25]'::jsonb, '繽紛撞色，年輕族群喜愛', 'A colorful color-block, popular with younger audiences', 40),
    ('馬卡龍風', '馬卡龍薄荷綠 + 馬卡龍鵝黃', 'Macaron Mint + Macaron Yellow', '#B4E7CE', '#FFF3B0', 'dual_75_25', '[75,25]'::jsonb, '清新活潑，童趣感', 'Fresh and playful, with a whimsical touch', 50),

    ('北歐設計風', '燕麥白 + 霧霾藍', 'Oat White + Dusty Blue', '#F0E6D8', '#7B96A8', 'dual_75_25', '[75,25]'::jsonb, '北歐居家風經典基底搭配', 'A classic base pairing for Nordic homeware style', 10),
    ('北歐設計風', '森林綠 + 燕麥灰褐', 'Forest Green + Oat Taupe', '#4F6F52', '#A89684', 'dual_75_25', '[75,25]'::jsonb, '自然感，質樸簡約', 'A natural, rustic and minimalist feel', 20),
    ('北歐設計風', '陶土橘 + 燕麥白', 'Terracotta + Oat White', '#C97B4A', '#F0E6D8', 'dual_75_25', '[75,25]'::jsonb, '溫暖北歐風點綴', 'A warm Nordic-style accent', 30),
    ('北歐設計風', '芥末黃 + 灰', 'Mustard Yellow + Grey', '#D4A017', '#8A8D8F', 'dual_75_25', '[75,25]'::jsonb, '低彩度活潑感，北歐風常見', 'A low-saturation liveliness, common in Nordic style', 40),

    ('精品風', '曜石黑 + 香檳金', 'Obsidian Black + Champagne Gold', '#0D0D0D', '#D4B98C', 'dual_50_50', '[50,50]'::jsonb, '經典精品配色，質感強烈', 'A classic luxury pairing with strong presence', 10),
    ('精品風', '墨綠 + 香檳金', 'Deep Emerald + Champagne Gold', '#1B4332', '#D4B98C', 'dual_75_25', '[75,25]'::jsonb, '低調奢華，適合質感款式', 'Understated luxury, suited to refined pieces', 20),
    ('精品風', '勃根地酒紅 + 焦糖棕', 'Burgundy + Caramel Brown', '#5C1A24', '#8B5A2B', 'dual_75_25', '[75,25]'::jsonb, '沉穩皮革感精品風', 'A composed, leather-look luxury style', 30),
    ('精品風', '珍珠灰 + 香檳金', 'Pearl Grey + Champagne Gold', '#B8B0A8', '#D4B98C', 'dual_75_25', '[75,25]'::jsonb, '細膩低調，襯托金屬五金', 'Subtle and refined, complementing metal hardware', 40),

    ('藝術家', '蒙德里安：紅 + 藍', 'Mondrian: Red + Blue', '#D7263D', '#005CAB', 'dual_50_50', '[50,50]'::jsonb, '幾何撞色，經典原色對比', 'A geometric color-block, a classic primary-color contrast', 10),
    ('藝術家', '蒙德里安：藍 + 黃', 'Mondrian: Blue + Yellow', '#005CAB', '#FFD400', 'dual_50_50', '[50,50]'::jsonb, '明快幾何感，年輕活潑', 'A crisp geometric feel, youthful and lively', 20),
    ('藝術家', '梵谷：向日葵黃 + 星夜藍', 'Van Gogh: Sunflower Yellow + Starry Night Blue', '#FFC300', '#1B3A5C', 'dual_75_25', '[75,25]'::jsonb, '溫暖與深邃對比，畫作感濃厚', 'A warm-versus-deep contrast, richly painterly', 30),
    ('藝術家', '馬諦斯：剪紙藍 + 珊瑚紅', 'Matisse: Cut-out Blue + Coral Red', '#1F4E79', '#E2725B', 'dual_75_25', '[75,25]'::jsonb, '大膽拼貼色塊感', 'A bold, collage-style color-block', 40),
    ('藝術家', '北齋：北齋藍 + 浪花白', 'Hokusai: Hokusai Blue + Wave White', '#14213D', '#F2F2EC', 'dual_75_25', '[75,25]'::jsonb, '日式浮世繪深藍留白美感', 'The deep blue and negative-space beauty of Japanese ukiyo-e', 50),
    ('藝術家', '克林姆：金 + 深綠', 'Klimt: Gold + Deep Green', '#B8860B', '#1B4332', 'dual_75_25', '[75,25]'::jsonb, '華麗鑲嵌感，藝術裝飾風', 'An ornate, mosaic-like feel, art-nouveau opulence', 60),
    ('藝術家', '畢卡索：藍色時期 藍 + 黑', 'Picasso: Blue Period Blue + Black', '#1B3A5C', '#1A1A1A', 'dual_75_25', '[75,25]'::jsonb, '憂鬱深邃的藍色時期意象', 'Evoking the melancholic depth of the Blue Period', 70),

    ('設計師/流派', '柯比意：赭黃 + 灰藍', 'Le Corbusier: Ochre Yellow + Grey Blue', '#C9A227', '#6E8894', 'dual_75_25', '[75,25]'::jsonb, '現代主義建築感，沉穩耐看', 'A modernist architectural feel, composed and timeless', 10),
    ('設計師/流派', '柯比意：灰藍 + 磚紅', 'Le Corbusier: Grey Blue + Brick Red', '#6E8894', '#B5533C', 'dual_75_25', '[75,25]'::jsonb, '建築色卡經典搭配', 'A classic pairing from the architectural color chart', 20),
    ('設計師/流派', '包浩斯：紅 + 黃', 'Bauhaus: Red + Yellow', '#D7263D', '#FFD400', 'dual_50_50', '[50,50]'::jsonb, '強調功能與幾何純粹感', 'Emphasizing function and pure geometric form', 30),
    ('設計師/流派', '曼菲斯：螢光粉 + 薄荷綠', 'Memphis: Neon Pink + Mint Green', '#FF3EA5', '#6FFFB0', 'dual_75_25', '[75,25]'::jsonb, '80年代後現代大膽撞色', 'A bold 1980s postmodern color-block', 40),
    ('設計師/流派', '曼菲斯：黑 + 螢光粉', 'Memphis: Black + Neon Pink', '#1A1A1A', '#FF3EA5', 'dual_75_25', '[75,25]'::jsonb, '黑底襯托螢光色，後現代感強烈', 'A black base sets off the neon accent, strongly postmodern', 50),
    ('設計師/流派', '柯比意：磚紅 + 赭黃', 'Le Corbusier: Brick Red + Ochre Yellow', '#B5533C', '#C9A227', 'dual_75_25', '[75,25]'::jsonb, '建築色卡暖色對比', 'A warm-toned contrast from the architectural palette', 60),

    ('品牌', '愛馬仕：橘 + 巧克力棕', 'Hermès: Orange + Chocolate Brown', '#F26B21', '#5B4636', 'dual_75_25', '[75,25]'::jsonb, '精品感濃厚，經典禮盒配色', 'Richly luxurious, a classic gift-box color pairing', 10),
    ('品牌', 'Tiffany：Tiffany藍 + 白', 'Tiffany: Tiffany Blue + White', '#81D8D0', '#F5F5F0', 'dual_50_50', '[50,50]'::jsonb, '清新高級，品牌識別度高', 'Fresh and upscale, with strong brand recognition', 20),
    ('品牌', 'Burberry：駝色 + 黑', 'Burberry: Camel + Black', '#C19A6B', '#1A1A1A', 'dual_75_25', '[75,25]'::jsonb, '英倫經典，耐看百搭', 'A classic British look, timeless and versatile', 30),
    ('品牌', 'LV：棕褐 + 金', 'LV: Tan Brown + Gold', '#5C3A21', '#C9A66B', 'dual_75_25', '[75,25]'::jsonb, '精品感濃厚', 'A richly luxurious feel', 40),
    ('品牌', 'Bottega Veneta：鸚鵡綠 + 白', 'Bottega Veneta: Parakeet Green + White', '#3EB489', '#F5F5F0', 'dual_75_25', '[75,25]'::jsonb, '話題性強，鮮明識別', 'Highly talked-about, with a vivid brand identity', 50),
    ('品牌', 'Patagonia：苔蘚綠 + 石頭米', 'Patagonia: Moss Green + Stone Beige', '#6B8E5A', '#C2B280', 'dual_75_25', '[75,25]'::jsonb, '環保機能大地色調', 'An eco-conscious, functional earth-tone palette', 60),
    ('品牌', 'The North Face：紅 + 黑', 'The North Face: Red + Black', '#C8102E', '#1A1A1A', 'dual_75_25', '[75,25]'::jsonb, '戶外機能經典撞色', 'A classic outdoor-functional color-block', 70),
    ('品牌', 'Nike：螢光黃綠 + 黑', 'Nike: Volt + Black', '#D8FF00', '#1A1A1A', 'dual_75_25', '[75,25]'::jsonb, '科技運動感十足', 'Full of techy, athletic energy', 80),
    ('品牌', 'Apple：太空灰 + 銀色', 'Apple: Space Grey + Silver', '#6E6E73', '#C7C8CA', 'dual_75_25', '[75,25]'::jsonb, '科技極簡感，金屬質感搭配', 'A minimalist tech feel, paired with a metallic finish', 90),
    ('品牌', 'MUJI 無印良品：生成米白 + 淺灰', 'MUJI: Unbleached Beige + Light Grey', '#E9DCC5', '#C7C6C1', 'dual_75_25', '[75,25]'::jsonb, '無印經典自然低彩度風格', 'MUJI''s classic natural, low-saturation style', 100),
    ('品牌', 'IKEA：IKEA藍 + IKEA黃', 'IKEA: IKEA Blue + IKEA Yellow', '#0051BA', '#FFDA1A', 'dual_50_50', '[50,50]'::jsonb, '高辨識度北歐品牌撞色', 'A highly recognizable Nordic-brand color-block', 110)
)
INSERT INTO public.material_color_palettes (
    owner_scope, owner_user_id, type_id, type_text, name, name_en, note, note_en,
    color_count, primary_hex, accent_hex, tertiary_hex, ratio_preset, ratio_percents, sort_order, is_active, updated_at
)
SELECT 'platform', NULL, t.id, NULL, nd.name, nd.name_en, nd.note, nd.note_en,
    2, nd.primary_hex, nd.accent_hex, NULL, nd.ratio_preset, nd.ratio_percents, nd.sort_order, true, now()
FROM new_dual nd
JOIN public.material_color_palette_types t ON t.name = nd.type_name
WHERE NOT EXISTS (
    SELECT 1 FROM public.material_color_palettes p
    WHERE p.owner_scope = 'platform' AND p.type_id = t.id AND p.name = nd.name AND p.color_count = 2
);

-- =========================================================
-- 3) 三色搭配（color_count = 3）
-- =========================================================
WITH new_tri (type_name, name, name_en, primary_hex, pct1, accent_hex, pct2, tertiary_hex, pct3, note, note_en, sort_order) AS (
    VALUES
    ('基礎百搭', '黑 + 灰 + 白', 'Black + Grey + White', '#1A1A1A', 60, '#8A8D8F', 30, '#F5F5F0', 10, '主體黑、車縫/內裡灰、白色點綴（如標籤、繩頭）', 'Black as the main body, grey for stitching/lining, white as an accent (e.g. labels, cord ends)', 10),
    ('基礎百搭', '丈青 + 淺灰 + 白', 'Navy + Light Grey + White', '#1F2A44', 60, '#C4C6C8', 30, '#F5F5F0', 10, '沉穩百搭，商務款常見比例', 'An understated, versatile ratio common in business-style pieces', 20),
    ('基礎百搭', '白 + 黑 + 灰', 'White + Black + Grey', '#F5F5F0', 50, '#1A1A1A', 35, '#8A8D8F', 15, '反轉基礎配色，白色主體更顯清爽', 'An inverted basic palette, white-dominant for a fresher look', 30),

    ('大地戶外', '軍綠 + 卡其 + 咖啡', 'Olive Green + Khaki + Coffee Brown', '#4B5320', 50, '#C3A473', 35, '#5B4636', 15, '主體軍綠、卡其做內裡或滾邊、咖啡色五金/皮片點綴', 'Olive green as the main body, khaki for lining/piping, coffee brown accenting hardware or leather trim', 10),
    ('大地戶外', '卡其 + 咖啡 + 橘', 'Khaki + Coffee Brown + Orange', '#C3A473', 55, '#5B4636', 30, '#E8712B', 15, '戶外機能款，橘色做拉鍊/縫線點綴增加辨識度', 'An outdoor-functional style, orange accents zippers/stitching for extra visibility', 20),
    ('大地戶外', '咖啡 + 軍綠 + 卡其', 'Coffee Brown + Olive Green + Khaki', '#5B4636', 50, '#4B5320', 30, '#C3A473', 20, '深咖啡為主體，軍綠/卡其做搭配層次', 'Deep coffee brown as the main body, with olive and khaki adding layered depth', 30),

    ('安全反光', '黑 + 橘 + 螢光黃', 'Black + Orange + Neon Yellow', '#1A1A1A', 60, '#E8712B', 25, '#D8E82E', 15, '主體黑，橘色做防水拉鍊條，螢光黃做反光條/織帶', 'Black as the main body, orange for waterproof zipper tape, neon yellow for reflective strips/webbing', 10),
    ('安全反光', '灰 + 黑 + 螢光黃', 'Grey + Black + Neon Yellow', '#8A8D8F', 50, '#1A1A1A', 30, '#D8E82E', 20, '中性灰為主體，螢光黃提升夜間辨識', 'Neutral grey as the main body, with neon yellow boosting night-time visibility', 20),
    ('安全反光', '大紅 + 黑 + 白', 'Red + Black + White', '#C8102E', 50, '#1A1A1A', 35, '#F5F5F0', 15, '高辨識三色組合，安全性與時尚兼具', 'A highly visible trio balancing safety and style', 30),

    ('運動撞色', '灰 + 黑 + 寶藍', 'Grey + Black + Royal Blue', '#8A8D8F', 55, '#1A1A1A', 30, '#1E4D8C', 15, '運動機能感，寶藍做撞色縫線或側邊條紋', 'A sporty, functional feel, royal blue accents contrast stitching or side stripes', 10),
    ('運動撞色', '黑 + 白 + 大紅', 'Black + White + Red', '#1A1A1A', 55, '#F5F5F0', 30, '#C8102E', 15, '經典運動撞色，紅色作Logo/織帶點綴', 'A classic sporty color-block, red accents the logo/webbing', 20),
    ('運動撞色', '白 + 寶藍 + 螢光黃綠', 'White + Royal Blue + Volt', '#F5F5F0', 50, '#1E4D8C', 30, '#D8FF00', 20, '科技運動感三色撞色', 'A techy, sporty tri-color block', 30),

    ('清爽甜美', '粉紅 + 白 + 天空藍', 'Pink + White + Sky Blue', '#E8A0BF', 50, '#F5F5F0', 35, '#7FB2DA', 15, '幼犬/女性向款，天空藍做撞色滾邊', 'A puppy / feminine-leaning style, sky blue accents contrast piping', 10),
    ('清爽甜美', '白 + 粉紅 + 馬卡龍薄荷綠', 'White + Pink + Macaron Mint', '#F5F5F0', 45, '#E8A0BF', 35, '#B4E7CE', 20, '甜美中帶清新綠意', 'Sweet, with a touch of fresh green', 20),
    ('清爽甜美', '粉紅 + 天空藍 + 馬卡龍鵝黃', 'Pink + Sky Blue + Macaron Yellow', '#E8A0BF', 40, '#7FB2DA', 35, '#FFF3B0', 25, '柔和三色，幼犬/女性向款式常見', 'A soft trio, common for puppy / feminine-leaning styles', 30),

    ('低調質感', '珍珠灰 + 丈青 + 黑', 'Pearl Grey + Navy + Black', '#B8B0A8', 50, '#1F2A44', 30, '#1A1A1A', 20, '低調沉穩三色，商務質感款', 'An understated, composed trio with a business-grade finish', 10),
    ('低調質感', '灰 + 紫 + 黑', 'Grey + Purple + Black', '#8A8D8F', 55, '#5B3A76', 30, '#1A1A1A', 15, '低飽和時尚感，紫色點綴增添個性', 'A low-saturation, fashion-forward look, purple accents add character', 20),
    ('低調質感', '莫蘭迪駝色 + 珍珠灰 + 黑', 'Morandi Camel + Pearl Grey + Black', '#B5A99A', 50, '#B8B0A8', 30, '#1A1A1A', 20, '裸色系質感三色', 'A nude-toned, refined-texture trio', 30),

    ('莫蘭迪風', '莫蘭迪灰藍 + 莫蘭迪駝色 + 莫蘭迪霧粉', 'Morandi Dusty Blue + Morandi Camel + Morandi Dusty Pink', '#8B9DA6', 45, '#B5A99A', 35, '#C9A9A6', 20, '質感低飽和三色，主色可依款式互換', 'A refined, low-saturation trio, the main color can be swapped per style', 10),
    ('莫蘭迪風', '莫蘭迪鼠尾草綠 + 莫蘭迪霧粉 + 淺灰', 'Morandi Sage Green + Morandi Dusty Pink + Light Grey', '#9CAF88', 50, '#C9A9A6', 30, '#C4C6C8', 20, '柔和文青風，淺灰中和降低甜度', 'A soft, indie-art feel, light grey tones down the sweetness', 20),
    ('莫蘭迪風', '莫蘭迪灰紫 + 莫蘭迪駝色 + 淺灰', 'Morandi Dusty Purple + Morandi Camel + Light Grey', '#A79BA6', 45, '#B5A99A', 35, '#C4C6C8', 20, '低調高級感三色，質感款熱門', 'An understated, luxe trio, popular for premium lines', 30),

    ('馬卡龍風', '馬卡龍粉 + 馬卡龍薄荷綠 + 馬卡龍鵝黃', 'Macaron Pink + Macaron Mint + Macaron Yellow', '#FADADD', 40, '#B4E7CE', 35, '#FFF3B0', 25, '三色接近等比例，繽紛甜美', 'A near-equal tri-color ratio, colorful and sweet', 10),
    ('馬卡龍風', '馬卡龍天空藍 + 馬卡龍薰衣草紫 + 白', 'Macaron Sky Blue + Macaron Lavender + White', '#AEE2FF', 45, '#D8BFD8', 35, '#F5F5F0', 20, '白色中和讓馬卡龍色更清爽', 'White balances the palette, keeping the macaron tones fresh', 20),
    ('馬卡龍風', '馬卡龍蜜桃橘 + 馬卡龍薄荷綠 + 馬卡龍鵝黃', 'Macaron Peach + Macaron Mint + Macaron Yellow', '#FFD6A5', 40, '#B4E7CE', 35, '#FFF3B0', 25, '繽紛活潑三色', 'A vibrant, playful trio', 30),

    ('北歐設計風', '燕麥白 + 霧霾藍 + 森林綠', 'Oat White + Dusty Blue + Forest Green', '#F0E6D8', 50, '#7B96A8', 35, '#4F6F52', 15, '北歐居家風經典比例，森林綠作點綴', 'A classic Nordic-homeware ratio, forest green as an accent', 10),
    ('北歐設計風', '燕麥灰褐 + 陶土橘 + 芥末黃', 'Oat Taupe + Terracotta + Mustard Yellow', '#A89684', 50, '#C97B4A', 30, '#D4A017', 20, '溫暖自然感，適合秋冬款式', 'A warm, natural feel, suited to autumn/winter styles', 20),
    ('北歐設計風', '燕麥白 + 森林綠 + 陶土橘', 'Oat White + Forest Green + Terracotta', '#F0E6D8', 50, '#4F6F52', 30, '#C97B4A', 20, '自然溫潤三色，北歐居家風', 'A natural, warm trio with a Nordic-homeware feel', 30),

    ('精品風', '曜石黑 + 墨綠 + 香檳金', 'Obsidian Black + Deep Emerald + Champagne Gold', '#0D0D0D', 55, '#1B4332', 30, '#D4B98C', 15, '低調奢華，金色建議做五金件而非布料大面積', 'Understated luxury, gold works best on hardware rather than large fabric areas', 10),
    ('精品風', '勃根地酒紅 + 焦糖棕 + 香檳金', 'Burgundy + Caramel Brown + Champagne Gold', '#5C1A24', 50, '#8B5A2B', 35, '#D4B98C', 15, '沉穩皮革感精品風', 'A composed, leather-look luxury style', 20),
    ('精品風', '珍珠灰 + 曜石黑 + 香檳金', 'Pearl Grey + Obsidian Black + Champagne Gold', '#B8B0A8', 50, '#0D0D0D', 30, '#D4B98C', 20, '低調奢華三色，金屬五金襯托', 'An understated luxe trio, complemented by metal hardware', 30),

    ('藝術家', '蒙德里安三原色：紅 + 藍 + 黃', 'Mondrian Primary Triad: Red + Blue + Yellow', '#D7263D', 40, '#005CAB', 35, '#FFD400', 25, '幾何撞色設計，通常再搭配黑色線條分隔', 'A geometric color-block design, typically paired with black dividing lines', 10),
    ('藝術家', '梵谷：向日葵黃 + 星夜藍 + 橄欖綠', 'Van Gogh: Sunflower Yellow + Starry Night Blue + Olive Green', '#FFC300', 40, '#1B3A5C', 35, '#4B5320', 25, '畫作般的溫暖與深邃三色', 'A painterly trio of warmth and depth', 20),
    ('藝術家', '克林姆：金 + 深綠 + 酒紅', 'Klimt: Gold + Deep Green + Burgundy', '#B8860B', 40, '#1B4332', 35, '#5C1A24', 25, '華麗鑲嵌感三色，藝術裝飾風', 'An ornate, mosaic-inspired trio with art-nouveau opulence', 30),

    ('設計師/流派', '包浩斯：紅 + 黃 + 藍', 'Bauhaus: Red + Yellow + Blue', '#D7263D', 35, '#FFD400', 35, '#005CAB', 30, '三原色近似等比例，強調功能與純粹幾何感', 'A near-equal primary triad, emphasizing function and pure geometric form', 10),
    ('設計師/流派', '柯比意建築色卡：赭黃 + 灰藍 + 磚紅', 'Le Corbusier Architectural Palette: Ochre Yellow + Grey Blue + Brick Red', '#C9A227', 40, '#6E8894', 35, '#B5533C', 25, '現代主義建築感，質感戶外款', 'A modernist architectural feel, suited to refined outdoor pieces', 20),
    ('設計師/流派', '曼菲斯：螢光粉 + 薄荷綠 + 鮮黃', 'Memphis: Neon Pink + Mint Green + Bright Yellow', '#FF3EA5', 40, '#6FFFB0', 35, '#FFEA00', 25, '80年代後現代大膽撞色，年輕潮流款', 'A bold 1980s postmodern color-block, for a youthful, trend-forward style', 30),

    ('品牌', '愛馬仕：橘 + 巧克力棕 + 米白', 'Hermès: Orange + Chocolate Brown + Cream', '#F26B21', 50, '#5B4636', 30, '#F0E6D8', 20, '精品禮盒經典三色', 'A classic luxury gift-box trio', 10),
    ('品牌', 'Burberry：駝色 + 黑 + 紅', 'Burberry: Camel + Black + Red', '#C19A6B', 55, '#1A1A1A', 30, '#C8102E', 15, '英倫格紋經典三色，紅色點綴呼應品牌識別', 'A classic British-check trio, red accents echo the brand identity', 20),
    ('品牌', 'Nike：黑 + 白 + 螢光黃綠', 'Nike: Black + White + Volt', '#1A1A1A', 50, '#F5F5F0', 30, '#D8FF00', 20, '科技運動三色，Volt作點綴提升辨識度', 'A techy, sporty trio, the Volt accent boosts visibility', 30),

    ('基礎百搭', '灰 + 白 + 黑', 'Grey + White + Black', '#8A8D8F', 55, '#F5F5F0', 30, '#1A1A1A', 15, '灰色主體、白色內裡、黑色滾邊/標籤', 'Grey as the main body, white lining, black piping or labels', 40),
    ('基礎百搭', '丈青 + 灰 + 白', 'Navy + Grey + White', '#1F2A44', 55, '#8A8D8F', 30, '#F5F5F0', 15, '商務休閒款常見，白色作小面積點綴', 'Common on business-casual styles, white as a small accent', 50),

    ('大地戶外', '迷彩綠 + 卡其 + 咖啡', 'Camo Green + Khaki + Coffee Brown', '#5A6B47', 50, '#C3A473', 35, '#5B4636', 15, '迷彩/軍規系列，大地色層次分明', 'Camo/tactical series with clear earth-tone layering', 40),
    ('大地戶外', '軍綠 + 迷彩綠 + 卡其', 'Olive Green + Camo Green + Khaki', '#4B5320', 45, '#5A6B47', 35, '#C3A473', 20, '同色系深淺搭配，戶外機能感強', 'Same-hue depth pairing with strong outdoor-functional feel', 50),
    ('大地戶外', '酒紅 + 卡其 + 軍綠', 'Burgundy + Khaki + Olive Green', '#7B1E2B', 45, '#C3A473', 35, '#4B5320', 20, '復古戶外風，酒紅作主色點綴少面積', 'Vintage outdoor style, burgundy as main with smaller accent areas', 60),

    ('安全反光', '黑 + 大紅 + 螢光黃', 'Black + Red + Neon Yellow', '#1A1A1A', 55, '#C8102E', 30, '#D8E82E', 15, '三重高辨識，夜間遛狗/交通繁忙區常用', 'Triple hi-vis combo, common for night walks or busy traffic areas', 40),
    ('安全反光', '丈青 + 橘 + 螢光黃', 'Navy + Orange + Neon Yellow', '#1F2A44', 50, '#E8712B', 30, '#D8E82E', 20, '深藍主體配雙色安全點綴', 'Deep navy body with dual safety accents', 50),
    ('安全反光', '灰 + 橘 + 黑', 'Grey + Orange + Black', '#8A8D8F', 50, '#E8712B', 30, '#1A1A1A', 20, '中性灰底，橘色拉鍊條+黑色結構線', 'Neutral grey base, orange zipper tape plus black structure lines', 60),

    ('運動撞色', '灰 + 橘 + 黑', 'Grey + Orange + Black', '#8A8D8F', 50, '#E8712B', 30, '#1A1A1A', 20, '運動機能經典，橘色側邊條/Logo區', 'Classic sporty functional, orange side stripes or logo zone', 40),
    ('運動撞色', '寶藍 + 白 + 橘', 'Royal Blue + White + Orange', '#1E4D8C', 45, '#F5F5F0', 35, '#E8712B', 20, '活力撞色，適合戶外運動款', 'Energetic color-block, suited to outdoor sport styles', 50),
    ('運動撞色', '黑 + 灰 + 螢光黃綠', 'Black + Grey + Volt', '#1A1A1A', 50, '#8A8D8F', 30, '#D8FF00', 20, '科技感三色，螢光綠作織帶/反光點綴', 'Tech-inspired trio, volt green on webbing or reflective accents', 60),

    ('清爽甜美', '天空藍 + 白 + 粉紅', 'Sky Blue + White + Pink', '#7FB2DA', 45, '#F5F5F0', 35, '#E8A0BF', 20, '清爽藍白底，粉紅小面積點綴', 'Fresh blue-white base with small pink accents', 40),
    ('清爽甜美', '白 + 天空藍 + 寶藍', 'White + Sky Blue + Royal Blue', '#F5F5F0', 50, '#7FB2DA', 30, '#1E4D8C', 20, '同色系藍色漸層感，夏季款常見', 'Same-hue blue gradient feel, common on summer styles', 50),
    ('清爽甜美', '粉紅 + 馬卡龍薰衣草紫 + 白', 'Pink + Macaron Lavender + White', '#E8A0BF', 45, '#D8BFD8', 35, '#F5F5F0', 20, '夢幻甜美，幼犬/貓用品熱門', 'Dreamy and sweet, popular for puppy/kitten items', 60),

    ('低調質感', '酒紅 + 灰 + 黑', 'Burgundy + Grey + Black', '#7B1E2B', 50, '#8A8D8F', 30, '#1A1A1A', 20, '沉穩深色調，適合秋冬質感款', 'Composed deep tones, suited to autumn/winter refined styles', 40),
    ('低調質感', '丈青 + 珍珠灰 + 莫蘭迪駝色', 'Navy + Pearl Grey + Morandi Camel', '#1F2A44', 45, '#B8B0A8', 35, '#B5A99A', 20, '商務質感三色，低飽和耐看', 'Business-grade refined trio, low-saturation and timeless', 50),
    ('低調質感', '紫 + 珍珠灰 + 黑', 'Purple + Pearl Grey + Black', '#5B3A76', 45, '#B8B0A8', 35, '#1A1A1A', 20, '時尚低調，紫色作主色或內裡', 'Fashionably understated, purple as main or lining', 60),

    ('莫蘭迪風', '莫蘭迪灰藍 + 莫蘭迪鼠尾草綠 + 莫蘭迪駝色', 'Morandi Dusty Blue + Morandi Sage + Morandi Camel', '#8B9DA6', 40, '#9CAF88', 35, '#B5A99A', 25, '全莫蘭迪三色，質感文青風', 'All-Morandi trio with an indie-art refined feel', 40),
    ('莫蘭迪風', '莫蘭迪霧粉 + 莫蘭迪灰紫 + 莫蘭迪駝色', 'Morandi Dusty Pink + Morandi Dusty Purple + Morandi Camel', '#C9A9A6', 40, '#A79BA6', 35, '#B5A99A', 25, '裸粉紫調，女性向質感熱門', 'Nude pink-purple tones, popular for feminine-leaning premium lines', 50),
    ('莫蘭迪風', '莫蘭迪鼠尾草綠 + 莫蘭迪灰藍 + 淺灰', 'Morandi Sage + Morandi Dusty Blue + Light Grey', '#9CAF88', 45, '#8B9DA6', 35, '#C4C6C8', 20, '綠藍灰組合，自然又沉穩', 'Green-blue-grey combo, natural yet composed', 60),

    ('馬卡龍風', '馬卡龍薰衣草紫 + 馬卡龍粉 + 馬卡龍天空藍', 'Macaron Lavender + Macaron Pink + Macaron Sky Blue', '#D8BFD8', 40, '#FADADD', 35, '#AEE2FF', 25, '夢幻三色，接近等比例繽紛', 'Dreamy near-equal trio, colorful and playful', 40),
    ('馬卡龍風', '馬卡龍蜜桃橘 + 馬卡龍粉 + 白', 'Macaron Peach + Macaron Pink + White', '#FFD6A5', 40, '#FADADD', 35, '#F5F5F0', 25, '暖色馬卡龍，白色降低甜膩感', 'Warm macaron tones, white reduces overly sweet feel', 50),
    ('馬卡龍風', '馬卡龍薄荷綠 + 馬卡龍天空藍 + 馬卡龍薰衣草紫', 'Macaron Mint + Macaron Sky Blue + Macaron Lavender', '#B4E7CE', 40, '#AEE2FF', 35, '#D8BFD8', 25, '清涼系馬卡龍，春夏款常見', 'Cool-toned macaron trio, common on spring/summer styles', 60),

    ('北歐設計風', '霧霾藍 + 燕麥白 + 芥末黃', 'Dusty Blue + Oat White + Mustard Yellow', '#7B96A8', 45, '#F0E6D8', 35, '#D4A017', 20, '北歐經典藍白底，芥末黃點綴', 'Classic Nordic blue-white base with mustard accent', 40),
    ('北歐設計風', '森林綠 + 霧霾藍 + 燕麥灰褐', 'Forest Green + Dusty Blue + Oat Taupe', '#4F6F52', 45, '#7B96A8', 35, '#A89684', 20, '自然系深淺綠藍褐，質樸北歐感', 'Natural green-blue-taupe depth with rustic Nordic feel', 50),
    ('北歐設計風', '燕麥白 + 芥末黃 + 灰', 'Oat White + Mustard Yellow + Grey', '#F0E6D8', 50, '#D4A017', 30, '#8A8D8F', 20, '暖白主體，低彩度黃灰點綴', 'Warm white body with low-saturation yellow-grey accents', 60),

    ('精品風', '曜石黑 + 勃根地酒紅 + 香檳金', 'Obsidian Black + Burgundy + Champagne Gold', '#0D0D0D', 50, '#5C1A24', 35, '#D4B98C', 15, '深色精品感，金色限五金小面積', 'Deep luxury feel, gold limited to small hardware areas', 40),
    ('精品風', '墨綠 + 珍珠灰 + 香檳金', 'Deep Emerald + Pearl Grey + Champagne Gold', '#1B4332', 50, '#B8B0A8', 30, '#D4B98C', 20, '墨綠主色配灰金，低調奢華', 'Deep emerald main with grey-gold, understated luxury', 50),
    ('精品風', '焦糖棕 + 勃根地酒紅 + 香檳金', 'Caramel Brown + Burgundy + Champagne Gold', '#8B5A2B', 45, '#5C1A24', 35, '#D4B98C', 20, '皮革感三色，精品包款常見比例', 'Leather-look trio with ratios common on luxury bags', 60),

    ('藝術家', '馬諦斯：珊瑚紅 + 剪紙藍 + 白', 'Matisse: Coral Red + Cut-out Blue + White', '#E2725B', 40, '#1F4E79', 35, '#F2F2EC', 25, '大膽色塊拼貼感，白色留白平衡', 'Bold collage color-blocks, white negative space for balance', 40),
    ('藝術家', '北齋：北齋藍 + 浪花白 + 赭黃', 'Hokusai: Hokusai Blue + Wave White + Ochre Yellow', '#14213D', 45, '#F2F2EC', 35, '#C9A227', 20, '浮世繪經典藍白，赭黃作小面積點綴', 'Classic ukiyo-e blue-white, ochre yellow as small accent', 50),
    ('藝術家', '畢卡索：藍 + 玫瑰 + 土褐', 'Picasso: Blue + Rose + Earth Brown', '#1B3A5C', 40, '#C9A9A6', 35, '#8B5A2B', 25, '藍色時期意象延伸，土褐穩定畫面', 'Blue Period-inspired extension, earth brown stabilizes the palette', 60),
    ('藝術家', '蒙德里安：黑線分隔 白 + 紅 + 藍', 'Mondrian: White + Red + Blue (Black Lines)', '#F5F5F0', 40, '#D7263D', 30, '#005CAB', 30, '白底三原色，黑色線條/滾邊作第四視覺元素', 'White base primaries, black lines/piping as a fourth visual element', 70),
    ('藝術家', '達文西：赭褐 + 深綠 + 金', 'Da Vinci: Sienna Brown + Deep Green + Gold', '#8B5A2B', 45, '#1B4332', 35, '#B8860B', 20, '文藝復興暖褐綠金，古典畫作感', 'Renaissance sienna-green-gold with a classical painterly feel', 80),

    ('設計師/流派', '柯比意：灰藍 + 赭黃 + 白', 'Le Corbusier: Grey Blue + Ochre Yellow + White', '#6E8894', 45, '#C9A227', 35, '#F5F5F0', 20, '建築色卡延伸，白色作結構分隔', 'Architectural palette extension, white as structural divider', 40),
    ('設計師/流派', '包浩斯：黑 + 白 + 紅', 'Bauhaus: Black + White + Red', '#1A1A1A', 45, '#F5F5F0', 35, '#D7263D', 20, '機能幾何感，紅色小面積強調', 'Functional geometric feel, red as a small emphatic accent', 50),
    ('設計師/流派', '曼菲斯：黑 + 螢光粉 + 薄荷綠', 'Memphis: Black + Neon Pink + Mint Green', '#1A1A1A', 40, '#FF3EA5', 35, '#6FFFB0', 25, '80年代後現代，黑色底襯托螢光色', '1980s postmodern, black base supporting neon accents', 60),

    ('品牌', 'Tiffany：Tiffany藍 + 白 + 銀灰', 'Tiffany: Tiffany Blue + White + Silver Grey', '#81D8D0', 50, '#F5F5F0', 35, '#C7C8CA', 15, '清新高級，銀灰作五金/扣具色', 'Fresh and upscale, silver grey for hardware/clasp color', 40),
    ('品牌', 'LV：棕褐 + 金 + 黑', 'LV: Tan Brown + Gold + Black', '#5C3A21', 50, '#C9A66B', 30, '#1A1A1A', 20, '經典Monogram配色延伸，黑作滾邊', 'Classic monogram palette extension, black for piping', 50),
    ('品牌', 'Patagonia：苔蘚綠 + 石頭米 + 咖啡', 'Patagonia: Moss Green + Stone Beige + Coffee Brown', '#6B8E5A', 45, '#C2B280', 35, '#5B4636', 20, '環保大地三色，機能戶外款', 'Eco earth-tone trio for functional outdoor styles', 60),
    ('品牌', 'The North Face：紅 + 黑 + 白', 'The North Face: Red + Black + White', '#C8102E', 45, '#1A1A1A', 35, '#F5F5F0', 20, '戶外機能經典三色撞色', 'Classic outdoor-functional tri-color block', 70),
    ('品牌', 'Apple：太空灰 + 銀 + 白', 'Apple: Space Grey + Silver + White', '#6E6E73', 50, '#C7C8CA', 30, '#F5F5F0', 20, '科技極簡金屬質感三色', 'Minimalist tech trio with metallic finish', 80),
    ('品牌', 'MUJI：生成米白 + 淺灰 + 燕麥褐', 'MUJI: Unbleached Beige + Light Grey + Oat Brown', '#E9DCC5', 50, '#C7C6C1', 30, '#A89684', 20, '無印低彩度自然三色', 'MUJI low-saturation natural trio', 90),
    ('品牌', 'IKEA：IKEA藍 + IKEA黃 + 白', 'IKEA: IKEA Blue + IKEA Yellow + White', '#0051BA', 40, '#FFDA1A', 35, '#F5F5F0', 25, '高辨識北歐品牌三色', 'Highly recognizable Nordic brand trio', 100),
    ('品牌', 'Bottega Veneta：鸚鵡綠 + 白 + 黑', 'Bottega Veneta: Parakeet Green + White + Black', '#3EB489', 45, '#F5F5F0', 35, '#1A1A1A', 20, '鮮明綠白黑，話題性強', 'Vivid green-white-black with strong brand buzz', 110)
)
INSERT INTO public.material_color_palettes (
    owner_scope, owner_user_id, type_id, type_text, name, name_en, note, note_en,
    color_count, primary_hex, accent_hex, tertiary_hex, ratio_preset, ratio_percents, sort_order, is_active, updated_at
)
SELECT 'platform', NULL, t.id, NULL, nt.name, nt.name_en, nt.note, nt.note_en,
    3, nt.primary_hex, nt.accent_hex, nt.tertiary_hex, 'tri_custom', jsonb_build_array(nt.pct1, nt.pct2, nt.pct3), nt.sort_order, true, now()
FROM new_tri nt
JOIN public.material_color_palette_types t ON t.name = nt.type_name
WHERE NOT EXISTS (
    SELECT 1 FROM public.material_color_palettes p
    WHERE p.owner_scope = 'platform' AND p.type_id = t.id AND p.name = nt.name AND p.color_count = 3
);
