-- 為現有 ai_categories 表添加 image_url 欄位
ALTER TABLE ai_categories 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 查看更新後的表結構
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'ai_categories'
ORDER BY ordinal_position;

-- 查看現有資料
SELECT key, name, image_url, 
       jsonb_array_length(subcategories) as "子分類數量"
FROM ai_categories 
ORDER BY name;
