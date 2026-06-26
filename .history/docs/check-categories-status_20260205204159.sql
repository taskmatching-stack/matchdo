-- ========================================
-- 檢查分類資料狀態
-- ========================================

-- 1. 查看所有分類及其層級關係
SELECT 
    c.id,
    c.name AS "分類名稱",
    CASE 
        WHEN c.parent_id IS NULL THEN '🟢 主分類'
        ELSE '🔵 子分類'
    END AS "類型",
    c.parent_id AS "父ID",
    COALESCE(p.name, '-') AS "所屬主分類",
    c.created_at AS "建立時間"
FROM ai_categories c
LEFT JOIN ai_categories p ON c.parent_id = p.id
ORDER BY 
    CASE WHEN c.parent_id IS NULL THEN 0 ELSE 1 END,
    COALESCE(p.name, c.name),
    c.name;

-- 2. 統計數量
SELECT 
    CASE 
        WHEN parent_id IS NULL THEN '主分類'
        ELSE '子分類'
    END AS "類型",
    COUNT(*) AS "數量"
FROM ai_categories
GROUP BY CASE WHEN parent_id IS NULL THEN '主分類' ELSE '子分類' END;

-- 3. 檢查是否有孤兒子分類（parent_id 指向不存在的主分類）
SELECT 
    c.name AS "子分類名稱",
    c.parent_id AS "指向的父ID"
FROM ai_categories c
WHERE c.parent_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM ai_categories p 
    WHERE p.id = c.parent_id
);
