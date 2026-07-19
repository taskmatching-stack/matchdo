-- 攝影參數提示詞組 + 分類綁定 + 材料快速選單
-- 執行：Supabase SQL Editor
-- 用途：設計生圖／AI 重繪／寫實化／材料重繪，於既有 prompt 最後追加攝影參數

-- 1) 攝影參數組
CREATE TABLE IF NOT EXISTS public.photography_prompt_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    body_text TEXT NOT NULL DEFAULT '',
    is_material_fallback BOOLEAN NOT NULL DEFAULT FALSE,
    use_for_promo BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photography_prompt_sets_sort
    ON public.photography_prompt_sets (sort_order, key);
CREATE INDEX IF NOT EXISTS idx_photography_prompt_sets_active
    ON public.photography_prompt_sets (is_active);

COMMENT ON TABLE public.photography_prompt_sets IS '攝影參數提示詞組（鏡頭／光影／景深等），追加於各 FLUX prompt 最後';
COMMENT ON COLUMN public.photography_prompt_sets.is_material_fallback IS '材料重繪：手打不在清單內時使用的通用預設（全表最多一筆 true）';
COMMENT ON COLUMN public.photography_prompt_sets.use_for_promo IS '為 true 時，出現在設計區／廠商區推廣圖的攝影參數選單';

-- 材料通用預設：僅允許一筆 is_material_fallback = true
CREATE UNIQUE INDEX IF NOT EXISTS uq_photography_prompt_sets_material_fallback
    ON public.photography_prompt_sets ((is_material_fallback))
    WHERE is_material_fallback = TRUE;

CREATE INDEX IF NOT EXISTS idx_photography_prompt_sets_use_for_promo
    ON public.photography_prompt_sets (use_for_promo)
    WHERE use_for_promo = TRUE;

ALTER TABLE public.photography_prompt_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for photography_prompt_sets" ON public.photography_prompt_sets;
CREATE POLICY "Allow all for photography_prompt_sets"
    ON public.photography_prompt_sets FOR ALL
    USING (true);

INSERT INTO public.photography_prompt_sets (key, name, body_text, is_material_fallback, sort_order)
VALUES (
    'material_default',
    '材料通用預設',
    '自然棚拍光，柔和方向光與真實高光／陰影，清晰對焦，寫實質感。',
    TRUE,
    0
)
ON CONFLICT (key) DO NOTHING;

-- 2) 訂製品主／子分類綁定攝影組
ALTER TABLE public.custom_product_categories
    ADD COLUMN IF NOT EXISTS photography_set_id UUID REFERENCES public.photography_prompt_sets(id) ON DELETE SET NULL;

ALTER TABLE public.custom_product_subcategories
    ADD COLUMN IF NOT EXISTS photography_set_id UUID REFERENCES public.photography_prompt_sets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cpc_photography_set
    ON public.custom_product_categories (photography_set_id);
CREATE INDEX IF NOT EXISTS idx_cps_photography_set
    ON public.custom_product_subcategories (photography_set_id);

-- 3) 材料快速選單（每個選項可綁攝影組）
CREATE TABLE IF NOT EXISTS public.material_surface_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    photography_set_id UUID REFERENCES public.photography_prompt_sets(id) ON DELETE SET NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_material_surface_presets_label_lower
    ON public.material_surface_presets (lower(trim(label)));
CREATE INDEX IF NOT EXISTS idx_material_surface_presets_sort
    ON public.material_surface_presets (sort_order, label);

COMMENT ON TABLE public.material_surface_presets IS '材料 AI 重繪材質類型快速選單；未命中時用 photography_prompt_sets.is_material_fallback';

ALTER TABLE public.material_surface_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for material_surface_presets" ON public.material_surface_presets;
CREATE POLICY "Allow all for material_surface_presets"
    ON public.material_surface_presets FOR ALL
    USING (true);
