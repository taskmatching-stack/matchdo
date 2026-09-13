-- 清晰模式：是否啟用 Gemini → FLUX 自動備援（預設開啟）
INSERT INTO public.payment_config (key, value, updated_at)
VALUES ('promo_portrait_clear_flux_backup', '1', now())
ON CONFLICT (key) DO NOTHING;
