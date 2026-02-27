-- ========================================
-- 簡化版：先插入主分類，再插入子分類
-- 不使用固定 UUID，讓資料庫自動生成
-- ========================================

-- 步驟 1：確保主分類存在
INSERT INTO ai_categories (name, description, parent_id) VALUES 
('設計', '各類設計服務', NULL),
('商業', '商業相關服務', NULL),
('學習', '教育與學習服務', NULL),
('居家', '居家生活服務', NULL),
('活動', '活動規劃與執行', NULL),
('美業', '美容美髮相關', NULL),
('運動', '運動健身服務', NULL),
('其他', '其他類型服務', NULL)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- 步驟 2：插入子分類（使用 SELECT 找到對應的主分類 ID）

-- 設計的子分類
INSERT INTO ai_categories (name, parent_id, description)
SELECT '平面設計', id, 'Logo、海報、名片等平面設計'
FROM ai_categories WHERE name = '設計' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '網頁設計', id, '網站UI/UX設計、前端開發'
FROM ai_categories WHERE name = '設計' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT 'UI/UX設計', id, '使用者介面與體驗設計'
FROM ai_categories WHERE name = '設計' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '包裝設計', id, '產品包裝、禮盒設計'
FROM ai_categories WHERE name = '設計' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '室內設計', id, '住宅、商業空間設計'
FROM ai_categories WHERE name = '設計' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

-- 商業的子分類
INSERT INTO ai_categories (name, parent_id, description)
SELECT '行銷企劃', id, '品牌行銷、活動企劃'
FROM ai_categories WHERE name = '商業' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '文案撰寫', id, '廣告文案、網站內容撰寫'
FROM ai_categories WHERE name = '商業' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '社群經營', id, 'FB、IG、LINE社群管理'
FROM ai_categories WHERE name = '商業' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '攝影服務', id, '商品攝影、形象照拍攝'
FROM ai_categories WHERE name = '商業' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '影片剪輯', id, '商業影片、宣傳片製作'
FROM ai_categories WHERE name = '商業' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

-- 學習的子分類
INSERT INTO ai_categories (name, parent_id, description)
SELECT '程式教學', id, 'Python、JavaScript等程式語言教學'
FROM ai_categories WHERE name = '學習' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '語言教學', id, '英文、日文、韓文等外語教學'
FROM ai_categories WHERE name = '學習' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '音樂教學', id, '鋼琴、吉他、歌唱等音樂課程'
FROM ai_categories WHERE name = '學習' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '數學家教', id, '國小到高中數學家教'
FROM ai_categories WHERE name = '學習' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

-- 居家的子分類
INSERT INTO ai_categories (name, parent_id, description)
SELECT '清潔打掃', id, '居家清潔、辦公室清潔'
FROM ai_categories WHERE name = '居家' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '家電維修', id, '冷氣、冰箱、洗衣機等維修'
FROM ai_categories WHERE name = '居家' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '水電工程', id, '水管、電路維修安裝'
FROM ai_categories WHERE name = '居家' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '搬家服務', id, '搬家打包、運送、定位'
FROM ai_categories WHERE name = '居家' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

-- 活動的子分類
INSERT INTO ai_categories (name, parent_id, description)
SELECT '婚禮企劃', id, '婚禮統籌、場地佈置'
FROM ai_categories WHERE name = '活動' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '活動主持', id, '婚禮、尾牙、記者會主持'
FROM ai_categories WHERE name = '活動' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '表演服務', id, '樂團、魔術、舞蹈表演'
FROM ai_categories WHERE name = '活動' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

-- 美業的子分類
INSERT INTO ai_categories (name, parent_id, description)
SELECT '美髮造型', id, '剪髮、染髮、燙髮造型'
FROM ai_categories WHERE name = '美業' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '美甲美睫', id, '光療指甲、接睫毛'
FROM ai_categories WHERE name = '美業' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '美容護膚', id, '臉部保養、SPA護理'
FROM ai_categories WHERE name = '美業' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

-- 運動的子分類
INSERT INTO ai_categories (name, parent_id, description)
SELECT '健身教練', id, '一對一健身指導、體態雕塑'
FROM ai_categories WHERE name = '運動' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '瑜珈教學', id, '哈達瑜珈、空中瑜珈'
FROM ai_categories WHERE name = '運動' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '游泳教學', id, '成人、兒童游泳課程'
FROM ai_categories WHERE name = '運動' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

-- 其他的子分類
INSERT INTO ai_categories (name, parent_id, description)
SELECT '命理占卜', id, '算命、塔羅牌、紫微斗數'
FROM ai_categories WHERE name = '其他' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_categories (name, parent_id, description)
SELECT '客製化商品', id, '手工藝品、客製禮物'
FROM ai_categories WHERE name = '其他' AND parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

-- 驗證結果
SELECT 
    c.name AS "分類",
    CASE WHEN c.parent_id IS NULL THEN '主分類' ELSE '子分類' END AS "類型",
    COALESCE(p.name, '-') AS "所屬主分類"
FROM ai_categories c
LEFT JOIN ai_categories p ON c.parent_id = p.id
ORDER BY 
    CASE WHEN c.parent_id IS NULL THEN 0 ELSE 1 END,
    COALESCE(p.name, c.name),
    c.name;
