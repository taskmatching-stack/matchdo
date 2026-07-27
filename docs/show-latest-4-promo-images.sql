-- 讓最新的4張情境圖顯示在首頁
UPDATE public.product_promo_generations
SET show_on_homepage = true
WHERE id IN (
    SELECT id 
    FROM product_promo_generations 
    WHERE status = 'success' 
      AND result_image_url IS NOT NULL
    ORDER BY created_at DESC 
    LIMIT 4
);

-- 確認結果
SELECT id, created_at, show_on_homepage, user_prompt, result_image_url
FROM product_promo_generations
WHERE status = 'success'
ORDER BY created_at DESC
LIMIT 10;
