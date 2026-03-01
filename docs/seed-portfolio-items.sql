-- 為每個廠商插入 2 筆樣本作品（讓圖庫有真實資料可顯示）
-- 執行：Supabase SQL Editor
INSERT INTO public.manufacturer_portfolio
    (manufacturer_id, title, description, image_url, tags, sort_order, category_key)
SELECT
    m.id,
    m.name || ' 作品 ' || gs.n,
    m.description,
    'https://placehold.co/400x300/2d4059/ffffff?text=' || encode(convert_to(m.name, 'UTF8'), 'base64'),
    ARRAY(SELECT jsonb_array_elements_text(to_jsonb(m.categories))),
    gs.n,
    CASE WHEN m.categories IS NOT NULL AND array_length(m.categories,1) > 0
         THEN m.categories[1] ELSE NULL END
FROM public.manufacturers m
CROSS JOIN (SELECT 1 AS n UNION ALL SELECT 2) gs
WHERE m.user_id IS NOT NULL
  AND m.is_active = true
  AND NOT EXISTS (
      SELECT 1 FROM public.manufacturer_portfolio p WHERE p.manufacturer_id = m.id
  )
ON CONFLICT DO NOTHING;

-- 確認
SELECT count(*) AS "新增作品數" FROM public.manufacturer_portfolio;
