-- 混合／審核友善：第三階段光影融合（預設關閉，模型可後台改 pro/max/klein）
INSERT INTO public.payment_config (key, value, updated_at) VALUES
  ('promo_portrait_hybrid_stage3_enabled', '0', now()),
  ('promo_portrait_experiment_stage3_enabled', '0', now()),
  ('bfl_flux_model_promo_portrait_hybrid_stage3', 'flux-2-klein-9b', now()),
  ('bfl_flux_model_promo_portrait_experiment_stage3', 'flux-2-klein-9b', now())
ON CONFLICT (key) DO NOTHING;
