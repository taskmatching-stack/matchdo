-- ========================================
-- 子分類遷移：從 jsonb 陣列變成獨立資料列
-- 保留原有結構向後相容
-- ========================================

-- 步驟 1：添加 parent_key 欄位
ALTER TABLE ai_categories 
ADD COLUMN IF NOT EXISTS parent_key TEXT REFERENCES ai_categories(key) ON DELETE CASCADE;

-- 步驟 2：為 parent_key 建立索引
CREATE INDEX IF NOT EXISTS idx_ai_categories_parent_key ON ai_categories(parent_key);

-- 步驟 3：從現有主分類的 subcategories 陣列展開成子分類資料列
DO $$
DECLARE
    parent_rec RECORD;
    sub_name TEXT;
BEGIN
    -- 遍歷所有主分類
    FOR parent_rec IN 
        SELECT key, name, subcategories 
        FROM ai_categories 
        WHERE parent_key IS NULL 
          AND subcategories IS NOT NULL
    LOOP
        -- 展開每個子分類
        FOR sub_name IN 
            SELECT jsonb_array_elements_text(parent_rec.subcategories)
        LOOP
            -- 插入子分類（如果不存在）
            INSERT INTO ai_categories (key, name, prompt, subcategories, parent_key, image_url)
            VALUES (
                parent_rec.key || '_' || lower(regexp_replace(sub_name, '[^a-zA-Z0-9\u4e00-\u9fff]+', '_', 'g')),
                sub_name,
                '',
                '[]'::jsonb,
                parent_rec.key,
                NULL
            )
            ON CONFLICT (key) DO NOTHING;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '✅ 子分類遷移完成';
END $$;

-- 步驟 4：驗證遷移結果
SELECT 
    CASE 
        WHEN parent_key IS NULL THEN '🟢 主分類'
        ELSE '🔵 子分類'
    END AS "類型",
    key AS "Key",
    name AS "名稱",
    parent_key AS "所屬主分類",
    CASE 
        WHEN image_url IS NULL THEN '使用預設圖'
        ELSE '已設定圖片'
    END AS "圖片狀態"
FROM ai_categories
ORDER BY parent_key NULLS FIRST, name;

-- 步驟 5：統計
SELECT 
    CASE 
        WHEN parent_key IS NULL THEN '主分類'
        ELSE '子分類'
    END AS "類型",
    COUNT(*) AS "數量"
FROM ai_categories
GROUP BY CASE WHEN parent_key IS NULL THEN '主分類' ELSE '子分類' END;

-- 注意事項：
-- 1. 原有的 subcategories jsonb 欄位保持不變（向後相容）
-- 2. 新增的子分類資料列使用 parent_key 關聯主分類
-- 3. 前端可以選擇讀取 subcategories 或查詢 parent_key
