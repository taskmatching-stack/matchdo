-- 將「產業供應商公司」綁到你的 MatchDO 登入帳號
-- 前置：docs/add-membership-catalog-visibility.sql（建立 industry_suppliers.user_id）
--
-- ⚠️ 勿執行舊版含 YOUR_USER_UUID 的語句（會報 22P02）。
-- ⚠️ 下面「設定區」兩個引號內一定要改成你的真實資料後，再執行「綁定」那一段。

-- ═══════════════════════════════════════════════════════════════
-- 【設定區】只改這兩行引號裡的內容
-- ═══════════════════════════════════════════════════════════════
-- login_email   = 你在 MatchDO 登入用的信箱（與 Supabase Auth 相同）
-- supplier_id   = 要綁定的產業供應商公司 id（不確定請先跑「查詢 A」）
--
-- 示範供應商（跑過 seed-industry-supplier-materials.sql 時）：
--   id = a0000000-0000-4000-8000-000000000001  名稱「示範布料供應商」

-- ═══════════════════════════════════════════════════════════════
-- 【查詢 A】可先單獨執行：列出所有供應商公司（複製 id 到設定區）
-- ═══════════════════════════════════════════════════════════════
SELECT id, name, user_id, is_active, updated_at
FROM public.industry_suppliers
ORDER BY name;

-- ═══════════════════════════════════════════════════════════════
-- 【查詢 B】可先單獨執行：確認信箱是否存在（把信箱改成你的）
-- ═══════════════════════════════════════════════════════════════
-- SELECT id AS user_uuid, email FROM auth.users
-- WHERE email = '你的登入信箱@example.com';

-- ═══════════════════════════════════════════════════════════════
-- 【綁定】改好設定區後，只執行下面 UPDATE ～ SELECT 驗證（可整段選取）
-- ═══════════════════════════════════════════════════════════════
WITH bind_cfg AS (
  SELECT
    '你的登入信箱@example.com'::text AS login_email,
    'a0000000-0000-4000-8000-000000000001'::uuid AS supplier_id
),
target_user AS (
  SELECT u.id AS user_id
  FROM auth.users u
  CROSS JOIN bind_cfg c
  WHERE u.email = c.login_email
)
UPDATE public.industry_suppliers s
SET user_id = tu.user_id,
    updated_at = now()
FROM bind_cfg c
JOIN target_user tu ON true
WHERE s.id = c.supplier_id;

-- 驗證（應看到 name + 你的 email；user_id 不為 null）
SELECT s.id, s.name, s.user_id, u.email AS bound_login_email
FROM public.industry_suppliers s
LEFT JOIN auth.users u ON u.id = s.user_id
CROSS JOIN (SELECT '你的登入信箱@example.com'::text AS login_email) c
WHERE s.id = 'a0000000-0000-4000-8000-000000000001'::uuid
   OR u.email = c.login_email;

-- 綁定成功後（網站）：
--   上架產品     → /client/supplier-catalog-manage.html
--   誰引用我     → /client/industry-supplier-dashboard.html
--   公開產品庫頁 → /client/industry-supplier-catalog.html?id=<supplier_id>
