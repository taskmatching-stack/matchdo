-- 廠商作品：系列圖付點數上傳時，僅顯示一個月（1800/測試員無期限）
-- 執行：Supabase SQL Editor

ALTER TABLE public.manufacturer_portfolio
    ADD COLUMN IF NOT EXISTS series_image_valid_until TIMESTAMPTZ;

COMMENT ON COLUMN public.manufacturer_portfolio.series_image_valid_until IS '付 600 點上傳的系列圖有效期限；過期後對外不顯示主圖。NULL 表示 1800/測試員上傳，無期限';

SELECT 'manufacturer_portfolio 已支援 series_image_valid_until' AS message;
