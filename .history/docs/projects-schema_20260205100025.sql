-- Projects 表（專案管理）
-- 用於儲存客戶的專案資訊

DROP TABLE IF EXISTS public.projects CASCADE;

CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    category TEXT,
    location TEXT,
    budget_min INTEGER,
    budget_max INTEGER,
    deadline DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT projects_status_check CHECK (status IN ('draft', 'published', 'in_progress', 'completed', 'cancelled'))
);

-- 索引
CREATE INDEX idx_projects_owner ON public.projects(owner_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_created ON public.projects(created_at DESC);

-- RLS 啟用
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS 政策：用戶可以查看自己的專案
CREATE POLICY "Users can view own projects"
    ON public.projects
    FOR SELECT
    USING (
        owner_id IN (
            SELECT id FROM auth.users WHERE id = auth.uid()
        )
    );

-- RLS 政策：用戶可以建立專案
CREATE POLICY "Users can create projects"
    ON public.projects
    FOR INSERT
    WITH CHECK (
        owner_id IN (
            SELECT id FROM auth.users WHERE id = auth.uid()
        )
    );

-- RLS 政策：用戶可以更新自己的專案
CREATE POLICY "Users can update own projects"
    ON public.projects
    FOR UPDATE
    USING (
        owner_id IN (
            SELECT id FROM auth.users WHERE id = auth.uid()
        )
    );

-- RLS 政策：管理員可以查看所有專案
CREATE POLICY "Admins can view all projects"
    ON public.projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 更新時間觸發器
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION update_projects_updated_at();

COMMENT ON TABLE public.projects IS '客戶專案表';
COMMENT ON COLUMN public.projects.owner_id IS '專案擁有者 ID（客戶）';
COMMENT ON COLUMN public.projects.status IS '專案狀態：draft(草稿)、published(已發布)、in_progress(進行中)、completed(已完成)、cancelled(已取消)';
