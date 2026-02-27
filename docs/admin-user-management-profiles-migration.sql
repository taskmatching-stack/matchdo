-- 用戶管理：profiles 新增會員等級（供後台 /admin/user-management.html 顯示與編輯）
-- 點數使用既有 user_credits 表（需先執行 docs/subscriptions-schema.sql）。執行：Supabase SQL Editor

-- 新增 member_level 欄位（若不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'member_level'
    ) THEN
        ALTER TABLE public.profiles
        ADD COLUMN member_level text DEFAULT '一般';
        COMMENT ON COLUMN public.profiles.member_level IS '會員等級：一般、進階、尊榮等，供後台手動編輯';
    END IF;
END $$;
