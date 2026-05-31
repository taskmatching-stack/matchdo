-- 供應商數位產品庫：AI 標籤／語意（對稱 vendor_assets）
-- 執行：Supabase SQL Editor → Run without RLS

ALTER TABLE public.supplier_catalog_items
ADD COLUMN IF NOT EXISTS ai_tags jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS image_semantics_json jsonb,
ADD COLUMN IF NOT EXISTS tags_source text,
ADD COLUMN IF NOT EXISTS ai_tags_generated_at timestamptz;

COMMENT ON COLUMN public.supplier_catalog_items.ai_tags IS 'AI 或手動標籤陣列';
COMMENT ON COLUMN public.supplier_catalog_items.image_semantics_json IS '視覺語意 JSON（與廠商素材庫相同結構）';
COMMENT ON COLUMN public.supplier_catalog_items.tags_source IS 'gemini | manual | import';
