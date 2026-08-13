-- 商攝・空間平視（對照 ISO）FLUX.2 [max] 備援引擎與模型
-- payment_config 僅 key / value / updated_at
-- 引擎：auto＝Gemini 優先、滿額／429 備援 FLUX；gemini＝僅 Gemini；flux＝僅 FLUX
-- FLUX 槽獨立，預設 flux-2-max（可後台改 flux-2-pro 等）

INSERT INTO public.payment_config (key, value, updated_at)
VALUES
  ('promo_space_eye_level_engine', 'auto', now()),
  ('bfl_flux_model_promo_space_eye_level', 'flux-2-max', now())
ON CONFLICT (key) DO NOTHING;
