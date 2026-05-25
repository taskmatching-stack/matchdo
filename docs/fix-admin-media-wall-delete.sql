-- 修復：首頁看得到「刪除」但點了說沒權限，或 Google 登入後無法刪圖
-- 常見原因：profiles 以 Email 註冊時的 id 與 Google auth.users.id 不同（程式已改為以 email 對應權限，仍建議統一 id）
-- 在 Supabase SQL Editor 執行

-- 1) 對照 auth 與 profiles（依 id 與 email）
SELECT au.id AS auth_user_id, au.email,
       p_id.role AS role_by_id, p_id.can_delete_media_wall AS del_by_id,
       p_em.id AS profile_row_by_email, p_em.role AS role_by_email
FROM auth.users au
LEFT JOIN public.profiles p_id ON p_id.id = au.id
LEFT JOIN public.profiles p_em ON lower(trim(p_em.email)) = lower(trim(au.email))
WHERE au.email = 'liutsaiiu@gmail.com';

-- 2) 以目前 Google 帳號的 auth.users.id 建立或更新 profiles（建議）
INSERT INTO public.profiles (id, email, full_name, avatar_url, email_verified, role)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    au.raw_user_meta_data->>'avatar_url',
    au.email_confirmed_at IS NOT NULL,
    'admin'
FROM auth.users au
WHERE au.email = 'liutsaiiu@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    email = EXCLUDED.email;

-- 3) 若曾用 Email 註冊留下「同 email、不同 id」的舊列，可改為一般使用者避免混淆（選用）
-- UPDATE public.profiles SET role = 'user'
-- WHERE lower(trim(email)) = 'liutsaiiu@gmail.com'
--   AND id NOT IN (SELECT id FROM auth.users WHERE email = 'liutsaiiu@gmail.com');

-- 4) 確認
SELECT id, email, role, can_delete_media_wall
FROM public.profiles
WHERE lower(trim(email)) = 'liutsaiiu@gmail.com';

-- 選用：僅開「首頁刪圖」、role 維持 user（需已執行 docs/add-profiles-can-delete-media-wall.sql）
-- UPDATE public.profiles SET can_delete_media_wall = true
-- WHERE id IN (SELECT id FROM auth.users WHERE email = 'liutsaiiu@gmail.com');
