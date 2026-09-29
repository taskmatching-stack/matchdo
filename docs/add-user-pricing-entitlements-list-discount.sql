-- P1-A：終身優惠改為「牌價年付折扣％」，非鎖定絕對成交價
ALTER TABLE public.user_pricing_entitlements
  ADD COLUMN IF NOT EXISTS list_discount_percent numeric(5, 2);

ALTER TABLE public.user_pricing_entitlements
  ALTER COLUMN locked_amount DROP NOT NULL;

COMMENT ON COLUMN public.user_pricing_entitlements.list_discount_percent IS '牌價年付折扣％（例：17 表示牌價少 17%%）；lifetime 續約依當下牌價重算';
COMMENT ON COLUMN public.user_pricing_entitlements.locked_amount IS 'subscription_term 本期成交快照（選填）；lifetime 請用 list_discount_percent';
