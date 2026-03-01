-- =============================================
-- 服務地區 v2：正確三層結構
-- 台灣 → 縣市（2層）
-- 海外國家 → 州/地區 → 城市（3層）
-- 在 Supabase SQL Editor 執行
-- =============================================

-- 1. 確保 parent_code 欄位存在
ALTER TABLE public.service_areas
    ADD COLUMN IF NOT EXISTS parent_code text
    REFERENCES public.service_areas(code) ON DELETE CASCADE;

-- 2. 新增 area_type 欄位：方便前端知道節點類型
--    'country'  = 台灣本身 或 海外國家（第一層）
--    'tw_city'  = 台灣縣市（葉節點，第二層）
--    'state'    = 海外州/地區（第二層，可有子城市）
--    'city'     = 海外城市（葉節點，第三層）
ALTER TABLE public.service_areas
    ADD COLUMN IF NOT EXISTS area_type text NOT NULL DEFAULT 'tw_city';

-- 3. 更新現有台灣縣市的 area_type
UPDATE public.service_areas
SET area_type = 'tw_city'
WHERE group_code IN ('TW-N','TW-C','TW-S','TW-E','TW-O')
  AND (parent_code IS NULL);

-- 4. 更新現有海外國家的 area_type（目前 parent_code 為 null 的 OVERSEAS 項目）
UPDATE public.service_areas
SET area_type = 'country'
WHERE group_code = 'OVERSEAS'
  AND (parent_code IS NULL);

-- 5. 插入「台灣」本身作為頂層國家節點（如果尚未存在）
INSERT INTO public.service_areas
    (code, name_zh, name_en, group_code, group_zh, group_en, sort_order, area_type, parent_code, is_active)
VALUES
    ('TW', '台灣', 'Taiwan', 'ASIA', '亞洲', 'Asia', 1, 'country', NULL, true)
ON CONFLICT (code) DO UPDATE SET
    name_zh = EXCLUDED.name_zh,
    name_en = EXCLUDED.name_en,
    area_type = 'country';

-- 6. 將台灣縣市的 parent_code 設為 'TW'
UPDATE public.service_areas
SET parent_code = 'TW'
WHERE group_code IN ('TW-N','TW-C','TW-S','TW-E','TW-O')
  AND area_type = 'tw_city'
  AND (parent_code IS NULL OR parent_code != 'TW');

-- 7. 索引
CREATE INDEX IF NOT EXISTS idx_sa_parent ON public.service_areas(parent_code);
CREATE INDEX IF NOT EXISTS idx_sa_type   ON public.service_areas(area_type);

-- 驗證結果
SELECT area_type, count(*) FROM public.service_areas GROUP BY area_type;
SELECT code, name_zh, area_type, parent_code, group_code
FROM   public.service_areas
ORDER  BY area_type, group_code, sort_order
LIMIT  20;
