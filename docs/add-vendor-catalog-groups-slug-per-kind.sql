-- 廠商自訂分類：slug 唯一改為「同廠商＋同 asset_kind」內唯一
-- 否則材料／零件與數位原型同名時 INSERT 撞 idx_vendor_catalog_groups_mfr_slug → 500
-- 執行：Supabase SQL Editor（需已有 asset_kind，見 add-vendor-catalog-groups-asset-kind.sql）

DROP INDEX IF EXISTS public.idx_vendor_catalog_groups_mfr_slug;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_catalog_groups_mfr_kind_slug
    ON public.vendor_catalog_groups (manufacturer_id, (COALESCE(asset_kind, 'prototype')), slug)
    WHERE slug IS NOT NULL AND slug <> '';

COMMENT ON INDEX public.idx_vendor_catalog_groups_mfr_kind_slug IS
    '同廠商、同 asset_kind 下 slug 唯一；不同類型可同名';
