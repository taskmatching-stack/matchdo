-- 廠商素材：封面與多角度圖名稱（供設計頁匯入顯示）
-- gallery_images 每筆可含 label：{ "url", "sort_order", "label" }
-- 執行：Supabase SQL Editor（與 add-vendor-asset-gallery-images.sql 併用）

ALTER TABLE public.vendor_assets
ADD COLUMN IF NOT EXISTS cover_image_label text;

COMMENT ON COLUMN public.vendor_assets.cover_image_label IS '封面圖顯示名稱（預設上傳檔名）；多角度 label 存於 gallery_images[].label';
