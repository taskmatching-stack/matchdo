-- 訂製品分類多語系欄位（後台 custom-categories 編輯用）
-- 執行：Supabase SQL Editor（請先已有 custom_product_categories、custom_product_subcategories 表）

-- 主分類
ALTER TABLE public.custom_product_categories ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.custom_product_categories ADD COLUMN IF NOT EXISTS name_ja TEXT;
ALTER TABLE public.custom_product_categories ADD COLUMN IF NOT EXISTS name_es TEXT;
ALTER TABLE public.custom_product_categories ADD COLUMN IF NOT EXISTS name_de TEXT;
ALTER TABLE public.custom_product_categories ADD COLUMN IF NOT EXISTS name_fr TEXT;
COMMENT ON COLUMN public.custom_product_categories.name_en IS '顯示名稱（英文），前台 lang=en 時使用';
COMMENT ON COLUMN public.custom_product_categories.name_ja IS '顯示名稱（日文），預留';
COMMENT ON COLUMN public.custom_product_categories.name_es IS '顯示名稱（西班牙文），預留';
COMMENT ON COLUMN public.custom_product_categories.name_de IS '顯示名稱（德文），預留';
COMMENT ON COLUMN public.custom_product_categories.name_fr IS '顯示名稱（法文），預留';

-- 子分類
ALTER TABLE public.custom_product_subcategories ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.custom_product_subcategories ADD COLUMN IF NOT EXISTS name_ja TEXT;
ALTER TABLE public.custom_product_subcategories ADD COLUMN IF NOT EXISTS name_es TEXT;
ALTER TABLE public.custom_product_subcategories ADD COLUMN IF NOT EXISTS name_de TEXT;
ALTER TABLE public.custom_product_subcategories ADD COLUMN IF NOT EXISTS name_fr TEXT;
COMMENT ON COLUMN public.custom_product_subcategories.name_en IS '顯示名稱（英文），前台 lang=en 時使用';
COMMENT ON COLUMN public.custom_product_subcategories.name_ja IS '顯示名稱（日文），預留';
COMMENT ON COLUMN public.custom_product_subcategories.name_es IS '顯示名稱（西班牙文），預留';
COMMENT ON COLUMN public.custom_product_subcategories.name_de IS '顯示名稱（德文），預留';
COMMENT ON COLUMN public.custom_product_subcategories.name_fr IS '顯示名稱（法文），預留';
