-- subscription_plans：PayPal 月費（美金），與 price（台幣）分開維護
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS price_usd_monthly numeric(10, 2);

COMMENT ON COLUMN public.subscription_plans.price_usd_monthly IS 'PayPal 月費（USD）；年付前台依月費×10 計算';

-- 依 sort_order 回填預設（與 seed 四方案對齊）
UPDATE public.subscription_plans
SET price_usd_monthly = CASE sort_order
  WHEN 0 THEN 0
  WHEN 1 THEN 11
  WHEN 2 THEN 33
  WHEN 3 THEN 66
  ELSE price_usd_monthly
END
WHERE price_usd_monthly IS NULL;
