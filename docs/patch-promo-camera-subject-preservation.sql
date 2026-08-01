-- 攝影模擬：是否保留源圖人物／動物（追加 FLUX prompt 片段）
-- 已有 promo_camera_param_categories / promo_camera_param_options 時執行（Supabase SQL Editor）

ALTER TABLE public.promo_camera_param_options
  DROP CONSTRAINT IF EXISTS promo_camera_param_options_category_check;

INSERT INTO public.promo_camera_param_categories (key, name, name_en, sort_order, meta) VALUES
('subject_preservation', '人物／動物', 'People & animals', 35,
 '{"ui_type":"hidden","preset_bar_only":true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  sort_order = EXCLUDED.sort_order,
  meta = EXCLUDED.meta,
  updated_at = NOW();

INSERT INTO public.promo_camera_param_options (category, key, name, name_en, description, description_en, prompt_fragment, sort_order, is_default) VALUES
('subject_preservation', 'keep', '保留', 'Keep',
 '若源圖有人物、手、寵物或動物，輸出時保留其角色與產品的空間關係。',
 'If the reference shows people, hands, pets, or animals, preserve them with the same spatial relationship to the product.',
 'If the reference image includes people, hands, body parts, pets, or animals interacting with or near the product, preserve them faithfully in the output with the same roles, poses, and spatial relationship to the product; do not remove, replace, or invent new human or animal subjects',
 10, true),
('subject_preservation', 'exclude', '不含', 'None',
 '輸出僅保留產品與中性環境，移除源圖中的人物、手、寵物或動物。',
 'Show only the product and neutral environment; remove any people, hands, pets, or animals from the reference.',
 'Do not include people, hands, body parts, pets, or animals from the reference image in the output; show only the product and an appropriate neutral environment; remove any human or animal subjects even if they appear in the reference',
 20, false),
('subject_preservation', 'prompt', '依提示詞', 'From prompt',
 '不複製源圖人物或動物；若描述中有寫人物／動物，才依提示詞全新創作。',
 'Do not copy people or animals from the reference; include human or animal subjects only when explicitly described in your prompt, composed freshly.',
 'Do not copy people, hands, body parts, pets, or animals from the reference image; omit any human or animal subjects from the reference unless the user prompt explicitly describes new people or animals to include, in which case compose those subjects freshly according to the prompt rather than copying the reference subjects',
 30, false)
ON CONFLICT (category, key) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  description_en = EXCLUDED.description_en,
  prompt_fragment = EXCLUDED.prompt_fragment,
  sort_order = EXCLUDED.sort_order,
  is_default = EXCLUDED.is_default,
  updated_at = NOW();
