-- ============================================================
-- 對照圖被存成兩筆時：找出重複、並刪除多餘一筆（保留一筆）
-- 在 Supabase SQL Editor 執行。
-- ============================================================

-- 步驟 1：先「查詢」看哪些是重複（同廠商、同標題、都有前後圖、建立時間差 2 分鐘內）
-- 確認無誤後再執行步驟 2
/*
SELECT a.id AS keep_id, b.id AS duplicate_id, a.manufacturer_id, a.title, a.created_at
FROM public.manufacturer_portfolio a
JOIN public.manufacturer_portfolio b
  ON a.manufacturer_id = b.manufacturer_id
  AND a.title = b.title
  AND a.id < b.id
  AND a.image_url IS NOT NULL
  AND a.image_url_before IS NOT NULL
  AND b.image_url IS NOT NULL
  AND b.image_url_before IS NOT NULL
  AND b.created_at - a.created_at BETWEEN interval '0' AND interval '2 minutes';
*/

-- 步驟 2：刪除「重複的那一筆」（保留 id 較小、即較早建立的那筆）
-- 若你的重複是「同一組對照圖兩筆」，執行下面這行會把較晚建立的那筆刪掉
DELETE FROM public.manufacturer_portfolio
WHERE id IN (
  SELECT b.id
  FROM public.manufacturer_portfolio a
  JOIN public.manufacturer_portfolio b
    ON a.manufacturer_id = b.manufacturer_id
    AND a.title = b.title
    AND a.id < b.id
    AND a.image_url IS NOT NULL
    AND a.image_url_before IS NOT NULL
    AND b.image_url IS NOT NULL
    AND b.image_url_before IS NOT NULL
    AND b.created_at - a.created_at BETWEEN interval '0' AND interval '2 minutes'
);
