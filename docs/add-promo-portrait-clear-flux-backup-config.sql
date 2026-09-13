-- 清晰模式：Gemini 400 自動 FLUX 備援模型
-- payment_config key: bfl_flux_model_promo_portrait_clear

INSERT INTO public.payment_config (key, value, updated_at)
VALUES
  ('bfl_flux_model_promo_portrait_clear', 'flux-2-pro', now())
ON CONFLICT (key) DO NOTHING;
