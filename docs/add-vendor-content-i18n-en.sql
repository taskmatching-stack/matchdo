-- 廠商 UGC 英文欄位（讀取時 ?lang=en 切換；由 Gemini 或手動寫入，非即時翻譯）
-- 執行：Supabase SQL Editor

ALTER TABLE public.manufacturers
    ADD COLUMN IF NOT EXISTS name_en TEXT,
    ADD COLUMN IF NOT EXISTS description_en TEXT,
    ADD COLUMN IF NOT EXISTS i18n_en_generated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS i18n_en_source_hash TEXT;

COMMENT ON COLUMN public.manufacturers.name_en IS '廠商名稱英文版（公開頁 lang=en）';
COMMENT ON COLUMN public.manufacturers.description_en IS '廠商簡介英文版';
COMMENT ON COLUMN public.manufacturers.i18n_en_generated_at IS '上次 Gemini／批次寫入英文時間';
COMMENT ON COLUMN public.manufacturers.i18n_en_source_hash IS '中文來源 hash，變更後可提示重新生成';

ALTER TABLE public.vendor_assets
    ADD COLUMN IF NOT EXISTS title_en TEXT,
    ADD COLUMN IF NOT EXISTS description_en TEXT;

COMMENT ON COLUMN public.vendor_assets.title_en IS '素材標題英文版';
COMMENT ON COLUMN public.vendor_assets.description_en IS '素材描述英文版';

ALTER TABLE public.manufacturer_portfolio
    ADD COLUMN IF NOT EXISTS title_en TEXT,
    ADD COLUMN IF NOT EXISTS description_en TEXT,
    ADD COLUMN IF NOT EXISTS design_highlight_en TEXT;

COMMENT ON COLUMN public.manufacturer_portfolio.title_en IS '作品標題英文版';
COMMENT ON COLUMN public.manufacturer_portfolio.description_en IS '作品描述英文版';
COMMENT ON COLUMN public.manufacturer_portfolio.design_highlight_en IS '設計亮點英文版';

ALTER TABLE public.vendor_catalog_groups
    ADD COLUMN IF NOT EXISTS name_en TEXT;

COMMENT ON COLUMN public.vendor_catalog_groups.name_en IS '廠商自訂分類名稱英文版';

-- 產品政策：廠商 UGC 英文生成／讀取為平台基礎功能，API 不得扣點（見 docs/PROGRESS-vendor-content-i18n-en.md）
