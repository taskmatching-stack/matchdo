-- 廠商公開到期日：種子廠商為 90 天內公開、不得編輯；付費後可編輯且無此限
-- 執行：Supabase SQL Editor（可重複執行）
-- 還原點：見 docs/還原點-種子廠商實作前.md

ALTER TABLE public.manufacturers
    ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.manufacturers.expires_at IS '公開到期日：若設定了則超過後前台不曝光。種子廠商建檔時設為 now()+90 天；付費或自行建檔為 NULL（無限期）。';

-- 既有資料不變（維持 NULL）。新建立的種子廠商由 API 寫入 expires_at = now() + 90 天
