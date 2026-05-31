-- 將「產業供應商公司」綁到你的 MatchDO 登入帳號
-- 前置：docs/add-membership-catalog-visibility.sql
-- 說明：docs/sql-scripts-conventions.md（為何其他 .sql 不用改、這支要改）
--
-- 舊版含 YOUR_USER_UUID::uuid 會 22P02，已廢除。

-- ═══════════════════════════════════════════════════════════════
-- 【查詢 A】不須改任何字，可直接執行：看有哪些供應商公司
-- ═══════════════════════════════════════════════════════════════
SELECT id, name, user_id, is_active, updated_at
FROM public.industry_suppliers
ORDER BY name;

-- ═══════════════════════════════════════════════════════════════
-- 【綁定】只改下面 DO 區塊開頭兩個變數，再執行整段 DO … END $$
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_email text := '你的登入信箱@example.com';  -- ← 改成 MatchDO 登入信箱
  v_supplier_id uuid := 'a0000000-0000-4000-8000-000000000001';  -- ← 查詢 A 的 id
  v_user_id uuid;
  v_rows int;
BEGIN
  IF v_email LIKE '%@example.com' OR position('你的登入' in v_email) > 0 THEN
    RAISE EXCEPTION '請先修改 v_email：填入真實登入信箱，勿保留範例文字';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '找不到登入信箱「%」。請到 Authentication → Users 核對信箱是否與此專案一致', v_email;
  END IF;

  UPDATE public.industry_suppliers
  SET user_id = v_user_id, updated_at = now()
  WHERE id = v_supplier_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION '找不到供應商 id「%」。請先執行上方查詢 A，將 v_supplier_id 改為正確的 id', v_supplier_id;
  END IF;

  RAISE NOTICE '綁定成功：供應商 % → 帳號 % (%)', v_supplier_id, v_email, v_user_id;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 【驗證】把信箱改成與上面相同後執行
-- ═══════════════════════════════════════════════════════════════
SELECT s.id, s.name, s.user_id, u.email AS bound_login_email
FROM public.industry_suppliers s
LEFT JOIN auth.users u ON u.id = s.user_id
WHERE u.email = '你的登入信箱@example.com';

-- 網站：上架 /client/supplier-catalog-manage.html
--       引用紀錄 /client/industry-supplier-dashboard.html
