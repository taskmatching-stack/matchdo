-- ========================================
-- MatchDO 客製產品功能資料表
-- 請在 Supabase SQL Editor 執行
-- ========================================

-- 1. 建立訂製廠商表
CREATE TABLE IF NOT EXISTS public.manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  description TEXT,
  experience INT DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0.0,
  location TEXT,
  production_capabilities JSONB DEFAULT '[]'::jsonb,
  portfolio JSONB DEFAULT '[]'::jsonb,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  verified_status BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_manufacturers_user_id ON public.manufacturers(user_id);
CREATE INDEX IF NOT EXISTS idx_manufacturers_status ON public.manufacturers(status);
CREATE INDEX IF NOT EXISTS idx_manufacturers_location ON public.manufacturers(location);
CREATE INDEX IF NOT EXISTS idx_manufacturers_capabilities ON public.manufacturers USING gin(production_capabilities);

-- 2. 建立客製產品發案表
CREATE TABLE IF NOT EXISTS public.custom_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id),
  category TEXT NOT NULL,
  quantity INT DEFAULT 1,
  description TEXT,
  image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_ai_generated BOOLEAN DEFAULT false,
  generation_prompt TEXT,
  ai_analysis JSONB,
  budget_min NUMERIC,
  budget_max NUMERIC,
  matched_manufacturers UUID[] DEFAULT ARRAY[]::UUID[],
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_custom_products_owner_id ON public.custom_products(owner_id);
CREATE INDEX IF NOT EXISTS idx_custom_products_category ON public.custom_products(category);
CREATE INDEX IF NOT EXISTS idx_custom_products_status ON public.custom_products(status);
CREATE INDEX IF NOT EXISTS idx_custom_products_created_at ON public.custom_products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_products_analysis ON public.custom_products USING gin(ai_analysis);

-- 3. 建立產品-廠商媒合記錄表
CREATE TABLE IF NOT EXISTS public.product_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.custom_products(id) ON DELETE CASCADE,
  manufacturer_id UUID REFERENCES public.manufacturers(id) ON DELETE CASCADE,
  match_score NUMERIC(5,2) DEFAULT 0.0,
  match_reasons JSONB,
  status TEXT DEFAULT 'pending',
  contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, manufacturer_id)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_product_matches_product_id ON public.product_matches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_matches_manufacturer_id ON public.product_matches(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_product_matches_score ON public.product_matches(match_score DESC);

-- 4. 新增觸發器：自動更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_manufacturers_updated_at
    BEFORE UPDATE ON public.manufacturers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_products_updated_at
    BEFORE UPDATE ON public.custom_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_matches_updated_at
    BEFORE UPDATE ON public.product_matches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. 插入示範廠商資料
INSERT INTO public.manufacturers (name, specialty, description, experience, rating, location, production_capabilities) VALUES
('木工坊訂製', '實木家具訂製', '專注於實木家具客製化，擁有完整的木工設備與經驗豐富的師傅團隊', 15, 4.8, '台北市', 
  '["furniture", "woodwork", "custom_design"]'::jsonb),
  
('現代傢俱工作室', '現代風格家具', '提供現代簡約風格家具訂製，結合功能與美學', 8, 4.6, '新北市', 
  '["furniture", "modern_design", "space_planning"]'::jsonb),
  
('藝術裝飾工坊', '手工裝飾品', '手工製作各式裝飾品，包含金屬、陶瓷、玻璃等多元材質', 10, 4.7, '台中市', 
  '["decoration", "handicraft", "metalwork", "ceramic"]'::jsonb),
  
('創意設計室', '客製化裝飾', '創意發想與執行並重，專注於獨特性與個人化設計', 6, 4.5, '高雄市', 
  '["decoration", "creative_design", "custom_art"]'::jsonb),
  
('精工織品', '織品布藝訂製', '提供窗簾、抱枕、桌布等各式織品訂製服務', 12, 4.7, '台南市', 
  '["textile", "curtain", "fabric_design"]'::jsonb),
  
('燈光設計所', '客製燈具', '專業燈具設計與製作，從概念到成品一條龍服務', 9, 4.6, '桃園市', 
  '["lighting", "lamp_design", "electrical"]'::jsonb),
  
('廚藝金工', '廚具餐具訂製', '不鏽鋼與銅製廚具餐具，兼具實用與美觀', 11, 4.8, '台北市', 
  '["kitchenware", "metalwork", "stainless_steel"]'::jsonb),
  
('文創工作坊', '文創商品設計', '結合傳統工藝與現代設計，創造獨特文創商品', 7, 4.5, '台中市', 
  '["stationery", "creative_goods", "cultural_design"]'::jsonb),
  
('手作飾品館', '手工飾品訂製', '金工、銀飾、皮革等多元材質手作飾品', 8, 4.6, '台北市', 
  '["accessory", "jewelry", "leatherwork"]'::jsonb),
  
('全能訂製工坊', '各類產品訂製', '提供多元化訂製服務，從設計到製作全程掌控品質', 12, 4.6, '新竹市', 
  '["furniture", "decoration", "metalwork", "woodwork"]'::jsonb);

-- 6. 刷新 PostgREST 快取
NOTIFY pgrst, 'reload schema';

-- 7. 驗證資料
SELECT 
  'manufacturers' as table_name,
  COUNT(*) as record_count
FROM public.manufacturers
UNION ALL
SELECT 
  'custom_products' as table_name,
  COUNT(*) as record_count
FROM public.custom_products
UNION ALL
SELECT 
  'product_matches' as table_name,
  COUNT(*) as record_count
FROM public.product_matches;

-- 執行完成後應看到：
-- manufacturers: 10 筆
-- custom_products: 0 筆（待用戶發案）
-- product_matches: 0 筆（待媒合產生）
