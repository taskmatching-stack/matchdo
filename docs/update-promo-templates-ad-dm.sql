-- 推廣圖模板：從「換場景」改為「DM／廣告／宣傳風格」
-- 若已跑過舊版 add-product-promo-image.sql，請在 Supabase SQL Editor 執行本檔。
-- 可重複執行（冪等）。

UPDATE public.promo_scene_templates
SET is_active = FALSE, updated_at = NOW()
WHERE key IN (
    'lifestyle_home',
    'studio_clean',
    'desktop_mockup',
    'outdoor_nature',
    'ecommerce_white'
);

INSERT INTO public.promo_scene_templates (key, name, description, scene_prompt, composition_hint, category, sort_order, is_active) VALUES
('product_hero_ad', '產品主視覺廣告', '適合官網／社群的產品廣告主圖',
 'commercial product advertising hero visual, clean and powerful, marketing-campaign quality',
 'product fills the frame as the clear hero, strong focal point, advertising layout feel without readable text overlays',
 'ad', 10, TRUE),
('flyer_dm', 'DM／傳單風', '清楚好印，適合DM與傳單主圖',
 'print-ready promotional flyer visual, clear product presentation for direct-mail and handout marketing',
 'centered product hero, high clarity, balanced margins suitable for DM and flyer use, no invented lifestyle room',
 'print', 20, TRUE),
('campaign_promo', '活動宣傳風', '有張力的促銷／活動宣傳感',
 'bold promotional campaign advertising look, eye-catching marketing energy for sales and event promotion',
 'dynamic commercial composition, strong contrast, campaign poster energy while keeping the real product unchanged',
 'campaign', 30, TRUE),
('brand_premium', '品牌質感廣告', '高級克制，適合品牌形象宣傳',
 'premium brand advertising photography, refined and restrained luxury marketing aesthetic',
 'elegant commercial framing, soft premium lighting, high-end catalog advertising mood',
 'brand', 40, TRUE),
('catalog_ad', '型錄／電商廣告', '清楚展示，適合型錄與電商宣傳',
 'clean catalog and ecommerce advertising visual, accurate product showcase for online and print catalog promo',
 'product clearly readable, even commercial lighting, catalog-ad composition, minimal distraction',
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
