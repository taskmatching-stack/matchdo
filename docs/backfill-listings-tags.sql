-- ============================================================
-- 為現有 listings 補上 TAGS（若為 NULL 或空陣列）
-- 說明：模擬資料腳本 (scripts/generate-test-data.js 等) 本身有寫入 tags，
--       若 DB 是舊版或手動建的導致沒有 tags，可執行此段補齊。
-- 執行：在 Supabase SQL Editor 或 psql 執行
-- ============================================================

-- 1. 先查看目前有多少筆缺少 tags（NULL 或空陣列）
SELECT category, COUNT(*) AS cnt
FROM listings
WHERE (tags IS NULL OR tags = '{}')
GROUP BY category;

-- 2. 依分類補上預設 tags（僅更新 tags 為 NULL 或空陣列者）
UPDATE listings
SET tags = CASE category
    WHEN 'home'     THEN ARRAY['居家', '裝潢', '施工']::text[]
    WHEN 'video'    THEN ARRAY['影片', '拍攝', '剪輯']::text[]
    WHEN 'web'      THEN ARRAY['網站', '開發', 'RWD']::text[]
    WHEN 'app'      THEN ARRAY['APP', '開發', '手機']::text[]
    WHEN 'ai'       THEN ARRAY['AI', '顧問', '數位轉型']::text[]
    WHEN 'marketing' THEN ARRAY['行銷', '數位', '廣告']::text[]
    WHEN 'design'   THEN ARRAY['設計', '平面', '視覺']::text[]
    ELSE ARRAY[category, '服務']::text[]
END
WHERE (tags IS NULL OR tags = '{}');

-- 3. 確認：缺少 tags 的筆數應為 0
SELECT COUNT(*) AS still_missing_tags FROM listings WHERE (tags IS NULL OR tags = '{}');
