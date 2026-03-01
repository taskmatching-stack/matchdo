-- seed-portfolio-items.sql
-- 為所有 is_active 廠商各建 2 筆作品（不需 user_id，讓所有分類都有測試資料）
-- 已有作品的廠商自動跳過

INSERT INTO public.manufacturer_portfolio
    (manufacturer_id, title, description, image_url, tags, sort_order)
SELECT
    m.id,
    m.name || ' 作品 ' || gs.n,
    COALESCE(m.description, '廠商精選作品'),
    'https://placehold.co/400x300/2d4059/ffffff?text=Work+' || gs.n,
    COALESCE(m.capabilities, ARRAY[]::text[]),
    gs.n
FROM public.manufacturers m
CROSS JOIN (SELECT 1 AS n UNION ALL SELECT 2) gs
WHERE m.is_active = true
  AND NOT EXISTS (
      SELECT 1 FROM public.manufacturer_portfolio p
      WHERE p.manufacturer_id = m.id
  )
ON CONFLICT DO NOTHING;

-- 確認結果
SELECT
    cat,
    count(*) AS portfolio_count
FROM (
    SELECT unnest(m.categories) AS cat
    FROM public.manufacturer_portfolio p
    JOIN public.manufacturers m ON m.id = p.manufacturer_id
) sub
GROUP BY cat
ORDER BY portfolio_count DESC
LIMIT 20;
