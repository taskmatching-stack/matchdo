-- ========================================
-- 清理並重新遷移子分類
-- ========================================

-- 步驟 1：刪除所有錯誤的子分類（那些 parent_key 不是 NULL 的）
DELETE FROM ai_categories 
WHERE parent_key IS NOT NULL;

-- 步驟 2：重新展開所有主分類的 subcategories
DO $$
DECLARE
    parent_rec RECORD;
    sub_name TEXT;
    new_key TEXT;
    counter INT := 0;
BEGIN
    -- 遍歷所有主分類
    FOR parent_rec IN 
        SELECT key, name, subcategories 
        FROM ai_categories 
        WHERE parent_key IS NULL 
          AND subcategories IS NOT NULL
          AND jsonb_array_length(subcategories) > 0
    LOOP
        RAISE NOTICE '處理主分類: % (%個子分類)', parent_rec.name, jsonb_array_length(parent_rec.subcategories);
        
        -- 展開每個子分類
        FOR sub_name IN 
            SELECT jsonb_array_elements_text(parent_rec.subcategories)
        LOOP
            -- 生成唯一的 key（使用父key + 雙底線 + 子分類名的安全版本）
            new_key := parent_rec.key || '__' || lower(
                regexp_replace(
                    regexp_replace(sub_name, '\s+', '_', 'g'),  -- 空格變底線
                    '[^\w\u4e00-\u9fff]', '', 'g'  -- 移除特殊字元但保留中文
                )
            );
            
            -- 插入子分類
            INSERT INTO ai_categories (key, name, prompt, subcategories, parent_key, image_url, updated_at)
            VALUES (
                new_key,
                sub_name,
                '',
                '[]'::jsonb,
                parent_rec.key,
                NULL,
                NOW()
            );
            
            counter := counter + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 遷移完成！共新增 % 個子分類', counter;
END $$;

-- 步驟 3：驗證結果
SELECT 
    CASE WHEN parent_key IS NULL THEN '主分類' ELSE '子分類' END as "類型",
    COUNT(*) as "數量"
FROM ai_categories
GROUP BY CASE WHEN parent_key IS NULL THEN '主分類' ELSE '子分類' END;

-- 步驟 4：查看所有分類（分組顯示）
SELECT 
    COALESCE(p.name, c.name) as "主分類",
    CASE WHEN c.parent_key IS NULL THEN '-' ELSE c.name END as "子分類",
    c.key
FROM ai_categories c
LEFT JOIN ai_categories p ON c.parent_key = p.key
ORDER BY COALESCE(p.name, c.name), c.parent_key NULLS FIRST, c.name;
