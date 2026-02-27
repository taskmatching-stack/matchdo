-- 後台金流設定（管理員在後台填寫，上線後可自行更換正式帳號）
-- 優先於 .env；未填寫的欄位仍從環境變數讀取

CREATE TABLE IF NOT EXISTS public.payment_config (
    key text PRIMARY KEY,
    value text,
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.payment_config IS '金流設定 key-value（ECPay / PayPal），僅後台寫入、後端讀取';

-- 建議 key：ecpay_merchant_id, ecpay_hash_key, ecpay_hash_iv, ecpay_use_production, paypal_client_id, paypal_client_secret, paypal_sandbox

ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only service role or admin can read payment_config" ON public.payment_config;
CREATE POLICY "Only service role or admin can read payment_config"
    ON public.payment_config FOR SELECT
    USING (
        auth.role() = 'service_role'
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Only admin can modify payment_config" ON public.payment_config;
CREATE POLICY "Only admin can modify payment_config"
    ON public.payment_config FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
