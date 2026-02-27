-- =============================================
-- 廠商作品圖：作品重點 + 主圖/第二張圖
-- 執行：Supabase SQL Editor
-- =============================================

ALTER TABLE public.manufacturer_portfolio
  ADD COLUMN IF NOT EXISTS design_highlight text;

COMMENT ON COLUMN public.manufacturer_portfolio.design_highlight IS '作品重點說明（圖庫與詳情顯示）';

ALTER TABLE public.manufacturer_portfolio
  ADD COLUMN IF NOT EXISTS image_url_before text;

COMMENT ON COLUMN public.manufacturer_portfolio.image_url_before IS '第二張圖片 URL（選填）';
