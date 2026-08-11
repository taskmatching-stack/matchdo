-- 商攝・空間攝影 Gemini 模型與點數（layout_plan / eye_level）

-- payment_config 僅 key / value / updated_at（見 docs/payment-config-schema.sql）

--

-- 生圖 API：generateContent + config.imageConfig（@google/genai）

--   imageSize: "2K" | "4K"（K 須大寫，官方拒絕 2k/4k）

--   aspectRatio: 見 lib/promo-space-gemini.js GEMINI_SUPPORTED_ASPECT_RATIOS

-- 文件：https://ai.google.dev/gemini-api/docs/image-generation

-- 模型：https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image

INSERT INTO public.payment_config (key, value, updated_at)

VALUES

  ('gemini_model_promo_space_layout', 'gemini-3-pro-image', now()),

  ('gemini_model_promo_space_eye_level', 'gemini-3-pro-image', now()),

  ('points_promo_space_layout_gemini', '30', now()),

  ('points_promo_space_eye_level_gemini', '30', now()),

  ('points_promo_space_layout_gemini_4k', '50', now()),

  ('points_promo_space_eye_level_gemini_4k', '50', now()),

  ('promo_space_output_min', '2K', now())

ON CONFLICT (key) DO UPDATE

SET value = EXCLUDED.value,

    updated_at = EXCLUDED.updated_at;

