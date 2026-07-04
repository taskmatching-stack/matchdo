-- 供應商數位產品庫：多角度圖（對稱 vendor_assets.gallery_images）
-- 執行：Supabase SQL Editor → Run

ALTER TABLE public.supplier_catalog_items
ADD COLUMN IF NOT EXISTS cover_image_label text,
ADD COLUMN IF NOT EXISTS gallery_images jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.supplier_catalog_items.cover_image_label IS '封面圖名稱（列表／燈箱）';
COMMENT ON COLUMN public.supplier_catalog_items.gallery_images IS '封面以外多角度圖 [{url,sort_order,label}]';
