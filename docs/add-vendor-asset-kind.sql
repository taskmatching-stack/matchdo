-- 數位版型：區分「數位原型」與「材料參考」
-- 執行：Supabase SQL Editor 或管理後台資料庫維護

ALTER TABLE public.vendor_assets
ADD COLUMN IF NOT EXISTS asset_kind text NOT NULL DEFAULT 'prototype';

COMMENT ON COLUMN public.vendor_assets.asset_kind IS 'prototype=數位原型, material=材料參考';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_assets_asset_kind_check'
  ) THEN
    ALTER TABLE public.vendor_assets
    ADD CONSTRAINT vendor_assets_asset_kind_check
    CHECK (asset_kind IN ('prototype', 'material'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vendor_assets_asset_kind ON public.vendor_assets(asset_kind);
