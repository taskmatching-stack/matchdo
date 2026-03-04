-- ============================================================
-- 把「前、後被分開存成兩筆」合併成一筆（不用重新上傳）
-- 適用：同一廠商、同一標題、建立時間接近的兩筆，一筆有 image_url、一筆有 image_url_before
-- 在 Supabase SQL Editor 執行。建議先執行「步驟 1」確認要合併的筆數，再執行「步驟 2」。
-- ============================================================

-- 步驟 1：先查詢「可合併的成對筆」（同一廠商+同標題+時間差 2 分鐘內，且一筆有後、一筆有前）
-- 確認結果無誤後再執行步驟 2
/*
SELECT
  a.id AS id_with_after,
  b.id AS id_with_before,
  a.manufacturer_id,
  a.title,
  a.image_url AS after_url,
  a.image_url_before AS after_before,
  b.image_url AS before_url,
  b.image_url_before AS before_before
FROM public.manufacturer_portfolio a
JOIN public.manufacturer_portfolio b
  ON a.manufacturer_id = b.manufacturer_id
  AND a.title = b.title
  AND a.id < b.id
  AND b.created_at - a.created_at BETWEEN interval '0' AND interval '2 minutes'
WHERE (a.image_url IS NOT NULL AND (a.image_url_before IS NULL OR a.image_url_before = ''))
  AND (b.image_url_before IS NOT NULL AND (b.image_url_before <> ''))
  AND (b.image_url IS NULL OR b.image_url = '' OR b.image_url = a.image_url);
*/

-- 步驟 2：合併——把「有前無後」那筆的 image_url_before 寫入「有後無前」那筆，然後刪除「有前無後」那筆
UPDATE public.manufacturer_portfolio a
SET
  image_url_before = b.image_url_before,
  show_on_media_wall = true,
  updated_at = now()
FROM public.manufacturer_portfolio b
WHERE a.manufacturer_id = b.manufacturer_id
  AND a.title = b.title
  AND a.id < b.id
  AND b.created_at - a.created_at BETWEEN interval '0' AND interval '2 minutes'
  AND a.image_url IS NOT NULL
  AND (a.image_url_before IS NULL OR a.image_url_before = '')
  AND b.image_url_before IS NOT NULL
  AND b.image_url_before <> ''
  AND (b.image_url IS NULL OR b.image_url = '' OR b.image_url = a.image_url);

-- 刪除「只有前」的那一筆（已合併到上面那筆，故刪除多餘的）
DELETE FROM public.manufacturer_portfolio
WHERE id IN (
  SELECT b.id
  FROM public.manufacturer_portfolio a
  JOIN public.manufacturer_portfolio b
    ON a.manufacturer_id = b.manufacturer_id
    AND a.title = b.title
    AND a.id < b.id
    AND b.created_at - a.created_at BETWEEN interval '0' AND interval '2 minutes'
  WHERE a.image_url IS NOT NULL
    AND (a.image_url_before IS NOT NULL AND a.image_url_before <> '')
    AND b.image_url_before IS NOT NULL
    AND (b.image_url IS NULL OR b.image_url = '')
);
