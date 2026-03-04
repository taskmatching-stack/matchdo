-- 廠商作品：區分分類來源為「訂製」或「再製」
-- 執行：Supabase SQL Editor（可於 add-manufacturer-portfolio-category-fields.sql 之後執行）

ALTER TABLE public.manufacturer_portfolio
    ADD COLUMN IF NOT EXISTS category_type TEXT DEFAULT 'custom';

COMMENT ON COLUMN public.manufacturer_portfolio.category_type IS '分類來源：custom=訂製品分類(custom_product_categories)，remake=再製分類(remake_categories)';

-- 既有資料視為訂製
UPDATE public.manufacturer_portfolio SET category_type = 'custom' WHERE category_type IS NULL;

SELECT 'manufacturer_portfolio 已支援 category_type（custom|remake）' AS message;
