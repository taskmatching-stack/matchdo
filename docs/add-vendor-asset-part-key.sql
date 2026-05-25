-- 廠商數位原型：部位零件（領型、袖口、門襟等）
-- 執行於 Supabase SQL Editor

ALTER TABLE public.vendor_assets
ADD COLUMN IF NOT EXISTS part_key text DEFAULT NULL;

COMMENT ON COLUMN public.vendor_assets.part_key IS '部位零件（選填、自由文字 slug，已不強制枚舉）；材料參考可為 NULL';

CREATE INDEX IF NOT EXISTS idx_vendor_assets_part_key ON public.vendor_assets(part_key);
