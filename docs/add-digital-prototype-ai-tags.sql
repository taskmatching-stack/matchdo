-- 廠商數位原型／作品：AI 標籤與語意 JSON（§6 T0）
-- 執行：管理後台 /admin/db-migrations.html →「視覺語意庫（一次執行三項）」；或 Supabase SQL Editor

-- vendor_assets
ALTER TABLE public.vendor_assets
    ADD COLUMN IF NOT EXISTS ai_tags text[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS ai_tags_generated_at timestamptz,
    ADD COLUMN IF NOT EXISTS tags_source text DEFAULT 'gemini',
    ADD COLUMN IF NOT EXISTS image_semantics_json jsonb,
    ADD COLUMN IF NOT EXISTS product_preview_image_url text;

CREATE INDEX IF NOT EXISTS idx_vendor_assets_ai_tags ON public.vendor_assets USING GIN (ai_tags);

COMMENT ON COLUMN public.vendor_assets.ai_tags IS 'Gemini 讀圖產生之搜尋標籤';
COMMENT ON COLUMN public.vendor_assets.image_semantics_json IS '結構化語意（風格、材質、配色等）';

-- manufacturer_portfolio
ALTER TABLE public.manufacturer_portfolio
    ADD COLUMN IF NOT EXISTS ai_tags text[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS ai_tags_generated_at timestamptz,
    ADD COLUMN IF NOT EXISTS tags_source text DEFAULT 'gemini',
    ADD COLUMN IF NOT EXISTS image_semantics_json jsonb,
    ADD COLUMN IF NOT EXISTS product_preview_image_url text;

CREATE INDEX IF NOT EXISTS idx_manufacturer_portfolio_ai_tags ON public.manufacturer_portfolio USING GIN (ai_tags);
