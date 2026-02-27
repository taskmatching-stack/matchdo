-- 添加 role 欄位到 profiles 表
-- 執行此腳本以支援用戶角色管理功能

-- =============================================
-- 注意：此檔案使用 ALTER TABLE 方式新增欄位
-- 如需完全重建，請先手動執行：
-- ALTER TABLE profiles DROP COLUMN IF EXISTS role;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS email_verified;
-- =============================================

-- 檢查並添加 role 欄位
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN role text DEFAULT 'user' CHECK (role IN ('user', 'admin'));
        
        COMMENT ON COLUMN profiles.role IS '用戶角色：user=一般用戶, admin=管理員';
    END IF;
END $$;

-- 添加 email_verified 欄位（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'email_verified'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN email_verified boolean DEFAULT false;
        
        COMMENT ON COLUMN profiles.email_verified IS 'Email 是否已驗證';
    END IF;
END $$;

-- 添加 email 欄位（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN email text;
        
        COMMENT ON COLUMN profiles.email IS '用戶 Email';
    END IF;
END $$;

-- 從 auth.users 同步 email 到 profiles（如果 email 欄位為空）
UPDATE profiles
SET email = auth.users.email
FROM auth.users
WHERE profiles.id = auth.users.id
AND profiles.email IS NULL;

-- 創建索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- 更新 RLS 政策，允許管理員查看所有用戶
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view all profiles"
    ON profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- 允許管理員更新任何用戶的 profile
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile"
    ON profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 設定第一個管理員（請修改 email）
-- 將下面的 'your-email@example.com' 改成您的 Email
/*
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
*/

-- 顯示所有管理員
SELECT id, email, full_name, role, created_at
FROM profiles
WHERE role = 'admin'
ORDER BY created_at;
