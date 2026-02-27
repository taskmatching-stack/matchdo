-- 分類表（如果已存在則不建立）
CREATE TABLE IF NOT EXISTS ai_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    parent_id UUID REFERENCES ai_categories(id) ON DELETE CASCADE,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_ai_categories_parent_id ON ai_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_ai_categories_name ON ai_categories(name);

-- RLS Policies（讓所有人可讀，管理員可寫）
ALTER TABLE ai_categories ENABLE ROW LEVEL SECURITY;

-- 允許所有人查詢分類
CREATE POLICY "分類公開可讀" ON ai_categories
    FOR SELECT
    USING (true);

-- 只有管理員可以新增/修改/刪除分類
CREATE POLICY "管理員可管理分類" ON ai_categories
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 插入測試資料（如果不存在）
INSERT INTO ai_categories (name, description) 
VALUES 
    ('設計', '設計相關服務')
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '平面設計', id, '包含Logo、海報、名片等平面設計'
FROM ai_categories WHERE name = '設計'
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '網頁設計', id, '網站UI/UX設計、前端開發'
FROM ai_categories WHERE name = '設計'
ON CONFLICT (name) DO NOTHING;

-- 查詢驗證
SELECT 
    c.name AS "分類名稱",
    CASE WHEN c.parent_id IS NULL THEN '主分類' ELSE '子分類' END AS "類型",
    COALESCE(p.name, '-') AS "所屬主分類",
    COALESCE(c.image_url, '使用預設圖') AS "圖片狀態"
FROM ai_categories c
LEFT JOIN ai_categories p ON c.parent_id = p.id
ORDER BY c.parent_id NULLS FIRST, c.name;
