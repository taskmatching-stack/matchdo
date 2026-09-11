-- prompt_review_events：新增外部生圖 API safety 400 紀錄（api_blocked）
ALTER TABLE public.prompt_review_events DROP CONSTRAINT IF EXISTS prompt_review_events_action_check;
ALTER TABLE public.prompt_review_events ADD CONSTRAINT prompt_review_events_action_check
  CHECK (action IN ('polished', 'blocked', 'api_blocked'));

COMMENT ON TABLE public.prompt_review_events IS
  '描述審核與生圖阻擋：polished=自動潤飾；blocked=描述審核攔截；api_blocked=Gemini/外部生圖 safety 400。';

NOTIFY pgrst, 'reload schema';
