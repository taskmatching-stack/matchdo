-- Embed 付費方案分級（300 / 900 / 1800）與實例媒體牆設定
-- 執行：Supabase SQL Editor（需已跑 add-embed-simulator-schema.sql）

-- 僅付費方案（300/900/1800）開通 embed；免費關閉
UPDATE public.subscription_plans
SET embed_enabled = false
WHERE COALESCE(price, 0) = 0;

UPDATE public.subscription_plans
SET embed_enabled = true
WHERE price IN (300, 900, 1800);

UPDATE public.subscription_plans SET plan_key = '300' WHERE price = 300 AND (plan_key IS NULL OR plan_key = '' OR plan_key = 'tier2');
UPDATE public.subscription_plans SET plan_key = '900' WHERE price = 900 AND (plan_key IS NULL OR plan_key = '' OR plan_key = 'tier3');
UPDATE public.subscription_plans SET plan_key = '1800' WHERE price = 1800 AND (plan_key IS NULL OR plan_key = '' OR plan_key = 'tier4');

ALTER TABLE public.manufacturer_embed_instances
ADD COLUMN IF NOT EXISTS show_on_media_wall boolean DEFAULT true;

COMMENT ON COLUMN public.manufacturer_embed_instances.show_on_media_wall IS '1800 方案可設：embed 成圖是否上首頁媒體牆；300/900 後端仍強制上牆';

ALTER TABLE public.vendor_embed_designs
ADD COLUMN IF NOT EXISTS custom_product_id uuid REFERENCES public.custom_products(id) ON DELETE SET NULL;

ALTER TABLE public.vendor_embed_designs
ADD COLUMN IF NOT EXISTS source text DEFAULT 'embed';

COMMENT ON COLUMN public.vendor_embed_designs.source IS '固定 embed：訪客 iframe 生圖（非廠商自產）';

ALTER TABLE public.vendor_embed_designs DROP CONSTRAINT IF EXISTS vendor_embed_designs_billing_type_check;
ALTER TABLE public.vendor_embed_designs ADD CONSTRAINT vendor_embed_designs_billing_type_check
  CHECK (billing_type IN ('plan_quota', 'credit_overage', 'credit_points'));

NOTIFY pgrst, 'reload schema';
