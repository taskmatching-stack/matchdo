-- 修正 contact_info.user_id 外鍵：改為參照 auth.users(id)
-- 原因：登入使用 Supabase Auth (auth.users)，若無 public.users 對應列會違反 FK 導致儲存失敗
-- 執行後：聯絡資訊設定頁可正常儲存

ALTER TABLE public.contact_info
  DROP CONSTRAINT IF EXISTS contact_info_user_id_fkey;

ALTER TABLE public.contact_info
  ADD CONSTRAINT contact_info_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.contact_info.user_id IS '對應 Supabase Auth 用戶 (auth.users.id)';
