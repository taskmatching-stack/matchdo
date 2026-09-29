-- subscription_plans：牌價年付（可覆寫月費×10）；NULL 時程式 fallback 月費×10
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS yearly_price_twd integer,
  ADD COLUMN IF NOT EXISTS yearly_price_usd numeric(10, 2);

COMMENT ON COLUMN public.subscription_plans.yearly_price_twd IS '牌價年付（TWD）；NULL 時以月費 price×10';
COMMENT ON COLUMN public.subscription_plans.yearly_price_usd IS '牌價年付（USD）；NULL 時以 price_usd_monthly×10';
