-- 台幣頁／美金頁付款開關分開。台幣頁預設關閉；美金頁沿用既有 payment_checkout_enabled。
INSERT INTO public.payment_config (key, value, updated_at)
VALUES ('payment_checkout_enabled_twd', '0', now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.payment_config (key, value, updated_at)
SELECT 'payment_checkout_enabled_usd', COALESCE(
  (SELECT value FROM public.payment_config WHERE key = 'payment_checkout_enabled' LIMIT 1),
  '0'
), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_config WHERE key = 'payment_checkout_enabled_usd'
);
