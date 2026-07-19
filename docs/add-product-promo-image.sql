-- 產品推廣圖：宣傳風格模板 + 點數設定
-- 執行：Supabase SQL Editor
-- 見 docs/PLAN-product-promo-image-implementation.md
-- 定位：DM／廣告／宣傳主視覺（不是把產品塞進居家／戶外等場景）

-- 1) 宣傳風格模板（表名沿用 promo_scene_templates，語意改為廣告風格）
CREATE TABLE IF NOT EXISTS public.promo_scene_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    scene_prompt TEXT NOT NULL DEFAULT '',
    composition_hint TEXT,
    recommended_ratios TEXT[] DEFAULT ARRAY['1:1', '4:3', '16:9'],
    category TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_scene_templates_sort
    ON public.promo_scene_templates (sort_order, key);
CREATE INDEX IF NOT EXISTS idx_promo_scene_templates_active
    ON public.promo_scene_templates (is_active);

COMMENT ON TABLE public.promo_scene_templates IS '產品推廣圖宣傳風格（DM／廣告／宣傳用；非換場景）';

ALTER TABLE public.promo_scene_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for promo_scene_templates" ON public.promo_scene_templates;
CREATE POLICY "Allow all for promo_scene_templates"
    ON public.promo_scene_templates FOR ALL
    USING (true);

-- 停用並刪除舊「換場景」模板（若已存在）
UPDATE public.promo_scene_templates
SET is_active = FALSE, updated_at = NOW()
WHERE key IN (
    'lifestyle_home',
    'studio_clean',
    'desktop_mockup',
    'outdoor_nature',
    'ecommerce_white'
);
DELETE FROM public.promo_scene_templates
WHERE key IN (
    'lifestyle_home',
    'studio_clean',
    'desktop_mockup',
    'outdoor_nature',
    'ecommerce_white'
);

INSERT INTO public.promo_scene_templates (key, name, description, scene_prompt, composition_hint, category, sort_order) VALUES
('product_hero_ad', '產品主視覺廣告', '重新設計成官網／社群廣告主圖（不是原圖換底）',
 'redesign into a powerful commercial advertising hero key visual with campaign lighting and polished marketing look; not a background swap',
 'new advertising crop and framing; product as hero with intentional negative space; forbid keeping the exact same reference pose and framing',
 'ad', 10),
('flyer_dm', 'DM／傳單風', '重新設計成可印的 DM／傳單主圖',
 'redesign as a print-ready DM and flyer advertising visual with clear product presentation for direct-mail marketing',
 'balanced flyer margins and strong product hierarchy; commercial ad redesign, not a retouched copy of the reference photo',
 'print', 20),
('campaign_promo', '活動宣傳風', '有張力的促銷／活動宣傳主視覺',
 'bold promotional campaign advertising redesign with eye-catching marketing energy for sales and event promotion',
 'dynamic campaign composition and contrast; reinvent the shot as an ad, keep product identity but change framing',
 'campaign', 30),
('brand_premium', '品牌質感廣告', '高級克制的品牌形象廣告',
 'premium brand advertising redesign with refined luxury marketing aesthetic and high-end catalog energy',
 'elegant commercial framing and premium lighting; advertising reinterpretation rather than background cleanup',
 'brand', 40),
('catalog_ad', '型錄／電商廣告', '清楚有力的型錄／電商宣傳主圖',
 'clean catalog and ecommerce advertising redesign for online and print catalog promo',
 'accurate product showcase with commercial catalog lighting and a stronger ad crop than the reference photo',
 'catalog', 50)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    scene_prompt = EXCLUDED.scene_prompt,
    composition_hint = EXCLUDED.composition_hint,
    category = EXCLUDED.category,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE,
    updated_at = NOW();

-- 2) 生成紀錄（可選；API 會寫入，表不存在時僅略過寫入）
CREATE TABLE IF NOT EXISTS public.product_promo_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('custom_product', 'vendor_asset', 'upload', 'digital_asset')),
    source_id UUID,
    source_image_url TEXT,
    aspect_ratio TEXT,
    width INT NOT NULL,
    height INT NOT NULL,
    megapixels NUMERIC(4,2),
    scene_template_key TEXT,
    user_prompt TEXT,
    photography_set_id UUID,
    final_prompt TEXT,
    result_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'success',
    points_charged INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_promo_gen_user_created
    ON public.product_promo_generations (user_id, created_at DESC);

ALTER TABLE public.product_promo_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for product_promo_generations" ON public.product_promo_generations;
CREATE POLICY "Allow all for product_promo_generations"
    ON public.product_promo_generations FOR ALL
    USING (true);

-- 3) 點數：基礎 20／每多 1MP +10
INSERT INTO public.payment_config (key, value, updated_at)
VALUES
    ('points_promo_image_base', '20', NOW()),
    ('points_promo_image_per_extra_mp', '10', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
