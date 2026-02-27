-- =============================================
-- 為 projects 表新增預算欄位
-- 功能：支援預媒合功能，儲存發案者的預算範圍
-- 執行時機：在 Supabase SQL Editor 執行
-- =============================================

-- 新增預算欄位（如果不存在）
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS budget_min integer,
ADD COLUMN IF NOT EXISTS budget_max integer;

-- 添加約束：最低預算不能大於最高預算
ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS valid_project_budget;

ALTER TABLE public.projects
ADD CONSTRAINT valid_project_budget CHECK (
    budget_min IS NULL OR 
    budget_max IS NULL OR 
    budget_min <= budget_max
);

-- 添加註解
COMMENT ON COLUMN public.projects.budget_min IS '最低預算（元）- 不公開顯示，僅用於媒合算法';
COMMENT ON COLUMN public.projects.budget_max IS '最高預算（元）- 不公開顯示，僅用於媒合算法';

-- 創建索引（優化媒合查詢效能）
CREATE INDEX IF NOT EXISTS idx_projects_budget ON public.projects(budget_min, budget_max) 
WHERE budget_min IS NOT NULL AND budget_max IS NOT NULL;

-- 驗證
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'projects'
AND column_name IN ('budget_min', 'budget_max');
