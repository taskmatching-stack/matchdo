-- =============================================
-- Project Items 專案分包項目表 Schema
-- 功能：支援統包/分包模式，可儲存分項後個別發包
-- =============================================

-- 先在 projects 表新增統包/分包欄位
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS project_type text DEFAULT 'turnkey' CHECK (project_type IN ('turnkey', 'split')),
ADD COLUMN IF NOT EXISTS total_items integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS published_items integer DEFAULT 0;

COMMENT ON COLUMN public.projects.project_type IS '專案類型：turnkey=統包, split=分包';
COMMENT ON COLUMN public.projects.total_items IS '分包項目總數';
COMMENT ON COLUMN public.projects.published_items IS '已發包項目數';

-- 建立分包項目表
CREATE TABLE IF NOT EXISTS public.project_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    item_name text NOT NULL,
    item_description text,
    category_id uuid REFERENCES public.ai_categories(id),
    category_name text,
    budget_min integer,
    budget_max integer,
    requirements jsonb DEFAULT '{}'::jsonb,
    
    -- 發包狀態
    status text DEFAULT 'draft' CHECK (status IN (
        'draft',        -- 草稿（已儲存未發包）
        'published',    -- 已發包
        'matched',      -- 已媒合
        'assigned',     -- 已指派廠商
        'in_progress',  -- 進行中
        'completed',    -- 已完成
        'cancelled'     -- 已取消
    )),
    
    -- 優先順序（用於排序）
    priority integer DEFAULT 0,
    
    -- 時間戳記
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    published_at timestamptz,
    matched_at timestamptz,
    
    -- 索引約束
    CONSTRAINT valid_budget CHECK (budget_min <= budget_max OR budget_max IS NULL)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_project_items_project_id ON public.project_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_items_status ON public.project_items(status);
CREATE INDEX IF NOT EXISTS idx_project_items_category_id ON public.project_items(category_id);
CREATE INDEX IF NOT EXISTS idx_project_items_published_at ON public.project_items(published_at DESC);

-- 複合索引（常用查詢）
CREATE INDEX IF NOT EXISTS idx_project_items_project_status ON public.project_items(project_id, status);

-- 添加註解
COMMENT ON TABLE public.project_items IS '專案分包項目（支援個別發包）';
COMMENT ON COLUMN public.project_items.id IS '分包項目唯一識別碼';
COMMENT ON COLUMN public.project_items.project_id IS '所屬專案ID';
COMMENT ON COLUMN public.project_items.item_name IS '分項名稱（例如：水電工程、油漆工程）';
COMMENT ON COLUMN public.project_items.item_description IS '分項詳細說明';
COMMENT ON COLUMN public.project_items.status IS '狀態：draft=草稿, published=已發包, matched=已媒合, assigned=已指派, in_progress=進行中, completed=已完成, cancelled=已取消';
COMMENT ON COLUMN public.project_items.priority IS '優先順序（數字越大優先級越高）';

-- 啟用 RLS
ALTER TABLE public.project_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1. 專案擁有者可以查看自己的分包項目
DROP POLICY IF EXISTS "Project owners can view own items" ON public.project_items;
CREATE POLICY "Project owners can view own items"
    ON public.project_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = project_items.project_id
            AND user_id = auth.uid()
        )
    );

-- 2. 已發包的項目專家可以查看
DROP POLICY IF EXISTS "Published items are visible to experts" ON public.project_items;
CREATE POLICY "Published items are visible to experts"
    ON public.project_items FOR SELECT
    USING (status IN ('published', 'matched', 'assigned', 'in_progress', 'completed'));

-- 3. 專案擁有者可以新增分包項目
DROP POLICY IF EXISTS "Project owners can insert items" ON public.project_items;
CREATE POLICY "Project owners can insert items"
    ON public.project_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = project_items.project_id
            AND user_id = auth.uid()
        )
    );

-- 4. 專案擁有者可以更新自己的分包項目
DROP POLICY IF EXISTS "Project owners can update own items" ON public.project_items;
CREATE POLICY "Project owners can update own items"
    ON public.project_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = project_items.project_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = project_items.project_id
            AND user_id = auth.uid()
        )
    );

-- 5. 專案擁有者可以刪除自己的分包項目（僅草稿狀態）
DROP POLICY IF EXISTS "Project owners can delete draft items" ON public.project_items;
CREATE POLICY "Project owners can delete draft items"
    ON public.project_items FOR DELETE
    USING (
        status = 'draft' AND
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = project_items.project_id
            AND user_id = auth.uid()
        )
    );

-- 6. 管理員可以查看所有分包項目
DROP POLICY IF EXISTS "Admins can view all items" ON public.project_items;
CREATE POLICY "Admins can view all items"
    ON public.project_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 建立自動更新 updated_at 的觸發器
CREATE OR REPLACE FUNCTION update_project_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    
    -- 當狀態變為 published 時，記錄發包時間
    IF NEW.status = 'published' AND OLD.status != 'published' THEN
        NEW.published_at = now();
    END IF;
    
    -- 當狀態變為 matched 時，記錄媒合時間
    IF NEW.status = 'matched' AND OLD.status != 'matched' THEN
        NEW.matched_at = now();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_items_updated_at_trigger ON public.project_items;
CREATE TRIGGER update_project_items_updated_at_trigger
    BEFORE UPDATE ON public.project_items
    FOR EACH ROW
    EXECUTE FUNCTION update_project_items_updated_at();

-- 建立觸發器：自動更新 projects 表的統計
CREATE OR REPLACE FUNCTION update_project_items_count()
RETURNS TRIGGER AS $$
BEGIN
    -- 更新專案的分包項目統計
    UPDATE public.projects
    SET 
        total_items = (
            SELECT COUNT(*)
            FROM public.project_items
            WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
        ),
        published_items = (
            SELECT COUNT(*)
            FROM public.project_items
            WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
            AND status IN ('published', 'matched', 'assigned', 'in_progress', 'completed')
        )
    WHERE id = COALESCE(NEW.project_id, OLD.project_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_items_count_trigger ON public.project_items;
CREATE TRIGGER update_project_items_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.project_items
    FOR EACH ROW
    EXECUTE FUNCTION update_project_items_count();

-- 建立檢視：專案分包項目摘要
CREATE OR REPLACE VIEW public.project_items_summary AS
SELECT 
    p.id as project_id,
    p.title as project_title,
    p.project_type,
    COUNT(pi.id) as total_items,
    COUNT(pi.id) FILTER (WHERE pi.status = 'draft') as draft_items,
    COUNT(pi.id) FILTER (WHERE pi.status = 'published') as published_items,
    COUNT(pi.id) FILTER (WHERE pi.status = 'matched') as matched_items,
    COUNT(pi.id) FILTER (WHERE pi.status IN ('assigned', 'in_progress')) as active_items,
    COUNT(pi.id) FILTER (WHERE pi.status = 'completed') as completed_items,
    SUM(COALESCE(pi.budget_min, 0)) as total_budget_min,
    SUM(COALESCE(pi.budget_max, 0)) as total_budget_max
FROM public.projects p
LEFT JOIN public.project_items pi ON pi.project_id = p.id
WHERE p.project_type = 'split'
GROUP BY p.id, p.title, p.project_type;

COMMENT ON VIEW public.project_items_summary IS '專案分包項目統計摘要';

-- 建立輔助函數：批量發包分項
CREATE OR REPLACE FUNCTION publish_project_items(
    target_project_id uuid,
    item_ids uuid[] DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
    published_count integer;
BEGIN
    IF item_ids IS NULL THEN
        -- 發包所有草稿狀態的分項
        UPDATE public.project_items
        SET status = 'published'
        WHERE project_id = target_project_id
        AND status = 'draft';
    ELSE
        -- 發包指定的分項
        UPDATE public.project_items
        SET status = 'published'
        WHERE project_id = target_project_id
        AND id = ANY(item_ids)
        AND status = 'draft';
    END IF;
    
    GET DIAGNOSTICS published_count = ROW_COUNT;
    RETURN published_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION publish_project_items IS '批量發包分項（可指定特定分項或全部草稿分項）';

-- 驗證建立結果
SELECT 
    'project_items 表建立成功！' as message,
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_items,
    COUNT(*) FILTER (WHERE status = 'published') as published_items
FROM public.project_items;
