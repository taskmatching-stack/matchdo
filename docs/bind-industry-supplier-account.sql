-- 【可選・平台維運用】把「已存在的」產業供應商列綁到某登入帳號
-- 一般使用者：請在網站「上架數位產品庫」建立公司（POST /api/me/industry-supplier），不必執行本檔。
--
-- 用途：示範資料 seed 後、或平台先在後台建好公司列、再指定由誰管理。

UPDATE public.industry_suppliers
SET user_id = COALESCE(
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1),
  (SELECT id FROM public.profiles WHERE role = 'tester' LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
),
updated_at = now()
WHERE id = 'a0000000-0000-4000-8000-000000000001'
  AND user_id IS NULL;

SELECT id, name, user_id FROM public.industry_suppliers WHERE id = 'a0000000-0000-4000-8000-000000000001';
