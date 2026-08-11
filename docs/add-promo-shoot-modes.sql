-- 商攝導演：拍攝模式（人像 8 主題 audience + seed）
-- 執行：Supabase SQL Editor

ALTER TABLE public.promo_scene_templates
    ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'product';

UPDATE public.promo_scene_templates
SET audience = 'all'
WHERE slot = 'scene';

INSERT INTO public.promo_scene_templates (key, name, name_en, description, scene_prompt, composition_hint, category, sort_order, slot, audience, is_active)
VALUES
  ('portrait_corporate', '商業形象', 'Corporate portrait', '專業可信的商業人像',
   'professional corporate portrait photography, trustworthy expression, clean background, business lighting',
   'commercial headshot or half-body; professional campaign quality', 'portrait', 110, 'theme', 'portrait', true),
  ('portrait_fashion_lookbook', '時尚型錄', 'Fashion lookbook', '編輯時尚型錄人像',
   'editorial fashion lookbook portrait, garment lines visible, fashion campaign composition',
   'lookbook framing; apparel and styling readable', 'portrait', 120, 'theme', 'portrait', true),
  ('portrait_lifestyle', '生活情境', 'Lifestyle', '自然敘事生活人像',
   'natural lifestyle portrait photography, narrative everyday environment, authentic mood',
   'lifestyle story framing; approachable and real', 'portrait', 130, 'theme', 'portrait', true),
  ('portrait_sports', '運動', 'Sports', '動感運動人像',
   'dynamic sports portrait photography, athletic energy, studio or action context',
   'athletic campaign energy; subject power and motion', 'portrait', 140, 'theme', 'portrait', true),
  ('portrait_beauty', '美妝', 'Beauty', '美妝膚質人像',
   'beauty portrait photography, skin texture and makeup detail, soft beauty lighting',
   'beauty campaign close-up or beauty half-body', 'portrait', 150, 'theme', 'portrait', true),
  ('portrait_formal_id', '證件／正式肖像', 'Formal ID portrait', '正式證件感肖像',
   'formal ID-style portrait, front-facing, even lighting, plain background, formal posture',
   'official portrait framing; neutral background', 'portrait', 160, 'theme', 'portrait', true),
  ('portrait_brand_image', '品牌形象', 'Brand image', '品牌 campaign 人像',
   'premium brand image portrait, campaign consistency, elevated commercial mood',
   'brand campaign hero portrait', 'portrait', 170, 'theme', 'portrait', true),
  ('portrait_social_content', '社群內容', 'Social content', '社群友善人像',
   'engaging social media portrait, vertical-friendly framing, approachable expression',
   'social content portrait; friendly and shareable', 'portrait', 180, 'theme', 'portrait', true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  scene_prompt = EXCLUDED.scene_prompt,
  composition_hint = EXCLUDED.composition_hint,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  slot = EXCLUDED.slot,
  audience = EXCLUDED.audience,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
