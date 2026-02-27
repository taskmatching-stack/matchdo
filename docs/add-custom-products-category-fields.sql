-- 訂製產品：儲存設計時選擇的主分類、子分類（與設計業/找製作方對齊）
-- 執行：Supabase SQL Editor

-- 主分類：沿用既有 category 欄位（存 main category key，如 apparel、furniture）
-- 子分類：新增 subcategory_key
ALTER TABLE public.custom_products
    ADD COLUMN IF NOT EXISTS subcategory_key TEXT;

COMMENT ON COLUMN public.custom_products.category IS '主分類 key（設計時選擇，與 custom_product_categories 對齊）';
COMMENT ON COLUMN public.custom_products.subcategory_key IS '子分類 key（設計時選擇，與 custom_product_subcategories 對齊）';

SELECT 'custom_products 已支援 subcategory_key' AS message;
