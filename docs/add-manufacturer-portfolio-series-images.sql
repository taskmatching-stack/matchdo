-- 廠商作品：系列圖多張（JSONB 陣列），與既有 image_url 並存；image_url 為第一張或主圖
-- 執行：Supabase SQL Editor

ALTER TABLE public.manufacturer_portfolio
    ADD COLUMN IF NOT EXISTS series_image_urls JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.manufacturer_portfolio.series_image_urls IS '系列圖多張 URL 陣列；付 600 點時僅主圖顯示一個月，此欄依 series_image_valid_until 遮罩';

SELECT 'manufacturer_portfolio 已支援 series_image_urls' AS message;
