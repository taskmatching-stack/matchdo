-- 廠商綁定登入帳號：讓「我的廠商」可依登入者取得（可重複執行）
-- 執行：Supabase SQL Editor

ALTER TABLE public.manufacturers
    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_manufacturers_user_id ON public.manufacturers(user_id) WHERE user_id IS NOT NULL;

COMMENT ON COLUMN public.manufacturers.user_id IS '綁定之登入帳號（auth.users.id）；同一帳號僅能綁定一間廠商，供「我的廠商作品」使用';
