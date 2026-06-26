-- ========================================
-- 將 subcategories 從字串陣列改成物件陣列
-- 每個子分類包含 name 和 image_url
-- ========================================

-- 更新所有主分類的 subcategories 格式
UPDATE ai_categories SET subcategories = (
    SELECT jsonb_agg(jsonb_build_object('name', elem, 'image_url', null))
    FROM jsonb_array_elements_text(subcategories) elem
) WHERE parent_key IS NULL AND jsonb_typeof(subcategories) = 'array';

-- 驗證新格式
SELECT 
    key,
    name,
    jsonb_array_length(subcategories) as "子分類數",
    subcategories
FROM ai_categories
WHERE parent_key IS NULL
LIMIT 2;

-- 新格式範例：
-- [
--   {"name": "清潔服務", "image_url": null},
--   {"name": "家電 燈具", "image_url": "https://..."}
-- ]
