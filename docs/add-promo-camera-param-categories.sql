-- 攝影模擬：參數分類（後台可增刪改，對齊訂製品分類多語系）
-- 已有 promo_camera_param_options 時執行

CREATE TABLE IF NOT EXISTS public.promo_camera_param_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_en TEXT,
    name_ja TEXT,
    name_es TEXT,
    name_de TEXT,
    name_fr TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    meta JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_camera_param_categories_sort
    ON public.promo_camera_param_categories (sort_order, key);
CREATE INDEX IF NOT EXISTS idx_promo_camera_param_categories_active
    ON public.promo_camera_param_categories (is_active);

COMMENT ON TABLE public.promo_camera_param_categories IS '攝影模擬參數分類（後台管理；options.category 對應 key）';
COMMENT ON COLUMN public.promo_camera_param_categories.meta IS 'ui_type=dropdown|angle_buttons|hidden；groupable；exclusive_group*；lens_primary';

ALTER TABLE public.promo_camera_param_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for promo_camera_param_categories" ON public.promo_camera_param_categories;
CREATE POLICY "Allow all for promo_camera_param_categories"
    ON public.promo_camera_param_categories FOR ALL USING (true);

-- 移除 options.category 硬編碼 CHECK（改由分類表管理）
ALTER TABLE public.promo_camera_param_options
  DROP CONSTRAINT IF EXISTS promo_camera_param_options_category_check;

ALTER TABLE public.promo_camera_param_options
  ADD COLUMN IF NOT EXISTS description_en TEXT;

COMMENT ON COLUMN public.promo_camera_param_options.description_en IS '前台提示（英文），lang=en 時使用';

INSERT INTO public.promo_camera_param_categories (key, name, name_en, sort_order, meta) VALUES
('camera_brand', '品牌色彩', 'Brand color', 10,
 '{"ui_type":"dropdown","exclusive_group":"look","exclusive_group_order":0,"exclusive_group_label":"成像來源","exclusive_group_label_en":"Look"}'::jsonb),
('film_simulation', '底片模擬', 'Film simulation', 20,
 '{"ui_type":"dropdown","groupable":true,"exclusive_group":"look","exclusive_group_order":1,"exclusive_group_label":"成像來源","exclusive_group_label_en":"Look"}'::jsonb),
('shooting_angle', '拍攝角度', 'Shooting angle', 30,
 '{"ui_type":"angle_buttons"}'::jsonb),
('aperture', '光圈', 'Aperture', 40, '{"ui_type":"dropdown"}'::jsonb),
('exposure_ev', 'EV 曝光', 'Exposure EV', 50, '{"ui_type":"dropdown"}'::jsonb),
('lens', '鏡頭', 'Lens', 60, '{"ui_type":"dropdown","groupable":true,"lens_primary":true}'::jsonb),
('aperture_blades', '光圈葉片', 'Aperture blades', 70, '{"ui_type":"dropdown"}'::jsonb),
('focal_length', '焦段（legacy）', 'Focal length (legacy)', 90, '{"ui_type":"hidden"}'::jsonb),
('lens_type', '鏡頭類型（legacy）', 'Lens type (legacy)', 91, '{"ui_type":"hidden"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  sort_order = EXCLUDED.sort_order,
  meta = EXCLUDED.meta,
  updated_at = NOW();
