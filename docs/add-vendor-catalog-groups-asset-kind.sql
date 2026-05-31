-- 廠商自訂分類：區分數位原型／材料參考（與網站 category_key 無關）
-- 執行：Supabase SQL Editor（在 add-vendor-catalog-groups.sql 之後）

ALTER TABLE public.vendor_catalog_groups
    ADD COLUMN IF NOT EXISTS asset_kind text;

COMMENT ON COLUMN public.vendor_catalog_groups.asset_kind IS 'prototype | material | part；NULL 視同 prototype（舊資料）';

-- 既有分類一律視為數位原型（材料需另建專用分類）
UPDATE public.vendor_catalog_groups SET asset_kind = 'prototype' WHERE asset_kind IS NULL;
