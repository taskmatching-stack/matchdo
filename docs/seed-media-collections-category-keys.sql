-- 為靈感牆資料夾設定「顯示於哪些分類」，篩選時才正確
-- 前置：已執行 add-media-collections-category-keys.sql（有 category_keys 欄位）
-- 在 Supabase SQL Editor 執行一次即可

-- 1) 確保有 category_keys 欄位
ALTER TABLE public.media_collections
    ADD COLUMN IF NOT EXISTS category_keys TEXT[] DEFAULT '{}';

-- 2) 依 sort_order 把前幾筆資料夾分別綁到前幾個主分類，讓每個主分類篩選時都至少有一筆資料夾
WITH ordered_folders AS (
  SELECT id, sort_order, ROW_NUMBER() OVER (ORDER BY sort_order ASC NULLS LAST, created_at ASC) AS rn
  FROM public.media_collections
  WHERE is_active = true
  LIMIT 20
),
ordered_cats AS (
  SELECT key, ROW_NUMBER() OVER (ORDER BY sort_order ASC NULLS LAST) AS rn
  FROM public.custom_product_categories
  WHERE is_active = true
  LIMIT 20
)
UPDATE public.media_collections mc
SET category_keys = ARRAY[oc.key]
FROM ordered_folders of2
JOIN ordered_cats oc ON oc.rn = of2.rn
WHERE mc.id = of2.id;

-- 若希望某資料夾出現在「多個」分類：可手動在靈感牆資料夾編輯頁勾選多個分類，或再跑一次只更新該筆：
-- UPDATE public.media_collections SET category_keys = ARRAY['formal_wear','streetwear'] WHERE slug = 'collection-1';
