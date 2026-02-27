-- ========================================
-- 為 projects 表增加 subcategory 欄位
-- 用於儲存專案所屬的子分類（支援多選）
-- ========================================

-- 1. 新增 subcategory 欄位（JSONB 陣列）
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS subcategory JSONB DEFAULT '[]'::jsonb;

-- 2. 註解說明
COMMENT ON COLUMN public.projects.subcategory IS '所選子分類名稱陣列，例：["清潔服務","家電 燈具"]';

-- 3. 驗證
SELECT 
    column_name, 
    data_type, 
    column_default, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'projects'
  AND column_name = 'subcategory';
