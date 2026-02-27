-- ============================================
-- 新增 projects 表的專案地點欄位
-- 執行日期：2026-02-06
-- ============================================

-- 1. 新增專案地點欄位（單選，存為陣列格式）
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS project_location TEXT[] DEFAULT '{}';

-- 2. 為新增欄位建立索引（提升查詢效能）
CREATE INDEX IF NOT EXISTS idx_projects_location 
ON public.projects USING GIN (project_location);

-- 3. 為現有的 projects 設定預設值
UPDATE public.projects 
SET project_location = '{}' 
WHERE project_location IS NULL;

-- ============================================
-- 驗證欄位
-- ============================================
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'projects' 
  AND column_name = 'project_location'
ORDER BY ordinal_position;

-- ============================================
-- 台灣常用縣市選項（與 listings 相同）
-- ============================================
/*
專案地點建議選項：
- 台北市
- 新北市
- 桃園市
- 台中市
- 台南市
- 高雄市
- 基隆市
- 新竹市
- 新竹縣
- 苗栗縣
- 彰化縣
- 南投縣
- 雲林縣
- 嘉義市
- 嘉義縣
- 屏東縣
- 宜蘭縣
- 花蓮縣
- 台東縣
- 澎湖縣
- 金門縣
- 連江縣
- 全台灣
- 不限區域（遠端專案）
*/

-- ============================================
-- 測試查詢範例
-- ============================================

-- 查詢台北市的專案
-- SELECT * FROM projects WHERE '台北市' = ANY(project_location);

-- 查詢台北或新北的專案
-- SELECT * FROM projects 
-- WHERE project_location && ARRAY['台北市', '新北市'];

-- 媒合範例：查詢專家服務區域與專案地點有交集的
-- SELECT l.*, p.* 
-- FROM listings l
-- CROSS JOIN projects p
-- WHERE l.service_location && p.project_location
--    OR l.is_remote = TRUE;

-- ============================================
-- 注意事項
-- ============================================
/*
隱私考量：
- 專案地點僅存縣市層級（如：台北市、新北市）
- 不儲存詳細地址或區域資訊，保護發案商隱私
- 媒合成交後，雙方可自行交換詳細地址
*/
