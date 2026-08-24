-- 商攝人像・氛圍兩段順序（對照實驗）
-- lite_then_flux＝現行（Lite 草稿 → FLUX 氛圍）
-- flux_then_lite＝實驗（FLUX 場景底圖 → Lite 修臉）
-- 後台 /admin/ai-settings.html 人像氛圍卡片可切換；前台不顯示模型名稱

INSERT INTO public.payment_config (key, value, updated_at)
VALUES
  ('promo_portrait_mood_pipeline', 'lite_then_flux', now())
ON CONFLICT (key) DO NOTHING;
