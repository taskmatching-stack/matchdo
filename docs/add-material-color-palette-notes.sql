-- 材料組合配色範例：備註描述（選填）
-- 若尚未建表，請先執行 add-material-color-palettes.sql
-- 執行：Supabase SQL Editor 或後台「資料庫維護」

ALTER TABLE public.material_color_palettes
    ADD COLUMN IF NOT EXISTS note TEXT;

COMMENT ON COLUMN public.material_color_palettes.note IS '備註描述（選填）';
