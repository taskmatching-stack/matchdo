-- 商攝人像・混合模式獨立模型（與氛圍草稿分開）
-- gemini_model_promo_portrait_hybrid＝Banana 放入人物
-- bfl_flux_model_promo_portrait_hybrid＝FLUX 空景

INSERT INTO public.payment_config (key, value, updated_at)
VALUES
  ('gemini_model_promo_portrait_hybrid', 'gemini-3.1-flash-lite-image', now()),
  ('bfl_flux_model_promo_portrait_hybrid', 'flux-2-max', now())
ON CONFLICT (key) DO NOTHING;
