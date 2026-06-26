-- ========================================
-- 安全添加 image_url 欄位
-- 不會影響現有的 key, name, prompt, subcategories 欄位
-- ========================================

-- 添加 image_url 欄位（如果不存在）
ALTER TABLE ai_categories 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 驗證：查看更新後的表結構
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ai_categories'
ORDER BY ordinal_position;

-- 驗證：確認現有資料完整無缺
SELECT 
    key AS "主鍵",
    name AS "分類名稱", 
    CASE 
        WHEN image_url IS NULL THEN '使用預設圖'
        ELSE '已設定' 
    END AS "圖片狀態",
    jsonb_array_length(subcategories) AS "子分類數量"
FROM ai_categories 
ORDER BY name;

-- 說明：此操作只是添加新欄位，預設值為 NULL
-- 不會修改或刪除任何現有資料
-- 首頁和其他頁面的分類讀取功能不受影響
