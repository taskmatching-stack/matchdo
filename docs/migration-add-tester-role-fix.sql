-- 若 migration-add-tester-role.sql 執行後 role 仍無法設為 tester，用本檔強制放寬 CHECK
-- 原因：PostgreSQL 的 CHECK 約束名稱可能不是 profiles_role_check，需先查詢再 DROP

-- 1. 查詢並刪除 profiles.role 上現有的 CHECK 約束（不論名稱）
DO $$
DECLARE
  conname text;
BEGIN
  FOR conname IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'public.profiles'::regclass
      AND c.contype = 'c'
      AND a.attname = 'role'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', conname);
    RAISE NOTICE '已刪除約束: %', conname;
  END LOOP;
END $$;

-- 2. 新增允許 user, admin, tester 的 CHECK
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'tester'));

-- 3. 將「目前登入的測試帳號」設為 tester（請改為你的 email）
-- UPDATE public.profiles SET role = 'tester' WHERE email = '你的測試帳號@example.com';
