-- 攝影模擬 App 已生成、管理區有紀錄但首頁「情境圖」看不到時執行一次
-- 原因：舊版媒體牆 API 只查 source_type=custom_product|vendor_asset，略過 upload/digital_asset；
--       或 show_on_homepage 仍為 false（migration 預設）。

-- 1) 攝影模擬／上傳參考圖的情境圖 → 設為公開上牆
UPDATE public.product_promo_generations
SET show_on_homepage = true
WHERE status = 'success'
  AND result_image_url IS NOT NULL
  AND show_on_homepage IS DISTINCT FROM true
  AND source_type IN ('upload', 'digital_asset');

-- 2) 自查（應 > 0 才會在首頁「情境圖」看到）
-- SELECT count(*) FROM product_promo_generations
-- WHERE status = 'success' AND show_on_homepage = true
--   AND source_type IN ('custom_product', 'vendor_asset', 'upload', 'digital_asset');
