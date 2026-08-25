-- 連續審核攔截後降低該帳號生圖頻率
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS prompt_review_block_streak integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS prompt_review_throttle_until timestamptz;

COMMENT ON COLUMN public.profiles.prompt_review_block_streak IS
  '連續描述審核攔截次數；通過後歸零。';
COMMENT ON COLUMN public.profiles.prompt_review_throttle_until IS
  '此時間前降低／暫停商攝生圖。';

NOTIFY pgrst, 'reload schema';
