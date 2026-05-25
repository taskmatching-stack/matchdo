-- 設計者地區快照（僅 IP 推斷，不強制使用者填寫；後端分析用，不對前端暴露）
-- 執行：Supabase SQL Editor 或 /admin/db-migrations.html

ALTER TABLE public.custom_products
    ADD COLUMN IF NOT EXISTS designer_country_code text,
    ADD COLUMN IF NOT EXISTS designer_region_codes text[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS designer_region_source text DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS designer_ui_locale text,
    ADD COLUMN IF NOT EXISTS designer_region_json jsonb DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_custom_products_designer_country
    ON public.custom_products (designer_country_code)
    WHERE designer_country_code IS NOT NULL;

COMMENT ON COLUMN public.custom_products.designer_country_code IS '設計者國家 ISO2（儲存當下由 IP 推斷，如 TW、US）';
COMMENT ON COLUMN public.custom_products.designer_region_source IS 'ip | unknown（目前僅 IP，不強制表單）';
