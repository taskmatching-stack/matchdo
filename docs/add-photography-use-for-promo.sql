-- 攝影參數組：開放給推廣圖使用
-- 執行：Supabase SQL Editor
-- 設計區／廠商區推廣圖 TAB 的「攝影參數」下拉，只顯示 use_for_promo = true 且啟用中的組

ALTER TABLE public.photography_prompt_sets
    ADD COLUMN IF NOT EXISTS use_for_promo BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.photography_prompt_sets.use_for_promo IS
    '為 true 時，出現在設計區／廠商區推廣圖的攝影參數選單';

CREATE INDEX IF NOT EXISTS idx_photography_prompt_sets_use_for_promo
    ON public.photography_prompt_sets (use_for_promo)
    WHERE use_for_promo = TRUE;
