-- 專案封面圖片系統
-- 支援：預設圖 / 使用者上傳 / AI 生成

-- 1. 為 projects 表添加封面圖片欄位
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS cover_image_type text DEFAULT 'default',
ADD COLUMN IF NOT EXISTS cover_image_url text,
ADD COLUMN IF NOT EXISTS cover_image_category text;

-- 欄位說明：
-- cover_image_type: 'default' | 'uploaded' | 'ai_generated'
-- cover_image_url: 圖片 URL（如果是 uploaded 或 ai_generated）
-- cover_image_category: 如果是 default，記錄使用的分類代碼

-- 2. 為現有專案設置預設值（根據 category 分配預設圖）
UPDATE projects 
SET 
  cover_image_type = 'default',
  cover_image_category = category
WHERE cover_image_type IS NULL;

-- 3. 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_projects_cover_image_type ON projects(cover_image_type);

COMMENT ON COLUMN projects.cover_image_type IS '封面圖片類型：default=預設圖, uploaded=使用者上傳, ai_generated=AI生成';
COMMENT ON COLUMN projects.cover_image_url IS '封面圖片 URL（uploaded 或 ai_generated 時使用）';
COMMENT ON COLUMN projects.cover_image_category IS '預設圖片分類代碼（default 類型時使用）';
