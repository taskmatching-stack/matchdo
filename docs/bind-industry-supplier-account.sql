-- 將「產業供應商」綁到登入帳號（同一個 auth.users，不需另註冊角色）
-- 前置：docs/add-membership-catalog-visibility.sql（industry_suppliers.user_id 欄位）
--
-- 1) 在 Supabase → Authentication → Users 複製供應商聯絡人的 UUID
-- 2) 將下方 YOUR_USER_UUID、SUPPLIER_ID 替換後執行

UPDATE public.industry_suppliers
SET user_id = 'YOUR_USER_UUID'::uuid,
    updated_at = now()
WHERE id = 'a0000000-0000-4000-8000-000000000001';  -- 例：docs/seed-industry-supplier-materials.sql 示範供應商

-- 驗證
SELECT id, name, user_id, is_active FROM public.industry_suppliers WHERE user_id = 'YOUR_USER_UUID'::uuid;

-- 綁定後供應商登入 → /client/supplier-catalog-manage.html 可上架材料
-- 製造商（有 manufacturers 列）→ 材料分頁可瀏覽導入 B 線（需至少 1 件展示作品，見 can_import_supplier_catalog）
