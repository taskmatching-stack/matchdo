-- 訂製生圖資料血緣（廠商引用自己素材庫才算自產；僅後端分析用）
-- 執行：Supabase SQL Editor 或 /admin/db-migrations.html

ALTER TABLE public.custom_products
    ADD COLUMN IF NOT EXISTS generator_manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS has_self_vendor_reference boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vendor_self_serve boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS data_lineage_json jsonb DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_custom_products_vendor_self_serve
    ON public.custom_products (is_vendor_self_serve)
    WHERE is_vendor_self_serve = true;

COMMENT ON COLUMN public.custom_products.is_vendor_self_serve IS
    'true=生圖者為廠商且從素材庫引用自己廠素材；分析訂製者意圖時排除。上傳參考圖但未選素材庫不算。';
