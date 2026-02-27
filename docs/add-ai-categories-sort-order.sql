-- 為 ai_categories 新增 sort_order，供後台調整主分類顯示順序
-- 執行方式：在 Supabase Dashboard → SQL Editor 執行本檔
ALTER TABLE public.ai_categories ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.ai_categories.sort_order IS '主分類顯示順序，數字越小越前面';
