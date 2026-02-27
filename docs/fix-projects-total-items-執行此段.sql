-- 請整段複製，貼到 Supabase 專案 → SQL Editor → 執行 (Run)
-- 用途：分包同步／發包所需欄位一次補齊（只跑一次即可）

-- 1. projects 表（觸發器會更新這兩欄）
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS total_items integer DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS published_items integer DEFAULT 0;

-- 2. project_items 表（後端寫入時會送這些欄位）
ALTER TABLE public.project_items ADD COLUMN IF NOT EXISTS subcategory text;
ALTER TABLE public.project_items ADD COLUMN IF NOT EXISTS quantity decimal(10,2);
ALTER TABLE public.project_items ADD COLUMN IF NOT EXISTS unit text;

-- 3. 依現有 project_items 更新 projects 統計（可選）
UPDATE public.projects p
SET 
    total_items = (SELECT COUNT(*) FROM public.project_items pi WHERE pi.project_id = p.id),
    published_items = (SELECT COUNT(*) FROM public.project_items pi WHERE pi.project_id = p.id AND pi.status IN ('published', 'matched', 'assigned', 'in_progress', 'completed'));
