-- =============================================
-- 承包商／專家作品集表（呈現自己的作品）
-- 執行：Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS public.expert_portfolio (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    image_url text,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expert_portfolio_expert_id ON public.expert_portfolio(expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_portfolio_sort ON public.expert_portfolio(expert_id, sort_order);

COMMENT ON TABLE public.expert_portfolio IS '承包商／專家作品集（呈現自己的作品）';

ALTER TABLE public.expert_portfolio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Experts can view own portfolio" ON public.expert_portfolio;
CREATE POLICY "Experts can view own portfolio"
    ON public.expert_portfolio FOR SELECT
    USING (expert_id = auth.uid());

DROP POLICY IF EXISTS "Experts can insert own portfolio" ON public.expert_portfolio;
CREATE POLICY "Experts can insert own portfolio"
    ON public.expert_portfolio FOR INSERT
    WITH CHECK (expert_id = auth.uid());

DROP POLICY IF EXISTS "Experts can update own portfolio" ON public.expert_portfolio;
CREATE POLICY "Experts can update own portfolio"
    ON public.expert_portfolio FOR UPDATE
    USING (expert_id = auth.uid());

DROP POLICY IF EXISTS "Experts can delete own portfolio" ON public.expert_portfolio;
CREATE POLICY "Experts can delete own portfolio"
    ON public.expert_portfolio FOR DELETE
    USING (expert_id = auth.uid());

-- 公開讀取：所有人可看專家作品（用於廠商頁、搜尋等）
DROP POLICY IF EXISTS "Public can view portfolio" ON public.expert_portfolio;
CREATE POLICY "Public can view portfolio"
    ON public.expert_portfolio FOR SELECT
    USING (true);
