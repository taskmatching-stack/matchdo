-- prompt_review_events：Gemini 400 後 FLUX 備援成功 + 參考圖／生圖紀錄連結
ALTER TABLE public.prompt_review_events DROP CONSTRAINT IF EXISTS prompt_review_events_action_check;
ALTER TABLE public.prompt_review_events ADD CONSTRAINT prompt_review_events_action_check
  CHECK (action IN ('polished', 'blocked', 'api_blocked', 'api_blocked_fallback'));

ALTER TABLE public.prompt_review_events
  ADD COLUMN IF NOT EXISTS reference_image_urls jsonb,
  ADD COLUMN IF NOT EXISTS promo_record_id uuid;

COMMENT ON COLUMN public.prompt_review_events.reference_image_urls IS
  '本次送審／生圖用的參考圖 URL 列表（[{url,role?}]）；外部 API 不會指明哪張觸發擋下。';
COMMENT ON COLUMN public.prompt_review_events.promo_record_id IS
  '備援成功後寫入的 product_promo_generations.id（可從生圖紀錄反查成圖）。';

COMMENT ON TABLE public.prompt_review_events IS
  '描述審核與生圖阻擋：polished=潤飾；blocked=描述攔截；api_blocked=外部生圖 400 且未出圖；api_blocked_fallback=Gemini 400 後 FLUX 備援成功。';

NOTIFY pgrst, 'reload schema';
