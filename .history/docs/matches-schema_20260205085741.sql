-- =============================================
-- Matches 媒合記錄表 Schema
-- 功能：記錄專案與專家報價的媒合結果
-- =============================================

-- 清理舊資料（重新建立時使用）
DROP TABLE IF EXISTS public.matches CASCADE;
DROP FUNCTION IF EXISTS update_match_status CASCADE;

-- 建立 matches 表
CREATE TABLE IF NOT EXISTS public.matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    expert_listing_id uuid REFERENCES public.expert_listings(id) ON DELETE CASCADE,
    expert_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    match_score decimal(5,2) CHECK (match_score >= 0 AND match_score <= 100),
    match_reasons jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'rejected', 'contacted')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- 確保同一組合只有一筆記錄
    UNIQUE(project_id, expert_listing_id)
);

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_matches_project_id ON public.matches(project_id);
CREATE INDEX IF NOT EXISTS idx_matches_expert_listing_id ON public.matches(expert_listing_id);
CREATE INDEX IF NOT EXISTS idx_matches_expert_id ON public.matches(expert_id);
CREATE INDEX IF NOT EXISTS idx_matches_client_id ON public.matches(client_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_score ON public.matches(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON public.matches(created_at DESC);

-- 建立複合索引（常用查詢組合）
CREATE INDEX IF NOT EXISTS idx_matches_project_status ON public.matches(project_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_expert_status ON public.matches(expert_id, status);

-- 添加欄位註解
COMMENT ON TABLE public.matches IS '專案與專家報價的媒合記錄';
COMMENT ON COLUMN public.matches.id IS '媒合記錄唯一識別碼';
COMMENT ON COLUMN public.matches.project_id IS '專案ID';
COMMENT ON COLUMN public.matches.expert_listing_id IS '專家報價ID';
COMMENT ON COLUMN public.matches.expert_id IS '專家用戶ID';
COMMENT ON COLUMN public.matches.client_id IS '發案者用戶ID';
COMMENT ON COLUMN public.matches.match_score IS '媒合分數 (0-100)';
COMMENT ON COLUMN public.matches.match_reasons IS '媒合原因 JSON {"keywords": [...], "budget_match": true, "location_match": true}';
COMMENT ON COLUMN public.matches.status IS '媒合狀態：active=有效, archived=已封存, rejected=已拒絕, contacted=已聯繫';
COMMENT ON COLUMN public.matches.created_at IS '建立時間';
COMMENT ON COLUMN public.matches.updated_at IS '最後更新時間';

-- 啟用 RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1. 專家可以查看媒合到自己的專案
DROP POLICY IF EXISTS "Experts can view their matches" ON public.matches;
CREATE POLICY "Experts can view their matches"
    ON public.matches FOR SELECT
    USING (expert_id = auth.uid());

-- 2. 發案者可以查看自己專案的媒合結果
DROP POLICY IF EXISTS "Clients can view their project matches" ON public.matches;
CREATE POLICY "Clients can view their project matches"
    ON public.matches FOR SELECT
    USING (client_id = auth.uid());

-- 3. 系統（service_role）可以插入媒合記錄
DROP POLICY IF EXISTS "System can insert matches" ON public.matches;
CREATE POLICY "System can insert matches"
    ON public.matches FOR INSERT
    WITH CHECK (true);

-- 4. 雙方都可以更新媒合狀態（例如標記為已聯繫）
DROP POLICY IF EXISTS "Users can update their matches" ON public.matches;
CREATE POLICY "Users can update their matches"
    ON public.matches FOR UPDATE
    USING (
        expert_id = auth.uid() OR 
        client_id = auth.uid()
    );

-- 5. 管理員可以查看所有媒合記錄
DROP POLICY IF EXISTS "Admins can view all matches" ON public.matches;
CREATE POLICY "Admins can view all matches"
    ON public.matches FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 建立自動更新 updated_at 的觸發器
CREATE OR REPLACE FUNCTION update_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_matches_updated_at_trigger ON public.matches;
CREATE TRIGGER update_matches_updated_at_trigger
    BEFORE UPDATE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION update_matches_updated_at();

-- 驗證建立結果
SELECT 
    'matches 表建立成功！' as message,
    COUNT(*) as total_matches
FROM public.matches;
