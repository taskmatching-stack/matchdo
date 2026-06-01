-- 可選：種子轉正長期優惠、挖貝資合作初期優惠等專用方案
-- 執行後請至後台「會員／訂閱 → 方案設定」調整實際月費，再以「廠商管理」或「用戶等級與點數」為帳號開通對應方案。

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
