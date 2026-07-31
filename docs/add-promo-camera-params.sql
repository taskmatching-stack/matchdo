-- 攝影模擬・相機參數選項 + product_promo_generations 擴欄
-- 執行：Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.promo_camera_param_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN (
        'camera_brand', 'film_simulation', 'shooting_angle', 'aperture', 'exposure_ev',
        'lens', 'focal_length', 'lens_type', 'aperture_blades'
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

-- 種子：camera_brand＝機身品牌色彩科學（不含場景／光線，避免與左側主題場景打架）
INSERT INTO public.promo_camera_param_options (category, key, name, name_en, prompt_fragment, sort_order, is_default) VALUES
('camera_brand', 'sony_alpha', 'Sony Alpha', 'Sony Alpha',
 'Sony Alpha color science only: neutral accurate white balance, vivid but natural saturation, clean micro-contrast, typical Alpha sensor color response on product surfaces', 10, true),
('camera_brand', 'canon_eos', 'Canon EOS', 'Canon EOS',
 'Canon EOS color rendering only: slightly warm pleasing tones, smooth highlight rolloff, faithful product hue, classic Canon color bias without changing scene', 20, false),
('camera_brand', 'nikon_z', 'Nikon Z', 'Nikon Z',
 'Nikon Z color science only: balanced neutral accuracy, faithful product color reproduction, moderate contrast, natural shadow color on materials', 30, false),
('camera_brand', 'fujifilm_x', 'Fujifilm X', 'Fujifilm X',
 'Fujifilm X-Trans digital color character only: distinctive Fujifilm color response, rich controlled greens and reds, film-heritage digital palette, fine color separation on product textures', 40, false),
('camera_brand', 'leica_m', 'Leica', 'Leica',
 'Leica digital color rendering only: subtle micro-contrast, deep color transitions, restrained saturation, premium color depth on product edges and materials', 50, false),

('film_simulation', 'portra_400', 'Portra 400 風', 'Portra 400 style',
 'Kodak Portra 400 film emulation: warm natural tones, fine grain, flattering highlight rolloff', 10, true),
('film_simulation', 'ektar_100', 'Ektar 100 風', 'Ektar 100 style',
 'Kodak Ektar 100 style: vivid but controlled saturation, crisp detail, fine grain', 20, false),
('film_simulation', 'tri_x_400', 'Tri-X 400 風', 'Tri-X 400 style',
 'Ilford Tri-X 400 black-and-white film look: rich monochrome tones, classic grain, strong subject separation', 30, false),
('film_simulation', 'provia_slide', 'Provia 正片風', 'Provia slide style',
 'Fuji Provia slide-film style: clean color, punchy but natural saturation, transparent highlights', 40, false),
('film_simulation', 'cinestill_800t', 'Cinestill 800T 風', 'Cinestill 800T style',
 'Cinestill 800T tungsten film color response only: cool shadow cast, halation on bright specular points, distinctive emulsion color bias without scene or lighting change', 50, false),

('shooting_angle', 'keep_reference', '維持參考角度', 'Keep reference angle',
 'Preserve the reference image''s most complete product presentation viewpoint: keep the same camera angle, crop, and fully visible product geometry as shown — do not reshoot from a different angle or hide structural details visible in the reference', 10, true),
('shooting_angle', 'hero_34', '45° 英雄角', 'Hero 3/4 angle',
 'Reshoot the same product at a hero three-quarter front angle: camera slightly above eye level, primary selling face clearly visible, fresh advertising crop — not the same pose as the reference', 20, false),
('shooting_angle', 'front', '正視', 'Front facing',
 'Reshoot the same product from a straight front-facing camera angle: symmetrical hero presentation, product centered, clear front design details', 30, false),
('shooting_angle', 'side_profile', '側面', 'Side profile',
 'Reshoot the same product from a clean side profile angle: show thickness, silhouette, and edge design clearly', 40, false),
('shooting_angle', 'top_down', '俯拍', 'Top down',
 'Reshoot the same product from a top-down camera angle: flat lay style product presentation while keeping the product recognizable', 50, false),
('shooting_angle', 'low_angle', '低角度', 'Low angle',
 'Reshoot the same product from a low camera angle looking upward: imposing hero presence, product dominates the frame', 60, false),
('shooting_angle', 'back_34', '後 3/4', 'Rear 3/4',
 'Reshoot the same product from a rear three-quarter angle: show back design and form while keeping brand identity readable', 70, false),

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

('lens', 'std_35', '35mm 標準定焦', '35mm standard prime',
 '35mm standard prime lens optical character only: natural perspective, clean sharpness across the frame, minimal distortion on product edges', 10, false),
('lens', 'std_50', '50mm 標準定焦', '50mm standard prime',
 '50mm standard prime lens optical character only: natural eye-level perspective, even sharpness, neutral rendering for product hero shots', 20, true),
('lens', 'portrait_85', '85mm 人像定焦', '85mm portrait prime',
 '85mm portrait prime lens optical character only: flattering compression, smooth bokeh falloff, strong subject-background separation', 30, false),
('lens', 'portrait_135', '135mm 人像定焦', '135mm portrait tele',
 '135mm portrait telephoto lens optical character only: strong background compression, creamy bokeh, isolated product hero framing', 40, false),
('lens', 'macro_60', '60mm 微距', '60mm macro',
 '60mm macro lens optical character only: high magnification detail on product surfaces, flat field focus on selling features, minimal perspective distortion', 50, false),
('lens', 'macro_100', '100mm 微距', '100mm macro',
 '100mm macro lens optical character only: extreme surface detail clarity, working distance for small products, precise focus on textures and logos', 60, false),
('lens', 'vintage_50', '50mm 老鏡頭', '50mm vintage glass',
 '50mm vintage lens optical character only: subtle flare, softer corners, organic bokeh, classic glass imperfections without changing scene', 70, false),
('lens', 'vintage_85', '85mm 老鏡頭', '85mm vintage portrait',
 '85mm vintage portrait lens optical character only: gentle glow, swirly bokeh tendency, lower micro-contrast, nostalgic glass rendering', 80, false),
('lens', 'tilt_45', '45mm 移軸', '45mm tilt-shift',
 '45mm tilt-shift lens optical character only: controlled plane of focus, miniature-product emphasis, selective sharpness on product plane', 90, false),

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
