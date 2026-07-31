-- 攝影模擬：拍攝角度快捷選項（shooting_angle）
-- 已有 promo_camera_param_options 表時執行

ALTER TABLE public.promo_camera_param_options
  DROP CONSTRAINT IF EXISTS promo_camera_param_options_category_check;

ALTER TABLE public.promo_camera_param_options
  ADD CONSTRAINT promo_camera_param_options_category_check
  CHECK (category IN (
    'camera_brand', 'film_simulation', 'shooting_angle', 'aperture', 'exposure_ev',
    'lens', 'focal_length', 'lens_type', 'aperture_blades'
  ));

INSERT INTO public.promo_camera_param_options
  (category, key, name, name_en, prompt_fragment, description, meta, sort_order, is_active, is_default)
VALUES
('shooting_angle', 'keep_reference', '維持參考角度', 'Keep reference angle',
 'Preserve the reference image''s most complete product presentation viewpoint: keep the same camera angle, crop, and fully visible product geometry as shown — do not reshoot from a different angle or hide structural details visible in the reference',
 '維持參考圖中產品最完整的呈現視角，不另改拍攝角度。',
 '{}'::jsonb, 10, true, true),
('shooting_angle', 'hero_34', '45° 英雄角', 'Hero 3/4 angle',
 'Reshoot the same product at a hero three-quarter front angle: camera slightly above eye level, primary selling face clearly visible, fresh advertising crop — not the same pose as the reference',
 '同一產品改為 45° 英雄角，主視覺面清楚。',
 '{}'::jsonb, 20, true, false),
('shooting_angle', 'front', '正視', 'Front facing',
 'Reshoot the same product from a straight front-facing camera angle: symmetrical hero presentation, product centered, clear front design details',
 '同一產品改為正面對鏡頭。',
 '{}'::jsonb, 30, true, false),
('shooting_angle', 'side_profile', '側面', 'Side profile',
 'Reshoot the same product from a clean side profile angle: show thickness, silhouette, and edge design clearly',
 '同一產品改為側面輪廓。',
 '{}'::jsonb, 40, true, false),
('shooting_angle', 'top_down', '俯拍', 'Top down',
 'Reshoot the same product from a top-down camera angle: flat lay style product presentation while keeping the product recognizable',
 '同一產品改為俯拍／平拍視角。',
 '{}'::jsonb, 50, true, false),
('shooting_angle', 'low_angle', '低角度', 'Low angle',
 'Reshoot the same product from a low camera angle looking upward: imposing hero presence, product dominates the frame',
 '同一產品改為低角度仰拍。',
 '{}'::jsonb, 60, true, false),
('shooting_angle', 'back_34', '後 3/4', 'Rear 3/4',
 'Reshoot the same product from a rear three-quarter angle: show back design and form while keeping brand identity readable',
 '同一產品改為後 3/4 角度。',
 '{}'::jsonb, 70, true, false)
ON CONFLICT (category, key) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  prompt_fragment = EXCLUDED.prompt_fragment,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  is_default = EXCLUDED.is_default,
  updated_at = NOW();

UPDATE public.promo_camera_param_options SET is_default = false, updated_at = NOW()
WHERE category = 'shooting_angle' AND key <> 'keep_reference';
UPDATE public.promo_camera_param_options SET is_default = true, is_active = true, updated_at = NOW()
WHERE category = 'shooting_angle' AND key = 'keep_reference';
