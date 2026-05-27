-- 數位原型：最小訂購量、訂製程度（僅 prototype 使用；material 請保持 NULL / []）
-- 執行：Supabase SQL Editor

ALTER TABLE public.vendor_assets
  ADD COLUMN IF NOT EXISTS min_order_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS customization_levels text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.vendor_assets.min_order_quantity IS '數位原型最小訂購量（件）；material 為 NULL';
COMMENT ON COLUMN public.vendor_assets.customization_levels IS '訂製程度 slug 陣列：mono_graphic|color_graphic|color_material|size_part|form_structure；prototype 至少一項';

CREATE INDEX IF NOT EXISTS idx_vendor_assets_min_order_quantity
  ON public.vendor_assets(min_order_quantity)
  WHERE asset_kind = 'prototype' AND min_order_quantity IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_assets_customization_levels
  ON public.vendor_assets USING GIN (customization_levels);
