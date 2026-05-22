-- 訂製品：提示詞／生成圖語意（§6 T0，T3 使用）
-- 執行：Supabase SQL Editor

ALTER TABLE public.custom_products
    ADD COLUMN IF NOT EXISTS ai_tags text[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS prompt_semantics_json jsonb,
    ADD COLUMN IF NOT EXISTS image_semantics_json jsonb,
    ADD COLUMN IF NOT EXISTS semantics_generated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_custom_products_ai_tags ON public.custom_products USING GIN (ai_tags);

COMMENT ON COLUMN public.custom_products.prompt_semantics_json IS 'Gemini 解析 generation_prompt 等文字';
COMMENT ON COLUMN public.custom_products.image_semantics_json IS 'Gemini 解析 ai_generated_image_url';
