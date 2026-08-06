-- 材料組合配色範例：比重欄位（雙色 preset／三色自訂％）
-- 若尚未建表，請先執行 add-material-color-palettes.sql
-- 執行：Supabase SQL Editor 或後台「資料庫維護」

ALTER TABLE public.material_color_palettes
    ADD COLUMN IF NOT EXISTS ratio_preset TEXT;

ALTER TABLE public.material_color_palettes
    ADD COLUMN IF NOT EXISTS ratio_percents JSONB;

COMMENT ON COLUMN public.material_color_palettes.ratio_preset IS
    'dual_75_25｜dual_50_50｜tri_custom';
COMMENT ON COLUMN public.material_color_palettes.ratio_percents IS
    '整數％陣列，合計 100；雙色 [p1,p2]，三色 [p1,p2,p3]';
COMMENT ON COLUMN public.material_color_palettes.tertiary_hex IS
    '三色輔色；雙色為 null';

UPDATE public.material_color_palettes
SET
    ratio_preset = COALESCE(ratio_preset, 'dual_75_25'),
    ratio_percents = COALESCE(ratio_percents, '[75, 25]'::jsonb)
WHERE color_count IS DISTINCT FROM 3
  AND (ratio_preset IS NULL OR ratio_percents IS NULL);

UPDATE public.material_color_palettes
SET
    ratio_preset = COALESCE(ratio_preset, 'tri_custom'),
    ratio_percents = COALESCE(ratio_percents, '[50, 30, 20]'::jsonb)
WHERE color_count = 3
  AND (ratio_preset IS NULL OR ratio_percents IS NULL);
