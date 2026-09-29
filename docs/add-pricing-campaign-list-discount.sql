-- 檔期年付：可填「牌價折扣％」或整年特價金額（二選一）
ALTER TABLE public.pricing_campaign_yearly_rules
  ADD COLUMN IF NOT EXISTS list_discount_percent numeric(5, 2);

ALTER TABLE public.pricing_campaign_yearly_rules
  ALTER COLUMN yearly_price_twd DROP NOT NULL,
  ALTER COLUMN yearly_price_usd DROP NOT NULL;

ALTER TABLE public.pricing_campaign_yearly_rules
  DROP CONSTRAINT IF EXISTS pricing_campaign_yearly_rules_prices_positive;

ALTER TABLE public.pricing_campaign_yearly_rules
  ADD CONSTRAINT pricing_campaign_yearly_rules_price_mode CHECK (
    (
      list_discount_percent IS NOT NULL
      AND list_discount_percent > 0
      AND list_discount_percent < 100
    )
    OR (
      yearly_price_twd IS NOT NULL AND yearly_price_twd > 0
      AND yearly_price_usd IS NOT NULL AND yearly_price_usd > 0
    )
  );

COMMENT ON COLUMN public.pricing_campaign_yearly_rules.list_discount_percent IS '牌價年付折扣％（與整年 TWD/USD 特價二選一）';
