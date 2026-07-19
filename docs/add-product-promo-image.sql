-- 產品推廣圖：情境模板 + 點數設定
-- 執行：Supabase SQL Editor
-- 見 docs/PLAN-product-promo-image-implementation.md

-- 1) 情境模板
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

COMMENT ON TABLE public.promo_scene_templates IS '產品推廣圖情境模板（封裝基礎提示詞）';

ALTER TABLE public.promo_scene_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for promo_scene_templates" ON public.promo_scene_templates;
CREATE POLICY "Allow all for promo_scene_templates"
    ON public.promo_scene_templates FOR ALL
    USING (true);

INSERT INTO public.promo_scene_templates (key, name, description, scene_prompt, composition_hint, category, sort_order) VALUES
('lifestyle_home', '居家生活', '產品置於溫馨家居環境',
 'product placed in a cozy modern home interior, natural window light, warm atmosphere',
 'product as focal point, lifestyle context in background', 'lifestyle', 10),
('studio_clean', '專業棚拍', '純淨背景突顯產品細節',
 'product on clean white surface, professional studio lighting, minimalist composition',
 'centered product, clean background, sharp details', 'studio', 20),
('desktop_mockup', '展示桌面', '辦公桌或工作檯場景',
 'product on wooden desk with laptop and coffee, modern workspace setting',
 'product integrated naturally, workspace aesthetic', 'lifestyle', 30),
('outdoor_nature', '戶外自然', '自然光下的戶外情境',
 'product in outdoor natural setting, soft daylight, organic environment',
 'product harmonized with nature, natural lighting', 'outdoor', 40),
('ecommerce_white', '電商白底', '標準電商主圖風格',
 'product on pure white background, even lighting, clear product view',
 'product fills frame, no shadows, clean cutout style', 'ecommerce', 50)
ON CONFLICT (key) DO NOTHING;

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
