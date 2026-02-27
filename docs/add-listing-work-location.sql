-- ============================================
-- 新增 listings 表的工作區域與遠端工作欄位
-- 執行日期：2026-02-06
-- ============================================

-- 1. 新增工作區域欄位（多選）
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS service_location TEXT[] DEFAULT '{}';

-- 2. 新增是否可遠端工作欄位
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT FALSE;

-- 3. 為新增欄位建立索引（提升查詢效能）
CREATE INDEX IF NOT EXISTS idx_listings_service_location 
ON public.listings USING GIN (service_location);

CREATE INDEX IF NOT EXISTS idx_listings_is_remote 
ON public.listings (is_remote);

-- 4. 為現有的 listings 設定預設值
UPDATE public.listings 
SET service_location = '{}', is_remote = FALSE 
WHERE service_location IS NULL OR is_remote IS NULL;

-- ============================================
-- 驗證欄位
-- ============================================
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'listings' 
  AND column_name IN ('service_location', 'is_remote')
ORDER BY ordinal_position;

-- ============================================
-- 台灣常用縣市選項（參考用）
-- ============================================
/*
服務區域建議選項：
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
- 不限區域（遠端工作）
*/

-- ============================================
-- 測試查詢範例
-- ============================================

-- 查詢可遠端工作的 listings
-- SELECT * FROM listings WHERE is_remote = TRUE;

-- 查詢服務台北市的 listings
-- SELECT * FROM listings WHERE '台北市' = ANY(service_location);

-- 查詢服務台北或新北的 listings
-- SELECT * FROM listings 
-- WHERE service_location && ARRAY['台北市', '新北市'];
