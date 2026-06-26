-- ========================================
-- 修正 ai_categories 表結構
-- 添加缺失的 parent_id 欄位
-- ========================================

-- 1. 檢查現有表結構
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ai_categories'
ORDER BY ordinal_position;

-- 2. 添加 parent_id 欄位（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_categories' 
        AND column_name = 'parent_id'
    ) THEN
        ALTER TABLE ai_categories 
        ADD COLUMN parent_id UUID REFERENCES ai_categories(id) ON DELETE CASCADE;
        
        RAISE NOTICE '✅ parent_id 欄位已添加';
    ELSE
        RAISE NOTICE 'ℹ️ parent_id 欄位已存在';
    END IF;
END $$;

-- 3. 添加 description 欄位（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_categories' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE ai_categories 
        ADD COLUMN description TEXT;
        
        RAISE NOTICE '✅ description 欄位已添加';
    ELSE
        RAISE NOTICE 'ℹ️ description 欄位已存在';
    END IF;
END $$;

-- 4. 添加 image_url 欄位（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_categories' 
        AND column_name = 'image_url'
    ) THEN
        ALTER TABLE ai_categories 
        ADD COLUMN image_url TEXT;
        
        RAISE NOTICE '✅ image_url 欄位已添加';
    ELSE
        RAISE NOTICE 'ℹ️ image_url 欄位已存在';
    END IF;
END $$;

-- 5. 建立索引
CREATE INDEX IF NOT EXISTS idx_ai_categories_parent_id ON ai_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_ai_categories_name ON ai_categories(name);

-- 6. 驗證最終表結構
SELECT 
    column_name AS "欄位名稱",
    data_type AS "資料類型",
    is_nullable AS "可為空",
    column_default AS "預設值"
FROM information_schema.columns
WHERE table_name = 'ai_categories'
ORDER BY ordinal_position;
