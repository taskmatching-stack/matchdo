-- 媒體牆：custom_products 可顯示於首頁
-- 執行後請重啟或依需執行 API 測試
-- 說明：僅 show_on_homepage = true 的產品會出現在 GET /api/custom-products/for-homepage

ALTER TABLE public.custom_products
ADD COLUMN IF NOT EXISTS show_on_homepage BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.custom_products.show_on_homepage IS '是否同意展示在首頁媒體牆（僅有圖的產品建議才設為 true）';

CREATE INDEX IF NOT EXISTS idx_custom_products_show_on_homepage
ON public.custom_products(show_on_homepage) WHERE show_on_homepage = true;

-- 可選：允許匿名讀取「可顯示於首頁」的產品（若 API 用 anon key 且不 bypass RLS 時需要）
-- 目前 server 使用 SUPABASE_SERVICE_ROLE_KEY，會 bypass RLS，故可不加此 policy
-- DROP POLICY IF EXISTS "Anyone can view products shown on homepage" ON public.custom_products;
-- CREATE POLICY "Anyone can view products shown on homepage"
--     ON public.custom_products FOR SELECT
--     USING (show_on_homepage = true);
