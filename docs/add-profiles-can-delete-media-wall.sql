-- 新增 profiles.can_delete_media_wall：允許在後台指定哪些帳號可在首頁靈感牆刪除/隱藏圖（與 role=admin 分離管理）
-- 執行於 Supabase SQL Editor

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS can_delete_media_wall boolean DEFAULT false;

COMMENT ON COLUMN public.profiles.can_delete_media_wall IS '是否可在首頁靈感牆刪除/隱藏圖（可由管理員在後台用戶管理勾選）';
