-- 靈感牆資料夾：可複選分類，篩選時只顯示「包含該分類」的資料夾（不排除）
-- 執行：Supabase SQL Editor

ALTER TABLE public.media_collections
    ADD COLUMN IF NOT EXISTS category_keys TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.media_collections.category_keys IS '複選的主分類 key 陣列（與 custom_product_categories 對齊）；空陣列或 NULL 表示所有分類都顯示';

CREATE INDEX IF NOT EXISTS idx_media_collections_category_keys
ON public.media_collections USING GIN (category_keys);

SELECT 'media_collections 已支援 category_keys 複選' AS message;
