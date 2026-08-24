-- 商攝・規劃模擬（空間圖 + 家具／陳設圖，Nano Banana 2）
-- payment_config：模型與點數；後台 /admin/ai-settings.html、/admin/membership.html 可改

INSERT INTO public.payment_config (key, value, updated_at)
VALUES
  ('gemini_model_promo_planning_sim', 'gemini-3.1-flash-image', now()),
  ('points_promo_planning_sim', '20', now())
ON CONFLICT (key) DO NOTHING;
