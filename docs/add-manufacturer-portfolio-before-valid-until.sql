-- 廠商作品：對照圖付點數上傳時，僅顯示一個月（300/900/1800/測試員無期限）
-- 執行：Supabase SQL Editor

ALTER TABLE public.manufacturer_portfolio
    ADD COLUMN IF NOT EXISTS before_image_valid_until TIMESTAMPTZ;

COMMENT ON COLUMN public.manufacturer_portfolio.before_image_valid_until IS '付 400 點上傳的對照圖有效期限；過期後對外不顯示。NULL 表示 300/900/1800/測試員上傳，無期限';

SELECT 'manufacturer_portfolio 已支援 before_image_valid_until' AS message;
