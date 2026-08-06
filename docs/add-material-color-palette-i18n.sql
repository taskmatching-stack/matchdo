-- 材料組合配色範例：官方類型／配色多語系欄位（對齊 promo_scene_templates）
-- 用途：後台維護 → 前台 ?lang= 顯示；不是後台介面本身的 i18n。
-- 執行：Supabase SQL Editor 或後台「資料庫維護」id=`material-color-palette-i18n`

ALTER TABLE public.material_color_palette_types ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.material_color_palette_types ADD COLUMN IF NOT EXISTS name_ja TEXT;
ALTER TABLE public.material_color_palette_types ADD COLUMN IF NOT EXISTS name_es TEXT;
ALTER TABLE public.material_color_palette_types ADD COLUMN IF NOT EXISTS name_de TEXT;
ALTER TABLE public.material_color_palette_types ADD COLUMN IF NOT EXISTS name_fr TEXT;

COMMENT ON COLUMN public.material_color_palette_types.name_en IS '類型顯示名（英文），前台 lang=en 時使用';
COMMENT ON COLUMN public.material_color_palette_types.name_ja IS '類型顯示名（日文），預留';
COMMENT ON COLUMN public.material_color_palette_types.name_es IS '類型顯示名（西班牙文），預留';
COMMENT ON COLUMN public.material_color_palette_types.name_de IS '類型顯示名（德文），預留';
COMMENT ON COLUMN public.material_color_palette_types.name_fr IS '類型顯示名（法文），預留';

ALTER TABLE public.material_color_palettes ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.material_color_palettes ADD COLUMN IF NOT EXISTS name_ja TEXT;
ALTER TABLE public.material_color_palettes ADD COLUMN IF NOT EXISTS name_es TEXT;
ALTER TABLE public.material_color_palettes ADD COLUMN IF NOT EXISTS name_de TEXT;
ALTER TABLE public.material_color_palettes ADD COLUMN IF NOT EXISTS name_fr TEXT;
ALTER TABLE public.material_color_palettes ADD COLUMN IF NOT EXISTS note_en TEXT;
ALTER TABLE public.material_color_palettes ADD COLUMN IF NOT EXISTS note_ja TEXT;
ALTER TABLE public.material_color_palettes ADD COLUMN IF NOT EXISTS note_es TEXT;
ALTER TABLE public.material_color_palettes ADD COLUMN IF NOT EXISTS note_de TEXT;
ALTER TABLE public.material_color_palettes ADD COLUMN IF NOT EXISTS note_fr TEXT;

COMMENT ON COLUMN public.material_color_palettes.name_en IS '配色名稱（英文），前台 lang=en 時使用';
COMMENT ON COLUMN public.material_color_palettes.note_en IS '備註（英文），前台 lang=en 時使用';
