-- 媒體牆範例：一次塞好三類型，首頁就能看到效果
-- 在 Supabase SQL Editor 貼上整段執行即可
-- 前置：須已執行 add-custom-products-show-on-homepage.sql、manufacturer_portfolio 的 show_on_media_wall、media_collections 建表（見 docs/媒體牆三類型-50-30-20-實作說明.md）

-- ========== 1. 用戶設計圖（50%） ==========
-- 若已有客製產品：把有 AI 圖的設成展示
UPDATE public.custom_products
SET show_on_homepage = true
WHERE ai_generated_image_url IS NOT NULL
  AND id IN (
    SELECT id FROM public.custom_products
    WHERE ai_generated_image_url IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 5
  );

-- 若完全沒有可展示的：插 3 筆「用戶設計」範例（標題統一，非範例作品）
INSERT INTO public.custom_products (owner_id, title, description, category, ai_generated_image_url, status, show_on_homepage)
SELECT (SELECT id FROM auth.users LIMIT 1), '用戶設計 A', '媒體牆', NULL, 'https://placehold.co/400x400/555/aaa?text=A', 'completed', true
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1) AND (SELECT count(*) FROM public.custom_products WHERE show_on_homepage = true) = 0;
INSERT INTO public.custom_products (owner_id, title, description, category, ai_generated_image_url, status, show_on_homepage)
SELECT (SELECT id FROM auth.users LIMIT 1), '用戶設計 B', '媒體牆', NULL, 'https://placehold.co/400x400/666/bbb?text=B', 'completed', true
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1) AND (SELECT count(*) FROM public.custom_products WHERE show_on_homepage = true) < 2;
INSERT INTO public.custom_products (owner_id, title, description, category, ai_generated_image_url, status, show_on_homepage)
SELECT (SELECT id FROM auth.users LIMIT 1), '用戶設計 C', '媒體牆', NULL, 'https://placehold.co/400x400/777/ccc?text=C', 'completed', true
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1) AND (SELECT count(*) FROM public.custom_products WHERE show_on_homepage = true) < 3;

-- ========== 2. 廠商作品對比圖（30%）＝兩張圖＋滑桿 ==========
-- 2a 已有廠商作品且有「對比圖」的：設成上媒體牆
UPDATE public.manufacturer_portfolio
SET show_on_media_wall = true
WHERE image_url IS NOT NULL AND image_url_before IS NOT NULL
  AND id IN (SELECT id FROM public.manufacturer_portfolio WHERE image_url IS NOT NULL AND image_url_before IS NOT NULL ORDER BY created_at DESC LIMIT 3);
-- 2b 若沒有任何對比卡：插一筆「對比範例」（需至少有一個廠商）
INSERT INTO public.manufacturer_portfolio (manufacturer_id, title, image_url, image_url_before, show_on_media_wall)
SELECT (SELECT id FROM public.manufacturers WHERE is_active = true LIMIT 1), '對比範例', 'https://placehold.co/400x300/555/aaa?text=%E5%AF%A6%E5%93%81', 'https://placehold.co/400x300/888/ccc?text=%E6%A6%82%E5%BF%B5', true
WHERE EXISTS (SELECT 1 FROM public.manufacturers WHERE is_active = true LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.manufacturer_portfolio WHERE show_on_media_wall = true LIMIT 1);

-- ========== 3. 系列資料夾（20%） ==========
-- 佔位圖建議用灰階以配合靈感牆視覺（前端的 placehold.co 會強制灰階顯示）
-- 使用 DO UPDATE：若已存在（含被關閉的）會一併設回 is_active=true，確保首頁看得到
INSERT INTO public.media_collections (title, slug, cover_image_url, description, sort_order, is_active)
VALUES
  ('系列一', 'collection-1', 'https://placehold.co/600x400/555/aaa?text=1', NULL, 0, true),
  ('系列二', 'collection-2', 'https://placehold.co/600x400/666/bbb?text=2', NULL, 1, true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  cover_image_url = EXCLUDED.cover_image_url,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = true;
