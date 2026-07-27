-- 既有情境圖補上媒體牆（在 add-promo-show-on-homepage.sql 之後執行一次）
-- 原因：舊紀錄 show_on_homepage 預設 false，且多數 source_type 為 digital_asset 而非 custom_product

-- 1) digital_asset → 依 source_image_url 對回使用者的 custom_products
UPDATE public.product_promo_generations AS pg
SET source_type = 'custom_product',
    source_id = cp.id
FROM public.custom_products AS cp
WHERE pg.status = 'success'
  AND pg.result_image_url IS NOT NULL
  AND pg.source_type = 'digital_asset'
  AND pg.source_image_url IS NOT NULL
  AND cp.owner_id = pg.user_id
  AND (
    trim(cp.ai_generated_image_url) = trim(pg.source_image_url)
    OR trim(cp.reference_image_url) = trim(pg.source_image_url)
    OR split_part(trim(cp.ai_generated_image_url), '?', 1) = split_part(trim(pg.source_image_url), '?', 1)
    OR split_part(trim(cp.reference_image_url), '?', 1) = split_part(trim(pg.source_image_url), '?', 1)
  );

-- 2) custom_product 但缺 source_id → 同上比對
UPDATE public.product_promo_generations AS pg
SET source_id = cp.id
FROM public.custom_products AS cp
WHERE pg.status = 'success'
  AND pg.source_type = 'custom_product'
  AND pg.source_id IS NULL
  AND pg.source_image_url IS NOT NULL
  AND cp.owner_id = pg.user_id
  AND (
    trim(cp.ai_generated_image_url) = trim(pg.source_image_url)
    OR trim(cp.reference_image_url) = trim(pg.source_image_url)
    OR split_part(trim(cp.ai_generated_image_url), '?', 1) = split_part(trim(pg.source_image_url), '?', 1)
    OR split_part(trim(cp.reference_image_url), '?', 1) = split_part(trim(pg.source_image_url), '?', 1)
  );

-- 3) 可連原設計的成功情境圖 → 設為公開（付費用戶可之後在資產庫關閉）
UPDATE public.product_promo_generations
SET show_on_homepage = true
WHERE status = 'success'
  AND result_image_url IS NOT NULL
  AND source_type = 'custom_product'
  AND source_id IS NOT NULL
  AND show_on_homepage IS DISTINCT FROM true;

-- 4) 廠商區 vendor_asset 情境圖（舊版寫入 show_on_homepage=false，媒體牆只收 custom_product）
UPDATE public.product_promo_generations
SET show_on_homepage = true
WHERE status = 'success'
  AND result_image_url IS NOT NULL
  AND source_type = 'vendor_asset'
  AND source_id IS NOT NULL
  AND show_on_homepage IS DISTINCT FROM true;

-- 自查：應有列數 > 0 才會在首頁「情境圖」看到
-- SELECT count(*) FROM product_promo_generations
-- WHERE status = 'success' AND show_on_homepage = true
--   AND source_type IN ('custom_product', 'vendor_asset') AND source_id IS NOT NULL;
