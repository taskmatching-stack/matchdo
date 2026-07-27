-- 隱藏所有舊的測試情境圖（只保留最近的新圖）
-- 執行此 SQL 後，舊圖不會顯示在首頁媒體牆

-- 方案 1：隱藏所有今天之前的舊圖
UPDATE public.product_promo_generations
SET show_on_homepage = false
WHERE created_at < '2026-07-28 00:00:00'
  AND status = 'success';

-- 方案 2：如果要全部清空重來（隱藏所有圖）
-- UPDATE public.product_promo_generations
-- SET show_on_homepage = false
-- WHERE status = 'success';

-- 方案 3：如果要徹底刪除舊圖（無法復原！）
-- DELETE FROM public.product_promo_generations
-- WHERE created_at < '2026-07-28 00:00:00';

-- 確認結果：應該只剩今天的圖是公開的
SELECT 
    count(*) FILTER (WHERE show_on_homepage = true) as 公開數量,
    count(*) FILTER (WHERE show_on_homepage = false) as 隱藏數量,
    count(*) as 總數
FROM product_promo_generations
WHERE status = 'success';
