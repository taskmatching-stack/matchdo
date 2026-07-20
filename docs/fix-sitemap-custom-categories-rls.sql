-- 啟用 custom_product_categories 公開讀取（供 sitemap 查詢）
-- 執行位置：Supabase Dashboard → SQL Editor

-- 啟用 RLS
ALTER TABLE public.custom_product_categories ENABLE ROW LEVEL SECURITY;

-- 新增公開讀取政策（僅 is_active=true 的分類）
DROP POLICY IF EXISTS "Allow public read active categories" ON public.custom_product_categories;

CREATE POLICY "Allow public read active categories"
ON public.custom_product_categories
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- 驗證
SET ROLE anon;
SELECT key, name FROM public.custom_product_categories WHERE is_active = true;
RESET ROLE;
