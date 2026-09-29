-- 廠商自填工藝（其他）英文版；與 capability_custom_labels 同索引對齊
-- 執行：Supabase SQL Editor

ALTER TABLE public.vendor_assets
    ADD COLUMN IF NOT EXISTS capability_custom_labels_en text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.vendor_assets.capability_custom_labels_en IS '自填工藝英文版（lang=en 顯示；與 capability_custom_labels 同序）';

ALTER TABLE public.manufacturer_portfolio
    ADD COLUMN IF NOT EXISTS capability_custom_labels_en text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.manufacturer_portfolio.capability_custom_labels_en IS '作品自填工藝英文版';

ALTER TABLE public.contact_info
    ADD COLUMN IF NOT EXISTS bio TEXT,
    ADD COLUMN IF NOT EXISTS bio_en TEXT;

COMMENT ON COLUMN public.contact_info.bio IS '自我介紹（預設語系）';
COMMENT ON COLUMN public.contact_info.bio_en IS '自我介紹英文版（lang=en）';
