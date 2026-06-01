-- 可選：種子轉正長期優惠、挖貝資合作初期優惠等專用方案
-- 若報錯 column "plan_key" does not exist：本檔開頭會自動補欄位（或先執行 docs/payment-subscription-migration.sql）
-- 執行後請至後台「方案／點數 → 方案設定」調整實際月費，再以廠商管理／一般會員為帳號開通對應方案。

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS plan_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_plan_key
  ON public.subscription_plans(plan_key) WHERE plan_key IS NOT NULL;

INSERT INTO public.subscription_plans (name, price, duration_months, credits_monthly, sort_order, is_active, plan_key)
SELECT v.name, v.price, v.duration_months, v.credits_monthly, v.sort_order, true, v.plan_key
FROM (VALUES
  ('種子廠商優惠（月）', 199, 1, 330, 10, 'seed_loyalty_monthly'),
  ('種子廠商優惠（年）', 1990, 12, 330, 11, 'seed_loyalty_yearly'),
  ('挖貝資合作優惠（月）', 249, 1, 330, 12, 'waibeizi_launch_monthly')
) AS v(name, price, duration_months, credits_monthly, sort_order, plan_key)
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans sp WHERE sp.plan_key = v.plan_key
);

-- 若環境極舊、無法加 plan_key，可改用手動在後台新增三筆方案，不必執行本檔。
