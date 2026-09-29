-- 產業供應商目錄（B 線）英文展示欄 — 對齊 vendor_assets title_en / description_en
-- 執行：Supabase SQL Editor 或 admin migration supplier-catalog-i18n-en

ALTER TABLE public.supplier_catalog_items
ADD COLUMN IF NOT EXISTS title_en text,
ADD COLUMN IF NOT EXISTS description_en text;

COMMENT ON COLUMN public.supplier_catalog_items.title_en IS '品名（英文）；前台 ?lang=en';
COMMENT ON COLUMN public.supplier_catalog_items.description_en IS '說明（英文）；前台 ?lang=en';

ALTER TABLE public.industry_suppliers
ADD COLUMN IF NOT EXISTS name_en text,
ADD COLUMN IF NOT EXISTS description_en text;

COMMENT ON COLUMN public.industry_suppliers.name_en IS '供應商名稱（英文）';
COMMENT ON COLUMN public.industry_suppliers.description_en IS '供應商簡介（英文）';
