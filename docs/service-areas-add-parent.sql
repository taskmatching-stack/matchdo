-- =============================================
-- 服務地區：加入 parent_code 支援子地區
-- 在 Supabase SQL Editor 執行
-- =============================================

-- 1. 加 parent_code 欄位（自我參照外鍵）
ALTER TABLE public.service_areas
    ADD COLUMN IF NOT EXISTS parent_code text
    REFERENCES public.service_areas(code) ON DELETE CASCADE;

-- 2. 現有台灣縣市維持 parent_code = NULL（它們直接掛在大區下，不需父節點）
--    海外國家同樣維持 parent_code = NULL（它們是頂層，子城市才會有 parent_code）

-- 3. 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_service_areas_parent ON public.service_areas(parent_code);
CREATE INDEX IF NOT EXISTS idx_service_areas_group  ON public.service_areas(group_code);

-- 驗證
SELECT code, name_zh, group_code, parent_code
FROM   public.service_areas
ORDER  BY group_code, parent_code NULLS FIRST, sort_order
LIMIT  10;
