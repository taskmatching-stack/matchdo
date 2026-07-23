-- 訂製品：Gemini 標題雙語（繁中 title + 英文 title_en，靈感牆依 lang 顯示）
-- 執行：Supabase SQL Editor

ALTER TABLE public.custom_products
    ADD COLUMN IF NOT EXISTS title_en TEXT;

COMMENT ON COLUMN public.custom_products.title_en IS '產品標題英文版（Gemini intent_summary 英文句；lang=en 時優先）';
