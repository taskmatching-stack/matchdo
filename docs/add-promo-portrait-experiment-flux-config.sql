-- 審核友善・階段一空景 FLUX 模型（對齊混合 bfl_flux_model_promo_portrait_hybrid）
-- payment_config key: bfl_flux_model_promo_portrait_experiment

INSERT INTO public.payment_config (key, value, updated_at)
VALUES
  ('bfl_flux_model_promo_portrait_experiment', 'flux-2-max', now())
ON CONFLICT (key) DO NOTHING;
