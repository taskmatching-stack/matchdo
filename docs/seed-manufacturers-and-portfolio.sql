-- 製作方假資料 + 作品集（訂製品「找製作方」、圖庫找廠商、首頁靈感牆用）。執行：Supabase SQL Editor。
-- 說明、清除方式、測試帳號：見 matchdo-todo.md「模擬資料／種子」章節。
--
-- 若「圖庫找廠商」或「首頁靈感牆」沒有顯示廠商作品：① 請執行本 SQL 一次（會插入製作方與作品）；② 後端 .env 請設 SUPABASE_SERVICE_ROLE_KEY（不要只設 anon key），否則 RLS 可能擋住讀取。

-- 1. 插入製作方（categories 對應訂製品主分類 key：apparel / furniture / sports_goods 等）
INSERT INTO public.manufacturers (name, description, categories, contact_json, location, capabilities, rating, review_count, is_active, verified) VALUES
('示範服飾工坊', '服飾打樣與小量生產，西裝、洋裝、訂製衫', ARRAY['apparel'], 
 '{"phone": "", "email": "demo-apparel@example.com", "line_id": ""}'::jsonb,
 '台北市', ARRAY['快速打樣', '小量生產'], 4.5, 0, true, false),

('示範家具工作室', '木作與家具訂製，沙發、桌椅、收納', ARRAY['furniture', 'sofa_furniture'], 
 '{"phone": "", "email": "demo-furniture@example.com", "line_id": ""}'::jsonb,
 '新北市', ARRAY['客製化設計', '環保材料'], 4.6, 0, true, false),

('示範運動用品坊', '運動服、包袋、周邊小量訂製', ARRAY['sports_goods', 'bag'], 
 '{"phone": "", "email": "demo-sports@example.com", "line_id": ""}'::jsonb,
 '台中市', ARRAY['快速打樣'], 4.4, 0, true, false),

('示範西裝訂製', '正裝與禮服訂製', ARRAY['apparel'], 
 '{"phone": "", "email": "demo-suit@example.com", "line_id": ""}'::jsonb,
 '高雄市', ARRAY['客製化設計', '小量生產'], 4.8, 0, true, false);

-- 2. 為上述製作方各插入 1～2 筆作品集（廠商作品一律顯示於圖庫與首頁靈感牆，不依 show_on_media_wall；該欄位僅供 AI 設計生圖用）
-- 2a 服飾工坊
INSERT INTO public.manufacturer_portfolio (manufacturer_id, title, description, image_url, design_highlight, sort_order)
SELECT id, '服飾作品 A', '示範作品', 'https://placehold.co/400x400/e8d4e4/8b6b8b?text=Apparel+1', '示範用作品，可後台替換為真實圖片', 0
FROM public.manufacturers WHERE name = '示範服飾工坊' LIMIT 1;
INSERT INTO public.manufacturer_portfolio (manufacturer_id, title, description, image_url, design_highlight, sort_order)
SELECT id, '服飾作品 B', '示範作品', 'https://placehold.co/400x400/d4e4e8/6b8b8b?text=Apparel+2', '示範用作品', 1
FROM public.manufacturers WHERE name = '示範服飾工坊' LIMIT 1;

-- 2b 家具工作室
INSERT INTO public.manufacturer_portfolio (manufacturer_id, title, description, image_url, design_highlight, sort_order)
SELECT id, '家具作品 A', '示範作品', 'https://placehold.co/400x400/e8e4d4/8b8b6b?text=Furniture+1', '示範用作品，可後台替換', 0
FROM public.manufacturers WHERE name = '示範家具工作室' LIMIT 1;
INSERT INTO public.manufacturer_portfolio (manufacturer_id, title, description, image_url, image_url_before, design_highlight, sort_order)
SELECT id, '家具對比範例', '概念→實品', 'https://placehold.co/400x300/9a9/3a5?text=實品', 'https://placehold.co/400x300/bb9/6a4?text=概念', '示範對比圖', 1
FROM public.manufacturers WHERE name = '示範家具工作室' LIMIT 1;

-- 2c 運動用品坊
INSERT INTO public.manufacturer_portfolio (manufacturer_id, title, description, image_url, design_highlight, sort_order)
SELECT id, '運動用品作品', '示範作品', 'https://placehold.co/400x400/d4e8d4/6b8b6b?text=Sports+1', '示範用作品', 0
FROM public.manufacturers WHERE name = '示範運動用品坊' LIMIT 1;

-- 2d 西裝訂製
INSERT INTO public.manufacturer_portfolio (manufacturer_id, title, description, image_url, design_highlight, sort_order)
SELECT id, '西裝作品 A', '示範作品', 'https://placehold.co/400x400/2a2a2a/eee?text=Suit+1', '示範用作品', 0
FROM public.manufacturers WHERE name = '示範西裝訂製' LIMIT 1;

SELECT '製作方假資料與作品集種子完成' AS message;
