-- 商攝・空間攝影 Beta：申訴／退點審核紀錄
-- 失敗鎖定以「該使用者最近一次 rejected」+ 24h 計算（見 API）

CREATE TABLE IF NOT EXISTS public.promo_space_appeals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    generation_id uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('approved', 'rejected', 'inconclusive')),
    refunded_points integer NOT NULL DEFAULT 0,
    refund_transaction_id uuid,
    original_credit_transaction_id uuid,
    judge_json jsonb,
    judge_model text,
    reason_zh text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_space_appeals_user_created
    ON public.promo_space_appeals (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_promo_space_appeals_generation
    ON public.promo_space_appeals (generation_id, created_at DESC);

-- 同一生成圖僅能成功退點一次
CREATE UNIQUE INDEX IF NOT EXISTS uq_promo_space_appeals_generation_approved
    ON public.promo_space_appeals (generation_id)
    WHERE status = 'approved';

COMMENT ON TABLE public.promo_space_appeals IS '空間攝影 Beta 申訴：Gemini 讀圖對比 JSON 裁決後退點';
