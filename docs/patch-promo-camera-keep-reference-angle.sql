-- 攝影模擬：維持參考角度（keep_reference）prompt 調整
-- 僅更新此選項；其他 shooting_angle 不變

UPDATE public.promo_camera_param_options
SET
  prompt_fragment = 'Preserve the reference image''s most complete product presentation viewpoint: keep the same camera angle, crop, and fully visible product geometry as shown — do not reshoot from a different angle or hide structural details visible in the reference',
  description = '維持參考圖中產品最完整的呈現視角，不另改拍攝角度。',
  updated_at = NOW()
WHERE category = 'shooting_angle' AND key = 'keep_reference';
