-- 廠商作品圖：新增「作品重點」與「第二張圖」欄位（可重複執行）
-- 執行：Supabase SQL Editor
-- 若 relation "public.manufacturer_portfolio" 不存在，請先執行 docs/setup-manufacturer-portfolio.sql

ALTER TABLE public.manufacturer_portfolio
    ADD COLUMN IF NOT EXISTS design_highlight text,
    ADD COLUMN IF NOT EXISTS image_url_before text;

COMMENT ON COLUMN public.manufacturer_portfolio.design_highlight IS '作品重點說明（圖庫與詳情顯示）';
COMMENT ON COLUMN public.manufacturer_portfolio.image_url_before IS '第二張圖片 URL（選填）';
