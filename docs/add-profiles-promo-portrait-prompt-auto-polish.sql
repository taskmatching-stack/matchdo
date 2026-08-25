-- 帳號設定：人像描述自動潤飾（預設開）。關閉後仍會審查攔截，只是不改寫描述。
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS promo_portrait_prompt_auto_polish boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.promo_portrait_prompt_auto_polish IS
  '人像描述預審核自動潤飾。false=不潤飾但仍攔截明顯違規。預設 true。';

NOTIFY pgrst, 'reload schema';
