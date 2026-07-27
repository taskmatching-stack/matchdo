-- 隱藏所有舊的情境圖（只保留新生成的圖）
-- 執行前請確認：這會將 show_on_homepage 設為 false，只有之後新生成的圖才會顯示

-- 1) 隱藏所有現有情境圖（之後新生成的會自動設為 true）
UPDATE public.product_promo_generations
SET show_on_homepage = false
WHERE status = 'success'
  AND result_image_url IS NOT NULL
  AND show_on_homepage = true;

-- 自查：應該沒有公開的舊圖
-- SELECT count(*) FROM product_promo_generations WHERE show_on_homepage = true;
-- 結果應為 0（之後新生成的圖才會顯示）
