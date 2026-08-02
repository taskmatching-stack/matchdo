-- 數位原型／材料／零件：除 image_url 封面外之多角度圖 [{url,sort_order,...}]
-- 執行：Supabase SQL Editor

ALTER TABLE public.vendor_assets
ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.vendor_assets.gallery_images IS 'prototype／material／part：除 image_url 封面外之多角度圖；材料色卡／細節圖亦存此欄';
