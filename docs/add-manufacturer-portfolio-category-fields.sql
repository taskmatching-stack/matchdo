-- 廠商對比作品：新增主分類、子分類 key，與訂製品分類對齊，供首頁媒體牆依分類篩選
-- 執行：Supabase SQL Editor

ALTER TABLE public.manufacturer_portfolio
    ADD COLUMN IF NOT EXISTS category_key TEXT,
    ADD COLUMN IF NOT EXISTS subcategory_key TEXT;

COMMENT ON COLUMN public.manufacturer_portfolio.category_key IS '主分類 key（與 custom_product_categories 對齊，供媒體牆篩選）';
COMMENT ON COLUMN public.manufacturer_portfolio.subcategory_key IS '子分類 key（與 custom_product_subcategories 對齊）';

CREATE INDEX IF NOT EXISTS idx_manufacturer_portfolio_category_key
ON public.manufacturer_portfolio(category_key) WHERE category_key IS NOT NULL;

SELECT 'manufacturer_portfolio 已支援 category_key, subcategory_key' AS message;
