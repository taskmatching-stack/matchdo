-- 修復 profiles 表並同步現有用戶
-- 執行此腳本以同步 auth.users 到 profiles 表

-- 1. 檢查並插入當前登入用戶的 profile
INSERT INTO public.profiles (id, email, full_name, avatar_url, email_verified, role)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    au.raw_user_meta_data->>'avatar_url',
    au.email_confirmed_at IS NOT NULL,
    'user' -- 預設為一般用戶
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.profiles);

-- 2. 將您的帳號設為管理員
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'liutsaiiu@gmail.com';

-- 3. 檢查結果
SELECT id, email, full_name, role, email_verified, created_at
FROM public.profiles
ORDER BY created_at DESC;
