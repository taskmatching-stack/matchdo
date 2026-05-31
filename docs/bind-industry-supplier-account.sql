-- 【僅管理員】將上游產業供應商公司對應到登入帳號（勿對一般製造商展示或要求執行）
-- 前置：docs/add-membership-catalog-visibility.sql（industry_suppliers.user_id 欄位）
--
-- 1) Supabase → Authentication → Users → 複製該公司登入帳號的 UUID
-- 2) 將下方 YOUR_USER_UUID 替換後執行（示範供應商 id 已填好）

UPDATE public.industry_suppliers
SET user_id = 'YOUR_USER_UUID'::uuid,
    updated_at = now()
WHERE id = 'a0000000-0000-4000-8000-000000000001';  -- 例：docs/seed-industry-supplier-materials.sql 示範供應商

-- 驗證
SELECT id, name, user_id, is_active FROM public.industry_suppliers WHERE user_id = 'YOUR_USER_UUID'::uuid;

-- 綁定後供應商登入：
--   上架產品 → /client/supplier-catalog-manage.html（管理數位產品庫）
--   控制台   → /client/industry-supplier-dashboard.html
--
-- 接單製造商（manufacturers.user_id）只需用「產業供應商目錄」匯入，不需執行本檔：
--   瀏覽目錄 → /client/industry-suppliers.html
--   引用清單 → /client/my-supplier-references.html
--   示範資料請先跑 seed-industry-supplier-materials.sql（STEP 1～4；STEP 4 前需 add-supplier-catalog-item-kind-part.sql）
