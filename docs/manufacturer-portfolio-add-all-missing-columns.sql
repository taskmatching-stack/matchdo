-- ============================================================
-- 廠商作品表：一次補齊所有缺少欄位（解決 API 500）
-- 在 Supabase SQL Editor 執行「整份」即可，只需跑一次。
-- ============================================================

-- 1. 分類：主分類、子分類
ALTER TABLE public.manufacturer_portfolio ADD COLUMN IF NOT EXISTS category_key TEXT;
ALTER TABLE public.manufacturer_portfolio ADD COLUMN IF NOT EXISTS subcategory_key TEXT;
ALTER TABLE public.manufacturer_portfolio ADD COLUMN IF NOT EXISTS category_type TEXT DEFAULT 'custom';

COMMENT ON COLUMN public.manufacturer_portfolio.category_key IS '主分類 key（與 custom_product_categories / remake_categories 對齊）';
COMMENT ON COLUMN public.manufacturer_portfolio.subcategory_key IS '子分類 key';
COMMENT ON COLUMN public.manufacturer_portfolio.category_type IS 'custom=訂製品分類，remake=再製分類';

UPDATE public.manufacturer_portfolio SET category_type = 'custom' WHERE category_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_manufacturer_portfolio_category_key
ON public.manufacturer_portfolio(category_key) WHERE category_key IS NOT NULL;

-- 2. 系列圖多張 + 有效期限
ALTER TABLE public.manufacturer_portfolio ADD COLUMN IF NOT EXISTS series_image_urls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.manufacturer_portfolio ADD COLUMN IF NOT EXISTS series_image_valid_until TIMESTAMPTZ;

COMMENT ON COLUMN public.manufacturer_portfolio.series_image_urls IS '系列圖多張 URL 陣列';
COMMENT ON COLUMN public.manufacturer_portfolio.series_image_valid_until IS '付 600 點上傳的系列圖有效期限；NULL=無期限';

-- 3. 對照圖有效期限
ALTER TABLE public.manufacturer_portfolio ADD COLUMN IF NOT EXISTS before_image_valid_until TIMESTAMPTZ;

COMMENT ON COLUMN public.manufacturer_portfolio.before_image_valid_until IS '付 400 點上傳的對照圖有效期限；NULL=無期限';

-- 4. 最小可訂製數量（MOQ）
ALTER TABLE public.manufacturer_portfolio ADD COLUMN IF NOT EXISTS min_order_quantity INTEGER;

COMMENT ON COLUMN public.manufacturer_portfolio.min_order_quantity IS '此作品最小可訂製數量（件）；NULL 表示未填寫';

SELECT 'manufacturer_portfolio 已補齊所有欄位（category_key, subcategory_key, category_type, series_image_urls, series_image_valid_until, before_image_valid_until, min_order_quantity）' AS message;
