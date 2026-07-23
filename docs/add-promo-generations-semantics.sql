-- 情境圖：Gemini 語意標籤與描述（對齊 custom_products 靈感牆管線）
-- 執行：Supabase SQL Editor

ALTER TABLE public.product_promo_generations
    ADD COLUMN IF NOT EXISTS ai_tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS image_semantics_json JSONB,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS semantics_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.product_promo_generations.ai_tags IS 'Gemini 分析情境成圖的搜尋標籤';
COMMENT ON COLUMN public.product_promo_generations.image_semantics_json IS 'Gemini 結構化語意（含 tags、product_description_zh 等）';
COMMENT ON COLUMN public.product_promo_generations.description IS '媒體牆展示用情境描述（通常取自 product_description_zh）';
COMMENT ON COLUMN public.product_promo_generations.semantics_generated_at IS '語意標籤生成完成時間';

CREATE INDEX IF NOT EXISTS idx_product_promo_generations_ai_tags
    ON public.product_promo_generations USING GIN (ai_tags);
