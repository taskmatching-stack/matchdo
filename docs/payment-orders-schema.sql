-- =============================================
-- 付款訂單表 payment_orders（點數儲值用）
-- 與 user_credits / credit_transactions 搭配
-- =============================================

DROP TABLE IF EXISTS public.payment_orders CASCADE;

CREATE TABLE public.payment_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id text NOT NULL UNIQUE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider text NOT NULL CHECK (provider IN ('ecpay', 'paypal')),
    amount integer NOT NULL,
    currency text NOT NULL DEFAULT 'TWD',
    credits_to_grant integer NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
    order_type text NOT NULL DEFAULT 'one_time' CHECK (order_type IN ('one_time', 'subscription', 'yearly')),
    metadata jsonb DEFAULT '{}'::jsonb,
    external_id text,
    raw_callback jsonb,
    created_at timestamptz DEFAULT now(),
    paid_at timestamptz
);

CREATE INDEX idx_payment_orders_user_id ON public.payment_orders(user_id);
CREATE INDEX idx_payment_orders_order_id ON public.payment_orders(order_id);
CREATE INDEX idx_payment_orders_status ON public.payment_orders(status);
CREATE INDEX idx_payment_orders_provider ON public.payment_orders(provider);

COMMENT ON TABLE public.payment_orders IS '點數儲值付款訂單（綠界／PayPal）';
COMMENT ON COLUMN public.payment_orders.order_id IS '本站訂單號（給金流顯示用，唯一）';
COMMENT ON COLUMN public.payment_orders.provider IS 'ecpay=綠界, paypal=PayPal';
COMMENT ON COLUMN public.payment_orders.credits_to_grant IS '付款成功後要入帳的點數';
COMMENT ON COLUMN public.payment_orders.external_id IS '金流方訂單/交易 ID';
COMMENT ON COLUMN public.payment_orders.order_type IS 'one_time=單次儲值, subscription=綠界月訂閱定期定額, yearly=年付一次';
COMMENT ON COLUMN public.payment_orders.metadata IS '例：yearly 時 { "plan_key": "tier2" }';

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payment orders" ON public.payment_orders;
CREATE POLICY "Users can view own payment orders"
    ON public.payment_orders FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all payment orders" ON public.payment_orders;
CREATE POLICY "Admins can view all payment orders"
    ON public.payment_orders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 寫入由後端 service role 執行，不需額外 INSERT/UPDATE policy（RLS 下 service role 可繞過）
