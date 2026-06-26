-- ========================================
-- 為現有 ai_categories 表添加新欄位
-- ========================================

-- 1. 添加 parent_id 欄位（建立父子關係）
ALTER TABLE ai_categories 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES ai_categories(key);

-- 2. 添加 description 欄位
ALTER TABLE ai_categories 
ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. 添加 image_url 欄位
ALTER TABLE ai_categories 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 4. 添加 id 欄位作為主鍵（如果需要）
ALTER TABLE ai_categories 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- 5. 建立索引
CREATE INDEX IF NOT EXISTS idx_ai_categories_parent_id ON ai_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_ai_categories_name ON ai_categories(name);

-- 6. 查看更新後的表結構
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ai_categories'
ORDER BY ordinal_position;

-- 7. 查看現有資料
SELECT key, name, subcategories FROM ai_categories LIMIT 5;
