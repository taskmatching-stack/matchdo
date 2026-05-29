-- 種子廠商：廠商同意對外展示後寫入；NULL = 僅 admin/tester 可預覽素材
-- 執行：Supabase SQL Editor

ALTER TABLE public.manufacturers
  ADD COLUMN IF NOT EXISTS seed_public_released_at timestamptz;

COMMENT ON COLUMN public.manufacturers.seed_public_released_at IS
  '種子廠商：廠商同意對外後的時間戳；NULL 表示尚未對一般訂製者公開（仍可供內部預覽）';
