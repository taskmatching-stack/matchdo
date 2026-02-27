-- 刪除 subscription_plans 重複列，每組 (name, price, sort_order) 只保留一筆（保留 id 最小者）
-- 若方案出現兩次以上時，在 Supabase SQL Editor 執行此檔一次即可。

DELETE FROM public.subscription_plans a
USING public.subscription_plans b
WHERE a.id > b.id
  AND a.name IS NOT DISTINCT FROM b.name
  AND a.price IS NOT DISTINCT FROM b.price
  AND a.sort_order IS NOT DISTINCT FROM b.sort_order;
