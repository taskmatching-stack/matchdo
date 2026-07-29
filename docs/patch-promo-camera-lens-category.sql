-- 攝影模擬：新增 lens 分類（依鏡頭類型分組，非僅焦段）
-- 已有 promo_camera_param_options 表時執行

ALTER TABLE public.promo_camera_param_options
  DROP CONSTRAINT IF EXISTS promo_camera_param_options_category_check;

ALTER TABLE public.promo_camera_param_options
  ADD CONSTRAINT promo_camera_param_options_category_check
  CHECK (category IN (
    'camera_brand', 'film_simulation', 'aperture', 'exposure_ev',
    'lens', 'focal_length', 'lens_type', 'aperture_blades'
  ));

-- 停用 legacy 焦段／鏡頭類型（改由 lens 一欄位）
UPDATE public.promo_camera_param_options
SET is_active = false, is_default = false, updated_at = NOW()
WHERE category IN ('focal_length', 'lens_type');

-- 鏡頭 profile（meta.group＝鏡頭類型；prompt 含焦段＋光學個性）
INSERT INTO public.promo_camera_param_options
  (category, key, name, name_en, prompt_fragment, description, meta, sort_order, is_active, is_default)
VALUES
('lens', 'std_35', '35mm 標準定焦', '35mm standard prime',
 '35mm standard prime lens optical character only: natural perspective, clean sharpness across the frame, minimal distortion on product edges',
 '標準定焦・35mm：帶環境的產品透視，邊緣畸變小。',
 '{"group":"標準定焦"}'::jsonb, 10, true, false),
('lens', 'std_50', '50mm 標準定焦', '50mm standard prime',
 '50mm standard prime lens optical character only: natural eye-level perspective, even sharpness, neutral rendering for product hero shots',
 '標準定焦・50mm：最接近人眼，常用商品 Hero 鏡頭。',
 '{"group":"標準定焦"}'::jsonb, 20, true, true),
('lens', 'portrait_85', '85mm 人像定焦', '85mm portrait prime',
 '85mm portrait prime lens optical character only: flattering compression, smooth bokeh falloff, strong subject-background separation',
 '人像定焦・85mm：背景壓縮、虚化平滑，主體突出。',
 '{"group":"人像定焦"}'::jsonb, 30, true, false),
('lens', 'portrait_135', '135mm 人像定焦', '135mm portrait tele',
 '135mm portrait telephoto lens optical character only: strong background compression, creamy bokeh, isolated product hero framing',
 '人像定焦・135mm：強壓縮、奶油虚化，特寫型主視覺。',
 '{"group":"人像定焦"}'::jsonb, 40, true, false),
('lens', 'macro_60', '60mm 微距', '60mm macro',
 '60mm macro lens optical character only: high magnification detail on product surfaces, flat field focus on selling features, minimal perspective distortion',
 '微距・60mm：表面紋理／Logo 細節清晰。',
 '{"group":"微距鏡頭"}'::jsonb, 50, true, false),
('lens', 'macro_100', '100mm 微距', '100mm macro',
 '100mm macro lens optical character only: extreme surface detail clarity, working distance for small products, precise focus on textures and logos',
 '微距・100mm：更高倍率細節，小物體工作距離佳。',
 '{"group":"微距鏡頭"}'::jsonb, 60, true, false),
('lens', 'vintage_50', '50mm 老鏡頭', '50mm vintage glass',
 '50mm vintage lens optical character only: subtle flare, softer corners, organic bokeh, classic glass imperfections without changing scene',
 '老鏡頭・50mm：柔角、有机虚化、轻微耀光。',
 '{"group":"老鏡頭"}'::jsonb, 70, true, false),
('lens', 'vintage_85', '85mm 老鏡頭', '85mm vintage portrait',
 '85mm vintage portrait lens optical character only: gentle glow, swirly bokeh tendency, lower micro-contrast, nostalgic glass rendering',
 '老鏡頭・85mm：旋焦倾向、低微对比、怀旧感。',
 '{"group":"老鏡頭"}'::jsonb, 80, true, false),
('lens', 'tilt_45', '45mm 移軸', '45mm tilt-shift',
 '45mm tilt-shift lens optical character only: controlled plane of focus, miniature-product emphasis, selective sharpness on product plane',
 '移轴・45mm：選擇性焦平面，適合強調產品平面。',
 '{"group":"移轴／特效"}'::jsonb, 90, true, false)
ON CONFLICT (category, key) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  prompt_fragment = EXCLUDED.prompt_fragment,
  description = EXCLUDED.description,
  meta = EXCLUDED.meta,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  is_default = EXCLUDED.is_default,
  updated_at = NOW();

UPDATE public.promo_camera_param_options SET is_default = false, updated_at = NOW()
WHERE category = 'lens' AND key <> 'std_50';
UPDATE public.promo_camera_param_options SET is_default = true, is_active = true, updated_at = NOW()
WHERE category = 'lens' AND key = 'std_50';
