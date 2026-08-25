-- 描述審核：潤飾／擋下記錄，供後台檢討
CREATE TABLE IF NOT EXISTS public.prompt_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('polished', 'blocked')),
  original_prompt text NOT NULL DEFAULT '',
  rewritten_prompt text,
  reason text,
  auto_polish boolean,
  client_channel text,
  shoot_mode text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prompt_review_events_created_at_idx
  ON public.prompt_review_events (created_at DESC);
CREATE INDEX IF NOT EXISTS prompt_review_events_user_id_idx
  ON public.prompt_review_events (user_id);
CREATE INDEX IF NOT EXISTS prompt_review_events_action_idx
  ON public.prompt_review_events (action);

ALTER TABLE public.prompt_review_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.prompt_review_events IS
  '描述審核事件：polished=自動潤飾後仍生圖；blocked=攔截無法生圖。';
