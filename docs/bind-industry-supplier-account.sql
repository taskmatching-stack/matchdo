-- 示範供應商 → 綁到本專案 admin／tester（不用改任何字）
-- 前置：add-membership-catalog-visibility.sql、seed-industry-supplier-materials.sql
-- Supabase 若跳 RLS 提示 → 點「Run without RLS」（這是 UPDATE，不是建表）

UPDATE public.industry_suppliers
SET user_id = COALESCE(
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1),
  (SELECT id FROM public.profiles WHERE role = 'tester' LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
),
updated_at = now()
WHERE id = 'a0000000-0000-4000-8000-000000000001';

SELECT s.id, s.name, s.user_id, p.email, p.role
FROM public.industry_suppliers s
LEFT JOIN public.profiles p ON p.id = s.user_id
WHERE s.id = 'a0000000-0000-4000-8000-000000000001';
