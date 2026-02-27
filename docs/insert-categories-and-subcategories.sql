-- =============================================
-- 插入媒合所需的主分類和子分類（英文 key 版本）
-- 用途：為測試數據腳本提供完整的分類結構
-- =============================================

-- ========================================
-- 步驟 0：確保 ai_categories 表有 key 欄位
-- ========================================

-- 檢查並新增 key 欄位（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_categories' 
        AND column_name = 'key'
    ) THEN
        ALTER TABLE public.ai_categories ADD COLUMN key TEXT UNIQUE;
        COMMENT ON COLUMN public.ai_categories.key IS '分類唯一識別碼（英文）';
    END IF;
    
    -- 檢查並新增 prompt 欄位（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_categories' 
        AND column_name = 'prompt'
    ) THEN
        ALTER TABLE public.ai_categories ADD COLUMN prompt TEXT DEFAULT '';
    END IF;
END $$;

-- ========================================
-- 步驟 1：插入主分類到 ai_categories 表
-- ========================================

INSERT INTO public.ai_categories (key, name, prompt, image_url) VALUES
('home', '居家裝潢', '居家裝潢與維修服務', NULL),
('video', '影片製作', '各類影片拍攝與製作服務', NULL),
('web', '網站開發', '網站設計與開發服務', NULL),
('app', 'APP 開發', '行動應用程式開發', NULL),
('ai', 'AI 導入', 'AI 與數據分析服務', NULL),
('marketing', '數位行銷', '數位行銷與推廣服務', NULL),
('design', '平面設計', '各類平面與視覺設計', NULL)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    prompt = EXCLUDED.prompt;

-- ========================================
-- 步驟 2：插入子分類到 ai_subcategories 表
-- ========================================

-- 居家裝潢類別 (home)
INSERT INTO public.ai_subcategories (key, name, category_key, sort_order) VALUES
('home__interior_design', '室內設計', 'home', 10),
('home__carpentry', '木工工程', 'home', 20),
('home__painting', '油漆工程', 'home', 30),
('home__electrical', '水電工程', 'home', 40),
('home__cleaning', '清潔服務', 'home', 50),
('home__flooring', '地板工程', 'home', 60),
('home__curtain', '窗簾窗飾', 'home', 70),
('home__air_conditioning', '冷氣空調', 'home', 80),
('home__waterproofing', '防水抓漏', 'home', 90),
('home__garden', '庭園景觀', 'home', 100),
('home__general_contractor', '全室統包', 'home', 5)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

-- 影片製作類別 (video)
INSERT INTO public.ai_subcategories (key, name, category_key, sort_order) VALUES
('video__commercial', '商業廣告', 'video', 10),
('video__corporate', '企業形象', 'video', 20),
('video__event', '活動紀錄', 'video', 30),
('video__animation', '動畫製作', 'video', 40),
('video__product', '產品展示', 'video', 50),
('video__youtube', 'YouTube 頻道', 'video', 60),
('video__short_film', '微電影', 'video', 70),
('video__aerial', '空拍攝影', 'video', 80),
('video__livestream', '直播服務', 'video', 90),
('video__editing', '影片剪輯', 'video', 100)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

-- 網站開發類別 (web)
INSERT INTO public.ai_subcategories (key, name, category_key, sort_order) VALUES
('web__corporate', '企業形象網站', 'web', 10),
('web__ecommerce', '電商網站', 'web', 20),
('web__custom', '客製化網站', 'web', 30),
('web__landing', '一頁式網站', 'web', 40),
('web__community', '論壇/社群網站', 'web', 50),
('web__booking', '預約系統', 'web', 60),
('web__blog', '部落格/媒體網站', 'web', 70),
('web__admin', '後台管理系統', 'web', 80),
('web__maintenance', '網站維護/優化', 'web', 90),
('web__responsive', 'RWD 網頁設計', 'web', 100),
('web__api', 'API 開發整合', 'web', 110),
('web__payment', '電商金流串接', 'web', 120)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

-- APP 開發類別 (app)
INSERT INTO public.ai_subcategories (key, name, category_key, sort_order) VALUES
('app__ios', 'iOS APP', 'app', 10),
('app__android', 'Android APP', 'app', 20),
('app__cross_platform', '跨平台 APP', 'app', 30),
('app__react_native', 'React Native APP', 'app', 40),
('app__ecommerce', '電商 APP', 'app', 50),
('app__social', '社群 APP', 'app', 60),
('app__livestream', '直播 APP', 'app', 70),
('app__o2o', 'O2O 服務 APP', 'app', 80),
('app__design', 'APP UI/UX 設計', 'app', 90),
('app__maintenance', 'APP 維護更新', 'app', 100)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

-- AI 導入類別 (ai)
INSERT INTO public.ai_subcategories (key, name, category_key, sort_order) VALUES
('ai__consulting', 'AI 導入顧問', 'ai', 10),
('ai__machine_learning', '機器學習開發', 'ai', 20),
('ai__chatgpt', 'ChatGPT 整合', 'ai', 30),
('ai__data_analysis', '資料分析', 'ai', 40),
('ai__chatbot', 'AI 客服機器人', 'ai', 50),
('ai__recommendation', '電商 AI 推薦', 'ai', 60),
('ai__computer_vision', '影像辨識', 'ai', 70),
('ai__rpa', 'RPA 流程自動化', 'ai', 80)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

-- 數位行銷類別 (marketing)
INSERT INTO public.ai_subcategories (key, name, category_key, sort_order) VALUES
('marketing__seo', 'SEO 優化', 'marketing', 10),
('marketing__google_ads', 'Google 廣告', 'marketing', 20),
('marketing__facebook_ads', 'Facebook 廣告', 'marketing', 30),
('marketing__social_media', '社群經營', 'marketing', 40),
('marketing__content', '內容行銷', 'marketing', 50),
('marketing__email', 'Email 行銷', 'marketing', 60),
('marketing__line', 'LINE 行銷', 'marketing', 70),
('marketing__influencer', '網紅合作', 'marketing', 80),
('marketing__livestream', '直播電商', 'marketing', 90),
('marketing__analytics', '數據分析 GA4', 'marketing', 100)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

-- 平面設計類別 (design)
INSERT INTO public.ai_subcategories (key, name, category_key, sort_order) VALUES
('design__logo', 'LOGO 設計', 'design', 10),
('design__branding', '品牌識別設計', 'design', 20),
('design__business_card', '名片設計', 'design', 30),
('design__flyer', 'DM/傳單設計', 'design', 40),
('design__poster', '海報設計', 'design', 50),
('design__packaging', '包裝設計', 'design', 60),
('design__catalog', '型錄/手冊', 'design', 70),
('design__menu', '菜單設計', 'design', 80),
('design__illustration', '插畫設計', 'design', 90),
('design__mascot', '吉祥物設計', 'design', 100),
('design__social_media', '社群素材設計', 'design', 110),
('design__banner', 'Banner 廣告', 'design', 120),
('design__presentation', '簡報設計', 'design', 130),
('design__web', '網頁視覺設計', 'design', 140),
('design__ui_ux', 'UI/UX 設計', 'design', 150),
('design__app', 'APP 介面設計', 'design', 160),
('design__ecommerce', '電商視覺設計', 'design', 170),
('design__line_sticker', 'LINE 貼圖', 'design', 180),
('design__book_cover', '書籍封面設計', 'design', 190),
('design__exhibition', '展場設計', 'design', 200)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

-- ========================================
-- 步驟 3：驗證結果
-- ========================================

SELECT '✅ 主分類插入完成' as message;
SELECT key, name FROM public.ai_categories WHERE key IN ('home', 'video', 'web', 'app', 'ai', 'marketing', 'design');

SELECT '✅ 子分類插入完成' as message;
SELECT 
    category_key,
    COUNT(*) as subcategory_count
FROM public.ai_subcategories
WHERE category_key IN ('home', 'video', 'web', 'app', 'ai', 'marketing', 'design')
GROUP BY category_key
ORDER BY category_key;

SELECT '📊 總計：7 個主分類，81 個子分類' as summary;
