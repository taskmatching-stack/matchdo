-- =============================================
-- 為 projects 表新增 total_items / published_items 欄位
-- 用途：project_items 的觸發器 update_project_items_count 會更新這兩欄
-- 若未執行過 project-items-schema.sql 的 projects 欄位區塊，執行此檔即可
-- =============================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
        -- 若欄位不存在才新增，避免重複執行報錯
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'total_items') THEN
            ALTER TABLE public.projects ADD COLUMN total_items integer DEFAULT 0;
            COMMENT ON COLUMN public.projects.total_items IS '分包項目總數（由 project_items 觸發器維護）';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'published_items') THEN
            ALTER TABLE public.projects ADD COLUMN published_items integer DEFAULT 0;
            COMMENT ON COLUMN public.projects.published_items IS '已發包項目數（由 project_items 觸發器維護）';
        END IF;
    END IF;
END $$;

-- 可選：立即依現有 project_items 更新統計
UPDATE public.projects p
SET 
    total_items = (SELECT COUNT(*) FROM public.project_items pi WHERE pi.project_id = p.id),
    published_items = (SELECT COUNT(*) FROM public.project_items pi WHERE pi.project_id = p.id AND pi.status IN ('published', 'matched', 'assigned', 'in_progress', 'completed'))
WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'total_items');
