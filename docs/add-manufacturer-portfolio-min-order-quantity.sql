-- 廠商作品：每筆作品可填「最小可訂製數量」（MOQ，件數）
-- 於 Supabase SQL Editor 執行一次即可。

ALTER TABLE public.manufacturer_portfolio
  ADD COLUMN IF NOT EXISTS min_order_quantity INTEGER;

COMMENT ON COLUMN public.manufacturer_portfolio.min_order_quantity IS '此作品最小可訂製數量（件）；NULL 表示未填寫';
