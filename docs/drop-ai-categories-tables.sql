-- 完全移除 ai_categories 和 ai_subcategories（舊的服務類分類系統）
-- 執行位置：Supabase Dashboard → SQL Editor
-- ⚠️ 警告：此操作不可逆，請確認不再使用專家報價媒合功能

-- Step 1：刪除表（CASCADE 會一併刪除相關政策、索引）
DROP TABLE IF EXISTS public.ai_subcategories CASCADE;
DROP TABLE IF EXISTS public.ai_categories CASCADE;

-- Step 2：確認刪除
SELECT 
    'ai_categories' as table_name,
    to_regclass('public.ai_categories') as exists_check
UNION ALL
SELECT 
    'ai_subcategories' as table_name,
    to_regclass('public.ai_subcategories') as exists_check;

-- 兩者都應顯示 NULL，表示已刪除
