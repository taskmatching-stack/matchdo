-- 攝影模擬・相機參數選項 + product_promo_generations 擴欄
-- 執行：Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.promo_camera_param_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN (
        'camera_brand', 'film_simulation', 'aperture', 'exposure_ev',
        'focal_length', 'lens_type', 'aperture_blades'
    )),
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    name_en TEXT,
    prompt_fragment TEXT NOT NULL DEFAULT '',
    description TEXT,
    meta JSONB NOT NULL DEFAULT '{}',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category, key)
);

CREATE INDEX IF NOT EXISTS idx_promo_camera_param_cat_sort
    ON public.promo_camera_param_options (category, sort_order, key);
CREATE INDEX IF NOT EXISTS idx_promo_camera_param_active
    ON public.promo_camera_param_options (is_active);

COMMENT ON TABLE public.promo_camera_param_options IS '攝影模擬控制台：各維度 FLUX prompt 片段（管理區可編）';
COMMENT ON COLUMN public.promo_camera_param_options.prompt_fragment IS '英文片段，追加於情境圖 prompt 的相機光學區塊';

ALTER TABLE public.promo_camera_param_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for promo_camera_param_options" ON public.promo_camera_param_options;
CREATE POLICY "Allow all for promo_camera_param_options"
    ON public.promo_camera_param_options FOR ALL USING (true);

ALTER TABLE public.product_promo_generations
    ADD COLUMN IF NOT EXISTS generation_mode TEXT NOT NULL DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS camera_params JSONB;

COMMENT ON COLUMN public.product_promo_generations.generation_mode IS 'standard=情境圖TAB；camera_advanced=攝影模擬頁';

-- 種子：各維度 prompt 片段由後台編輯；數位成像 vs 底片模擬前台僅擇一
INSERT INTO public.promo_camera_param_options (category, key, name, name_en, prompt_fragment, sort_order, is_default) VALUES
('camera_brand', 'neutral_studio', '中性棚拍', 'Neutral studio',
 'Clean neutral digital color science: accurate white balance, moderate contrast, natural product tones', 10, true),
('camera_brand', 'warm_filmic', '暖調電影數位', 'Warm filmic digital',
 'Warm cinematic digital color: gentle orange shadows, soft highlight rolloff, premium advertising grade', 20, false),
('camera_brand', 'cinematic_log', '電影 LOG 調', 'Cinematic LOG grade',
 'Cinematic LOG-style color grade: rich shadows, controlled highlights, filmic contrast curve suitable for hero product ads', 30, false),
('camera_brand', 'vintage_rangefinder', '復古旁軸調', 'Vintage rangefinder tone',
 'Vintage rangefinder rendering: subtle micro-contrast, gentle vignette, classic photographic color', 40, false),

('film_simulation', 'portra_400', 'Portra 400 風', 'Portra 400 style',
 'Kodak Portra 400 film emulation: warm natural tones, fine grain, flattering highlight rolloff', 10, true),
('film_simulation', 'ektar_100', 'Ektar 100 風', 'Ektar 100 style',
 'Kodak Ektar 100 style: vivid but controlled saturation, crisp detail, fine grain', 20, false),
('film_simulation', 'tri_x_400', 'Tri-X 400 風', 'Tri-X 400 style',
 'Ilford Tri-X 400 black-and-white film look: rich monochrome tones, classic grain, strong subject separation', 30, false),
('film_simulation', 'provia_slide', 'Provia 正片風', 'Provia slide style',
 'Fuji Provia slide-film style: clean color, punchy but natural saturation, transparent highlights', 40, false),
('film_simulation', 'cinestill_800t', 'Cinestill 800T 風', 'Cinestill 800T style',
 'Cinestill 800T tungsten film look: cool shadows, halation around bright points, cinematic night-adjacent mood', 50, false),

('aperture', 'f14', 'f/1.4 大光圈', 'f/1.4',
 'Shot at f/1.4: very shallow depth of field, strong background blur, subject isolation', 10, false),
('aperture', 'f28', 'f/2.8', 'f/2.8',
 'Shot at f/2.8: moderate shallow depth of field, subject sharp with softly blurred background', 20, true),
('aperture', 'f56', 'f/5.6', 'f/5.6',
 'Shot at f/5.6: balanced depth of field, product and near environment reasonably sharp', 30, false),
('aperture', 'f11', 'f/11 小光圈', 'f/11',
 'Shot at f/11: deep depth of field, product and environment details stay sharp', 40, false),

('exposure_ev', 'ev_m2', 'EV -2', 'EV -2',
 'Exposure bias EV -2: darker moody exposure, deeper shadows, restrained highlights', 10, false),
('exposure_ev', 'ev_m1', 'EV -1', 'EV -1',
 'Exposure bias EV -1: slightly underexposed cinematic mood', 20, false),
('exposure_ev', 'ev0', 'EV 0', 'EV 0',
 'Neutral exposure EV 0: balanced brightness for commercial product advertising', 30, true),
('exposure_ev', 'ev_p1', 'EV +1', 'EV +1',
 'Exposure bias EV +1: bright airy commercial look with lifted shadows', 40, false),
('exposure_ev', 'ev_p2', 'EV +2', 'EV +2',
 'Exposure bias EV +2: high-key bright advertising exposure', 50, false),

('focal_length', 'mm35', '35mm 標準定焦', '35mm standard prime',
 '35mm equivalent standard prime lens: environmental context with natural perspective, clean sharpness, minimal distortion', 10, false),
('focal_length', 'mm50', '50mm 標準定焦', '50mm standard prime',
 '50mm equivalent standard prime lens: natural human-eye perspective for product hero shots, clean sharpness', 20, true),
('focal_length', 'mm85', '85mm 人像定焦', '85mm portrait prime',
 '85mm equivalent portrait prime lens: flattering compression, smooth bokeh transitions, subject-background separation', 30, false),
('focal_length', 'mm135', '135mm 望遠定焦', '135mm tele prime',
 '135mm equivalent telephoto prime lens: strong background compression and product isolation', 40, false),

('lens_type', 'standard_prime', '標準定焦（legacy）', 'Standard prime',
 'Modern standard prime lens rendering: clean sharpness, minimal distortion', 10, true),
('lens_type', 'portrait_prime', '人像定焦', 'Portrait prime',
 'Portrait prime lens: smooth bokeh transitions, gentle background falloff', 20, false),
('lens_type', 'macro_lens', '微距鏡頭', 'Macro lens',
 'Macro lens character: extreme product detail clarity on primary selling surfaces', 30, false),
('lens_type', 'vintage_glass', '老鏡頭', 'Vintage glass',
 'Vintage lens character: subtle flare, softer corners, organic bokeh', 40, false),

('aperture_blades', 'blades5', '5 片', '5 blades',
 'Five-blade aperture iris: pentagonal bokeh highlights and distinct flare character', 10, false),
('aperture_blades', 'blades7', '7 片', '7 blades',
 'Seven-blade aperture iris: heptagonal bokeh with moderate highlight shape', 20, false),
('aperture_blades', 'blades9', '9 片', '9 blades',
 'Nine-blade aperture iris: round smooth bokeh highlights, gentle lens flare', 30, true),
('aperture_blades', 'blades11', '11 片', '11 blades',
 'Eleven-blade aperture iris: very round bokeh circles, premium cinematic flare', 40, false)
ON CONFLICT (category, key) DO NOTHING;

-- 情境圖固定點數（payment_config）
INSERT INTO public.payment_config (key, value, updated_at)
VALUES
    ('points_promo_image_standard', '20', NOW()),
    ('points_promo_image_subscriber', '15', NOW()),
    ('points_promo_camera_standard', '20', NOW()),
    ('points_promo_camera_subscriber', '10', NOW()),
    ('points_promo_camera_per_extra_mp', '10', NOW())
ON CONFLICT (key) DO NOTHING;
