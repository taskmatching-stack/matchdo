-- 把你已在「金流設定 → 儲值快捷」存的 480／1200 寫回公開付費方案的每月點數
-- （方案二 sort=1 價 300；方案三 sort=2 價 900）。方案四本來就是 2400。
UPDATE public.subscription_plans
SET credits_monthly = 480
WHERE sort_order = 1 AND COALESCE(price, 0) = 300;

UPDATE public.subscription_plans
SET credits_monthly = 1200
WHERE sort_order = 2 AND COALESCE(price, 0) = 900;

INSERT INTO public.payment_config (key, value, updated_at)
VALUES ('plan_credits_synced_from_topup_20260903', '1', now())
ON CONFLICT (key) DO NOTHING;
