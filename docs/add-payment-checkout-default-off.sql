-- 預設關閉前台付款；儲值預設方案（台幣／美金／點數）
INSERT INTO public.payment_config (key, value, updated_at)
VALUES ('payment_checkout_enabled', '0', now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.payment_config (key, value, updated_at)
VALUES (
  'topup_presets',
  '[{"twd":300,"usd":11,"credits":330},{"twd":900,"usd":33,"credits":1100},{"twd":1800,"usd":66,"credits":2400}]',
  now()
)
ON CONFLICT (key) DO NOTHING;
