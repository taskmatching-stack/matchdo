-- 攝影模擬：camera_brand 改為「品牌色彩」種子（取代目的導向選項）
-- 已有 promo_camera_param_options 時執行（Supabase SQL Editor）

-- 1) 停用舊的「目的／質感」選項（避免下拉重複）
UPDATE public.promo_camera_param_options
SET is_active = false, updated_at = NOW()
WHERE category = 'camera_brand'
  AND key IN ('neutral_studio', 'warm_filmic', 'cinematic_log', 'vintage_rangefinder');

-- 2) 新增品牌色彩種子（僅色調／感測器科學，不含場景）
INSERT INTO public.promo_camera_param_options (category, key, name, name_en, prompt_fragment, description, meta, sort_order, is_active, is_default) VALUES
('camera_brand', 'sony_alpha', 'Sony Alpha', 'Sony Alpha',
 'Sony Alpha color science only: neutral accurate white balance, vivid but natural saturation, clean micro-contrast, typical Alpha sensor color response on product surfaces',
 'Sony 機身感測器色調：白平衡準、飽和自然、微對比乾淨。不含場景或光線。',
 '{}'::jsonb, 10, true, true),
('camera_brand', 'canon_eos', 'Canon EOS', 'Canon EOS',
 'Canon EOS color rendering only: slightly warm pleasing tones, smooth highlight rolloff, faithful product hue, classic Canon color bias without changing scene',
 'Canon 機身色彩：略暖、高光柔和、產品色忠實。不含場景或光線。',
 '{}'::jsonb, 20, true, false),
('camera_brand', 'nikon_z', 'Nikon Z', 'Nikon Z',
 'Nikon Z color science only: balanced neutral accuracy, faithful product color reproduction, moderate contrast, natural shadow color on materials',
 'Nikon 機身色彩：中性準確、產品色還原、對比適中。不含場景或光線。',
 '{}'::jsonb, 30, true, false),
('camera_brand', 'fujifilm_x', 'Fujifilm X', 'Fujifilm X',
 'Fujifilm X-Trans digital color character only: distinctive Fujifilm color response, rich controlled greens and reds, film-heritage digital palette, fine color separation on product textures',
 '富士 X 系色彩：富士特色色調、綠紅層次、胶片系數位調。不含場景或光線。',
 '{}'::jsonb, 40, true, false),
('camera_brand', 'leica_m', 'Leica', 'Leica',
 'Leica digital color rendering only: subtle micro-contrast, deep color transitions, restrained saturation, premium color depth on product edges and materials',
 'Leica 數位色彩：微對比、色調過渡細膩、飽和克制。不含場景或光線。',
 '{}'::jsonb, 50, true, false)
ON CONFLICT (category, key) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  prompt_fragment = EXCLUDED.prompt_fragment,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  is_default = EXCLUDED.is_default,
  updated_at = NOW();

-- 3) 確保只有一個 camera_brand 預設
UPDATE public.promo_camera_param_options SET is_default = false, updated_at = NOW()
WHERE category = 'camera_brand' AND key <> 'sony_alpha';
UPDATE public.promo_camera_param_options SET is_default = true, is_active = true, updated_at = NOW()
WHERE category = 'camera_brand' AND key = 'sony_alpha';

-- 4) 底片：移除 Cinestill 種子裡的場景／氛圍句（若已存在）
UPDATE public.promo_camera_param_options SET
  prompt_fragment = 'Cinestill 800T tungsten film color response only: cool shadow cast, halation on bright specular points, distinctive emulsion color bias without scene or lighting change',
  description = 'Cinestill 800T 钨丝灯负片色調：冷阴影、高光 halation。不含場景。',
  updated_at = NOW()
WHERE category = 'film_simulation' AND key = 'cinestill_800t';
