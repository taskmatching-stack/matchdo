-- 新增測試員（tester）角色：僅能使用 Playground / AI 工具頁，前端無刪除鈕
-- 執行前請確認 profiles.role 已存在（已執行 user-roles-schema.sql）

-- 放寬 role 的 CHECK，加入 'tester'（PostgreSQL 須先 DROP 再 ADD）
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'tester'));

COMMENT ON COLUMN profiles.role IS '用戶角色：user=一般用戶, admin=管理員, tester=測試員(僅 Playground/AI 工具)';

-- 設定測試員（請將 email 改為實際帳號）：
-- UPDATE profiles SET role = 'tester' WHERE email = 'tester@example.com';

-- 測試員點數由管理員輸入：在後台「用戶管理」對該測試員編輯點數，或使用「手動調整點數」。
-- 測試員不使用訂閱方案點數，僅使用 user_credits 中管理員設定的餘額。
