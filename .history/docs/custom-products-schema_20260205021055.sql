-- MatchDO「合做」客製產品功能 - 資料表結構
-- 執行日期：2026-02-05
-- 說明：新增客製產品與廠商資料表，支援文字生成圖片、產品分析、廠商媒合功能

-- ============================================
-- 1. 客製產品資料表 (custom_products)
-- ============================================
CREATE TABLE IF NOT EXISTS public.custom_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 產品基本資訊
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT, -- 對應 ai_categories.key
    
    -- 圖片資訊
    reference_image_url TEXT, -- 使用者上傳的示意圖（Supabase Storage URL）
    ai_generated_image_url TEXT, -- AI 生成的產品圖片（Gemini Image Preview）
    
    -- AI 分析結果（JSON 格式）
    analysis_json JSONB, -- { materials: [], complexity: "", estimated_price_range: "", production_time: "", tags: [] }
    
    -- 狀態追蹤
    status TEXT NOT NULL DEFAULT 'draft', -- draft, analyzing, matched, contacted, completed
    
    -- 時間戳記
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 索引
    CONSTRAINT valid_status CHECK (status IN ('draft', 'analyzing', 'matched', 'contacted', 'completed'))
);

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_custom_products_owner_id ON public.custom_products(owner_id);
CREATE INDEX IF NOT EXISTS idx_custom_products_status ON public.custom_products(status);
CREATE INDEX IF NOT EXISTS idx_custom_products_category ON public.custom_products(category);
CREATE INDEX IF NOT EXISTS idx_custom_products_created_at ON public.custom_products(created_at DESC);

-- 自動更新 updated_at 欄位
CREATE OR REPLACE FUNCTION update_custom_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_custom_products_updated_at
    BEFORE UPDATE ON public.custom_products
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_products_updated_at();

-- ============================================
-- 2. 廠商資料表 (manufacturers)
-- ============================================
CREATE TABLE IF NOT EXISTS public.manufacturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 基本資訊
    name TEXT NOT NULL,
    description TEXT,
    categories TEXT[] NOT NULL DEFAULT '{}', -- 可製作的產品類別（對應 ai_categories.key）
    
    -- 聯絡資訊（JSON 格式）
    contact_json JSONB NOT NULL DEFAULT '{}', -- { phone: "", email: "", line_id: "", website: "" }
    
    -- 地理位置
    location TEXT, -- 縣市或地區
    address TEXT,
    
    -- 能力與認證
    capabilities TEXT[] DEFAULT '{}', -- 生產能力標籤：['快速打樣', '大量生產', '精密加工']
    certifications TEXT[] DEFAULT '{}', -- 認證標籤：['ISO 9001', '環保標章']
    
    -- 評價系統
    rating DECIMAL(3,2) DEFAULT 0.0, -- 0.00 ~ 5.00
    review_count INTEGER DEFAULT 0,
    
    -- 營運資訊
    min_order_quantity INTEGER, -- 最小訂購量
    lead_time_days INTEGER, -- 平均交期（天數）
    
    -- 狀態
    is_active BOOLEAN DEFAULT TRUE,
    verified BOOLEAN DEFAULT FALSE, -- 是否通過平台驗證
    
    -- 時間戳記
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 約束
    CONSTRAINT valid_rating CHECK (rating >= 0.0 AND rating <= 5.0)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_manufacturers_categories ON public.manufacturers USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_manufacturers_location ON public.manufacturers(location);
CREATE INDEX IF NOT EXISTS idx_manufacturers_rating ON public.manufacturers(rating DESC);
CREATE INDEX IF NOT EXISTS idx_manufacturers_is_active ON public.manufacturers(is_active);
CREATE INDEX IF NOT EXISTS idx_manufacturers_verified ON public.manufacturers(verified);

-- 自動更新 updated_at 欄位
CREATE OR REPLACE FUNCTION update_manufacturers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_manufacturers_updated_at
    BEFORE UPDATE ON public.manufacturers
    FOR EACH ROW
    EXECUTE FUNCTION update_manufacturers_updated_at();

-- ============================================
-- 3. 產品-廠商媒合記錄表 (custom_product_matches)
-- ============================================
CREATE TABLE IF NOT EXISTS public.custom_product_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    custom_product_id UUID NOT NULL REFERENCES public.custom_products(id) ON DELETE CASCADE,
    manufacturer_id UUID NOT NULL REFERENCES public.manufacturers(id) ON DELETE CASCADE,
    
    -- 媒合分數與原因
    match_score DECIMAL(5,2) NOT NULL, -- 0.00 ~ 100.00
    match_reasons JSONB, -- { category_match: true, location_match: true, capability_match: ['快速打樣'], tags_overlap: ['木工', '客製化'] }
    
    -- 狀態追蹤
    status TEXT NOT NULL DEFAULT 'pending', -- pending, contacted, quoted, accepted, rejected
    
    -- 報價資訊（廠商回覆後填入）
    quote_amount DECIMAL(10,2),
    quote_details TEXT,
    quote_valid_until TIMESTAMPTZ,
    
    -- 時間戳記
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 約束
    CONSTRAINT valid_match_status CHECK (status IN ('pending', 'contacted', 'quoted', 'accepted', 'rejected')),
    CONSTRAINT valid_match_score CHECK (match_score >= 0.0 AND match_score <= 100.0),
    UNIQUE(custom_product_id, manufacturer_id) -- 避免重複媒合
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_custom_product_matches_product_id ON public.custom_product_matches(custom_product_id);
CREATE INDEX IF NOT EXISTS idx_custom_product_matches_manufacturer_id ON public.custom_product_matches(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_custom_product_matches_score ON public.custom_product_matches(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_custom_product_matches_status ON public.custom_product_matches(status);

-- 自動更新 updated_at 欄位
CREATE OR REPLACE FUNCTION update_custom_product_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_custom_product_matches_updated_at
    BEFORE UPDATE ON public.custom_product_matches
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_product_matches_updated_at();

-- ============================================
-- 4. RLS (Row Level Security) 政策
-- ============================================

-- 4.1 custom_products RLS
ALTER TABLE public.custom_products ENABLE ROW LEVEL SECURITY;

-- 擁有者可以查看、新增、更新、刪除自己的產品
CREATE POLICY "Users can view their own custom products"
    ON public.custom_products FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own custom products"
    ON public.custom_products FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own custom products"
    ON public.custom_products FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own custom products"
    ON public.custom_products FOR DELETE
    USING (auth.uid() = owner_id);

-- 4.2 manufacturers RLS
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;

-- 所有人可以查看啟用的廠商（公開資訊）
CREATE POLICY "Anyone can view active manufacturers"
    ON public.manufacturers FOR SELECT
    USING (is_active = TRUE);

-- 只有管理員可以新增/更新廠商（待實作管理員角色檢查）
-- 暫時先開放 authenticated 用戶，後續再加上 admin role 檢查
CREATE POLICY "Authenticated users can manage manufacturers"
    ON public.manufacturers FOR ALL
    USING (auth.role() = 'authenticated');

-- 4.3 custom_product_matches RLS
ALTER TABLE public.custom_product_matches ENABLE ROW LEVEL SECURITY;

-- 產品擁有者可以查看該產品的所有媒合記錄
CREATE POLICY "Product owners can view their matches"
    ON public.custom_product_matches FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.custom_products
            WHERE custom_products.id = custom_product_matches.custom_product_id
            AND custom_products.owner_id = auth.uid()
        )
    );

-- 系統可以插入媒合記錄（透過 service role）
CREATE POLICY "System can insert matches"
    ON public.custom_product_matches FOR INSERT
    WITH CHECK (TRUE);

-- 產品擁有者可以更新媒合狀態
CREATE POLICY "Product owners can update their matches"
    ON public.custom_product_matches FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.custom_products
            WHERE custom_products.id = custom_product_matches.custom_product_id
            AND custom_products.owner_id = auth.uid()
        )
    );

-- ============================================
-- 5. 示範資料（測試用）
-- ============================================

-- 插入示範廠商資料
INSERT INTO public.manufacturers (name, description, categories, contact_json, location, capabilities, rating, review_count, verified) VALUES
('匠心木工坊', '專注原木家具訂製，20年經驗', ARRAY['furniture', 'interior'], 
 '{"phone": "02-2345-6789", "email": "info@woodcraft.tw", "line_id": "@woodcraft"}'::jsonb,
 '台北市', ARRAY['快速打樣', '客製化設計', '環保材料'], 4.8, 127, TRUE),

('創意金屬工藝', '精密金屬加工與藝術品製作', ARRAY['metalwork', 'art'], 
 '{"phone": "04-2233-4455", "email": "hello@metalart.tw", "website": "https://metalart.tw"}'::jsonb,
 '台中市', ARRAY['精密加工', '藝術品訂製', '小量生產'], 4.6, 89, TRUE),

('時尚布藝工作室', '客製化布料產品與軟裝飾', ARRAY['textile', 'interior'], 
 '{"phone": "07-3344-5566", "email": "contact@fabricstudio.tw", "line_id": "@fabricstudio"}'::jsonb,
 '高雄市', ARRAY['快速打樣', '大量生產', '設計諮詢'], 4.7, 203, TRUE),

('3D 列印創客空間', '快速原型製作與產品設計', ARRAY['3d_printing', 'prototype'], 
 '{"phone": "02-8765-4321", "email": "maker@3dprint.tw", "website": "https://3dprint.tw"}'::jsonb,
 '新北市', ARRAY['快速打樣', '小量生產', '設計優化'], 4.9, 156, TRUE),

('陶藝手作工坊', '手工陶瓷器皿與藝術品', ARRAY['ceramic', 'art'], 
 '{"phone": "03-5566-7788", "email": "pottery@ceramic.tw", "line_id": "@pottery"}'::jsonb,
 '桃園市', ARRAY['手工製作', '客製化設計', '教學體驗'], 4.5, 72, TRUE)

ON CONFLICT DO NOTHING;

-- ============================================
-- 完成提示
-- ============================================
-- 資料表建立完成！
-- 請在 Supabase SQL Editor 執行此腳本
-- 
-- 後續步驟：
-- 1. 建立 Supabase Storage Buckets: 'custom-products'
-- 2. 實作 API endpoints: POST /api/custom-products, GET /api/custom-products
-- 3. 實作媒合邏輯: POST /api/custom-products/:id/match
-- 4. 建立前端頁面: 客製產品歷史記錄
