-- 【已取消】英文「過期提示」僅初期展示用，產品不再使用；勿為此功能執行本檔。
-- 素材／作品：英文生成來源 hash（對齊 manufacturers.i18n_en_source_hash）

ALTER TABLE public.vendor_assets
    ADD COLUMN IF NOT EXISTS i18n_en_generated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS i18n_en_source_hash TEXT;

COMMENT ON COLUMN public.vendor_assets.i18n_en_generated_at IS '上次寫入 title_en／description_en 時間（AI 或手動觸發批次）';
COMMENT ON COLUMN public.vendor_assets.i18n_en_source_hash IS '中文 title／description hash；變更後可提示重新生成英文';

ALTER TABLE public.manufacturer_portfolio
    ADD COLUMN IF NOT EXISTS i18n_en_generated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS i18n_en_source_hash TEXT;

COMMENT ON COLUMN public.manufacturer_portfolio.i18n_en_generated_at IS '上次寫入作品英文欄時間';
COMMENT ON COLUMN public.manufacturer_portfolio.i18n_en_source_hash IS '中文 title／description／design_highlight hash';
