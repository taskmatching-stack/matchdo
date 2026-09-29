-- AI 估價分類（後台 categories.html）英文名；前台 GET /api/categories?lang=en
-- 執行：Supabase SQL Editor

ALTER TABLE public.ai_categories
    ADD COLUMN IF NOT EXISTS name_en TEXT;

COMMENT ON COLUMN public.ai_categories.name_en IS '主分類顯示名（英文），前台 lang=en 時使用';

ALTER TABLE public.ai_subcategories
    ADD COLUMN IF NOT EXISTS name_en TEXT;

COMMENT ON COLUMN public.ai_subcategories.name_en IS '子分類顯示名（英文），前台 lang=en 時使用；option value 仍以 name（中文）為準';
