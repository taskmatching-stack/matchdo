-- 數位原型：同一產品多角度圖（材料仍單圖）
-- 執行：Supabase SQL Editor

ALTER TABLE public.vendor_assets
ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.vendor_assets.gallery_images IS 'prototype 專用：除 image_url 封面外之多角度 [{url,sort_order}]；material 請保持 []';
