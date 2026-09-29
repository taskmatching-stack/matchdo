-- 個人訂閱鎖價（P1-A）：年付成交價快照；lifetime 牌價折扣％
CREATE TABLE IF NOT EXISTS public.user_pricing_entitlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_key text NOT NULL,
    billing text NOT NULL CHECK (billing IN ('yearly', 'monthly')),
    currency text NOT NULL CHECK (currency IN ('TWD', 'USD')),
    locked_amount numeric(12, 2),
    list_discount_percent numeric(5, 2),
    scope text NOT NULL DEFAULT 'subscription_term'
        CHECK (scope IN ('subscription_term', 'lifetime')),
    source text NOT NULL DEFAULT 'order'
        CHECK (source IN ('campaign', 'admin_grant', 'order')),
    campaign_id uuid,
    order_id text,
    expires_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_pricing_entitlements_user
    ON public.user_pricing_entitlements(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_pricing_entitlements_active_row
    ON public.user_pricing_entitlements(user_id, plan_key, billing, currency)
    WHERE revoked_at IS NULL;

COMMENT ON TABLE public.user_pricing_entitlements IS '用戶訂閱鎖價：subscription_term=本期快照；lifetime=牌價年付折扣％（list_discount_percent）';
COMMENT ON COLUMN public.user_pricing_entitlements.list_discount_percent IS '牌價年付折扣％（例：17 表示牌價少 17%%）；lifetime 續約依當下牌價重算';
COMMENT ON COLUMN public.user_pricing_entitlements.locked_amount IS 'subscription_term 本期成交快照（選填）；lifetime 請用 list_discount_percent';

ALTER TABLE public.user_pricing_entitlements ENABLE ROW LEVEL SECURITY;
