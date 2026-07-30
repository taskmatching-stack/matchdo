-- 推廣圖模板：只保留廣告／DM 風格；刪除舊「換場景」列，前後台一致
-- 可重複執行（冪等）。
--
-- ⚠ 若後台已自訂「主視覺/Banner」「社群貼文」等主題的 scene_prompt，勿再跑本檔
--    （ON CONFLICT 會覆寫 product_hero_ad 等 key 的提示詞）。
--    只補那兩筆請用 docs/patch-recover-two-promo-themes-banner-social.sql

-- 1) 刪除舊換場景模板（前台本來就不顯示；後台也不該再留）
DELETE FROM public.promo_scene_templates
WHERE key IN (
    'lifestyle_home',
    'studio_clean',
    'desktop_mockup',
    'outdoor_nature',
    'ecommerce_white'
);

-- 2) 寫入／更新廣告風格（強化：禁止只換背景）
INSERT INTO public.promo_scene_templates (key, name, description, scene_prompt, composition_hint, category, sort_order, is_active) VALUES
('product_hero_ad', '產品主視覺廣告', '重新設計成官網／社群廣告主圖（不是原圖換底）',
 'redesign into a powerful commercial advertising hero key visual with campaign lighting and polished marketing look; not a background swap',
 'new advertising crop and framing; product as hero with intentional negative space; forbid keeping the exact same reference pose and framing',
 'ad', 10, TRUE),
('flyer_dm', 'DM／傳單風', '重新設計成可印的 DM／傳單主圖',
 'redesign as a print-ready DM and flyer advertising visual with clear product presentation for direct-mail marketing',
 'balanced flyer margins and strong product hierarchy; commercial ad redesign, not a retouched copy of the reference photo',
 'print', 20, TRUE),
('campaign_promo', '活動宣傳風', '有張力的促銷／活動宣傳主視覺',
 'bold promotional campaign advertising redesign with eye-catching marketing energy for sales and event promotion',
 'dynamic campaign composition and contrast; reinvent the shot as an ad, keep product identity but change framing',
 'campaign', 30, TRUE),
('brand_premium', '品牌質感廣告', '高級克制的品牌形象廣告',
 'premium brand advertising redesign with refined luxury marketing aesthetic and high-end catalog energy',
 'elegant commercial framing and premium lighting; advertising reinterpretation rather than background cleanup',
 'brand', 40, TRUE),
('catalog_ad', '型錄／電商廣告', '清楚有力的型錄／電商宣傳主圖',
 'clean catalog and ecommerce advertising redesign for online and print catalog promo',
 'accurate product showcase with commercial catalog lighting and a stronger ad crop than the reference photo',
 'catalog', 50, TRUE)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    scene_prompt = EXCLUDED.scene_prompt,
    composition_hint = EXCLUDED.composition_hint,
    category = EXCLUDED.category,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE,
    updated_at = NOW();
