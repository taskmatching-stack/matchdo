-- 會員降級通知（站內／稽核留存）— 見 docs/PLAN-free-tier-90d-retention.md P3
-- 記錄降級告知文案、緩衝截止與使用者確認時間，供爭議查核

CREATE TABLE IF NOT EXISTS public.membership_downgrade_notices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notice_kind text NOT NULL,
    message_version text NOT NULL DEFAULT '2026-09-09-v1',
    title text NOT NULL,
    body_text text NOT NULL,
    payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    wall_grace_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    first_shown_at timestamptz,
    acknowledged_at timestamptz,
    acknowledged_via text
);

COMMENT ON TABLE public.membership_downgrade_notices IS '付費降級免費之告知紀錄（含 15 日緩衝說明）；acknowledged_at 為使用者已讀確認';
COMMENT ON COLUMN public.membership_downgrade_notices.notice_kind IS 'involuntary_wall_grace | voluntary_immediate';
COMMENT ON COLUMN public.membership_downgrade_notices.acknowledged_via IS 'login_modal | credits_page | api';

CREATE INDEX IF NOT EXISTS idx_mdn_user_pending
    ON public.membership_downgrade_notices (user_id, created_at DESC)
    WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mdn_user_created
    ON public.membership_downgrade_notices (user_id, created_at DESC);

ALTER TABLE public.membership_downgrade_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own downgrade notices" ON public.membership_downgrade_notices;
CREATE POLICY "users read own downgrade notices"
    ON public.membership_downgrade_notices FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users acknowledge own downgrade notices" ON public.membership_downgrade_notices;
CREATE POLICY "users acknowledge own downgrade notices"
    ON public.membership_downgrade_notices FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
