-- 配件／零件參考（asset_kind = part），與 prototype / material 並列
-- 執行：Supabase SQL Editor

ALTER TABLE public.vendor_assets DROP CONSTRAINT IF EXISTS vendor_assets_asset_kind_check;

ALTER TABLE public.vendor_assets
    ADD CONSTRAINT vendor_assets_asset_kind_check
    CHECK (asset_kind IN ('prototype', 'material', 'part'));

COMMENT ON COLUMN public.vendor_assets.asset_kind IS 'prototype=數位原型, material=材料參考, part=配件／零件';

-- 廠商自訂分類亦支援 part（若已有 asset_kind 欄）
UPDATE public.vendor_catalog_groups SET asset_kind = 'prototype' WHERE asset_kind IS NULL;
