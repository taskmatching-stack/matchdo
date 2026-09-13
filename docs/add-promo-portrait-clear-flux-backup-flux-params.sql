-- 清晰模式 FLUX 備援：safety_tolerance 與 prompt upsampling（提示詞改寫）
INSERT INTO public.payment_config (key, value, updated_at)
VALUES
  ('promo_portrait_clear_flux_safety_tolerance', '5', now()),
  ('promo_portrait_clear_flux_prompt_upsampling', '0', now())
ON CONFLICT (key) DO NOTHING;
