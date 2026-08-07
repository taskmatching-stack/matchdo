-- 種子廠商作品：一律不上公開媒體牆（show_on_media_wall=false）
-- 訪客靈感牆仍可由 admin/tester 內部預覽；此欄僅影響 DB 標記與後台「公開」徽章
UPDATE public.manufacturer_portfolio mp
SET show_on_media_wall = false
FROM public.manufacturers m
WHERE mp.manufacturer_id = m.id
  AND m.vendor_source = 'seed'
  AND mp.show_on_media_wall IS DISTINCT FROM false;

-- 關閉媒體牆範例資料夾（系列一／系列二 placeholder，非種子廠商上傳）
UPDATE public.media_collections
SET is_active = false
WHERE slug IN ('collection-1', 'collection-2')
  AND is_active IS DISTINCT FROM false;

SELECT 'backfill-seed-portfolio-hide-media-wall 完成' AS message;
