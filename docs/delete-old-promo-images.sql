-- 徹底刪除所有舊情境圖（只保留今天的新圖）
-- ⚠️ 此操作無法復原，請確認後執行

-- 1) 刪除今天之前的所有情境圖
DELETE FROM public.product_promo_generations
WHERE created_at < '2026-07-28 00:00:00';

-- 2) 確保今天的圖設為公開
UPDATE public.product_promo_generations
SET show_on_homepage = true
WHERE created_at >= '2026-07-28 00:00:00'
  AND status = 'success'
  AND result_image_url IS NOT NULL;

-- 3) 自查：應該只剩今天的圖
SELECT count(*) as total_count,
       count(CASE WHEN show_on_homepage = true THEN 1 END) as public_count
FROM product_promo_generations;
