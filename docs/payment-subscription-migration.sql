-- =============================================
-- 訂閱／年付支援：payment_orders 與 subscription_plans 擴充
-- 執行時若欄位已存在可略過對應 ALTER
-- =============================================

-- payment_orders：區分單次儲值、月訂閱定期定額、年付
ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'one_time'
  CHECK (order_type IN ('one_time', 'subscription', 'yearly'));

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.payment_orders.order_type IS 'one_time=單次儲值, subscription=綠界月訂閱定期定額, yearly=年付一次';
COMMENT ON COLUMN public.payment_orders.metadata IS '例：yearly 時 { "plan_key": "tier2" }；訂閱時 credits_to_grant 為每期點數';

-- subscription_plans：方案 key 供後端對應（tier2, tier3, tier4）
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS plan_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_plan_key
  ON public.subscription_plans(plan_key) WHERE plan_key IS NOT NULL;

COMMENT ON COLUMN public.subscription_plans.plan_key IS '方案代碼，與前端 data-plan 對應，例 tier2';
