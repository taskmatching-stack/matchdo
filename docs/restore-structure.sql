-- 恢復原本的結構：刪除獨立的子分類資料列
DELETE FROM ai_categories WHERE parent_key IS NOT NULL;

-- 驗證：應該只剩主分類
SELECT 
    key,
    name,
    jsonb_array_length(subcategories) as "子分類數",
    subcategories
FROM ai_categories
WHERE parent_key IS NULL
ORDER BY name;
