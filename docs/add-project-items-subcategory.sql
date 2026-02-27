-- =============================================
-- 為 project_items 表新增子分類欄位
-- 用途：支援媒合演算法的子分類匹配（20%評分）
-- =============================================

-- 1. 新增子分類欄位
ALTER TABLE public.project_items
ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- 2. 新增外鍵約束（確保子分類存在）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ai_subcategories'
    ) THEN
        ALTER TABLE public.project_items
        ADD CONSTRAINT fk_project_items_subcategory
        FOREIGN KEY (subcategory) REFERENCES public.ai_subcategories(key)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 3. 建立索引（優化查詢效能）
CREATE INDEX IF NOT EXISTS idx_project_items_subcategory 
ON public.project_items(subcategory);

-- 4. 複合索引（常用查詢：project_id + subcategory）
CREATE INDEX IF NOT EXISTS idx_project_items_project_subcategory 
ON public.project_items(project_id, subcategory);

-- 5. 新增欄位註解
COMMENT ON COLUMN public.project_items.subcategory IS '子分類 key，對應 ai_subcategories.key，用於媒合評分';

-- 6. 驗證結果
SELECT 
    'project_items 表已新增 subcategory 欄位' as message,
    COUNT(*) as total_items,
    COUNT(subcategory) as with_subcategory
FROM public.project_items;
