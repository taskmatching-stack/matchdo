-- ========================================
-- 完整遷移：展開所有子分類
-- 確保每個 jsonb 陣列中的子分類都變成獨立資料列
-- ========================================

DO $$
DECLARE
    parent_rec RECORD;
    sub_name TEXT;
    new_key TEXT;
    counter INT := 0;
BEGIN
    -- 遍歷所有主分類（parent_key IS NULL）
    FOR parent_rec IN 
        SELECT key, name, subcategories 
        FROM ai_categories 
        WHERE parent_key IS NULL 
          AND subcategories IS NOT NULL
          AND jsonb_array_length(subcategories) > 0
    LOOP
        RAISE NOTICE '處理主分類: % (key: %)', parent_rec.name, parent_rec.key;
        
        -- 展開 subcategories jsonb 陣列中的每個子分類名稱
        FOR sub_name IN 
            SELECT jsonb_array_elements_text(parent_rec.subcategories)
        LOOP
            -- 生成子分類的 key (移除特殊字元和空格)
            new_key := parent_rec.key || '__' || regexp_replace(sub_name, '\s+', '_', 'g');
            
            -- 插入子分類資料列
            INSERT INTO ai_categories (key, name, prompt, subcategories, parent_key, image_url)
            VALUES (
                new_key,
                sub_name,
                '',
                '[]'::jsonb,
                parent_rec.key,
                NULL
            )
            ON CONFLICT (key) DO NOTHING;
            
            counter := counter + 1;
            RAISE NOTICE '  ✓ 新增子分類: % (key: %)', sub_name, new_key;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '遷移完成！共處理 % 個子分類', counter;
END $$;

-- 驗證結果
SELECT 
    '主分類' as "類型",
    COUNT(*) as "數量"
FROM ai_categories 
WHERE parent_key IS NULL

UNION ALL

SELECT 
    '子分類' as "類型",
    COUNT(*) as "數量"
FROM ai_categories 
WHERE parent_key IS NOT NULL

UNION ALL

SELECT 
    '總計' as "類型",
    COUNT(*) as "數量"
FROM ai_categories;

-- 查看所有分類（前20筆）
SELECT 
    CASE WHEN parent_key IS NULL THEN '🟢' ELSE '🔵' END as "標記",
    key,
    name,
    parent_key as "父分類key"
FROM ai_categories
ORDER BY parent_key NULLS FIRST, name
LIMIT 20;
