-- 攝影參數組多語系欄位（對齊 promo_scene_templates / remake_categories）
-- 執行：Supabase SQL Editor（請先已有 photography_prompt_sets 表）

ALTER TABLE public.photography_prompt_sets ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.photography_prompt_sets ADD COLUMN IF NOT EXISTS name_ja TEXT;
ALTER TABLE public.photography_prompt_sets ADD COLUMN IF NOT EXISTS name_es TEXT;
ALTER TABLE public.photography_prompt_sets ADD COLUMN IF NOT EXISTS name_de TEXT;
ALTER TABLE public.photography_prompt_sets ADD COLUMN IF NOT EXISTS name_fr TEXT;

COMMENT ON COLUMN public.photography_prompt_sets.name_en IS '顯示名稱（英文），前台 lang=en 時使用';
COMMENT ON COLUMN public.photography_prompt_sets.name_ja IS '顯示名稱（日文），預留';
COMMENT ON COLUMN public.photography_prompt_sets.name_es IS '顯示名稱（西班牙文），預留';
COMMENT ON COLUMN public.photography_prompt_sets.name_de IS '顯示名稱（德文），預留';
COMMENT ON COLUMN public.photography_prompt_sets.name_fr IS '顯示名稱（法文），預留';
