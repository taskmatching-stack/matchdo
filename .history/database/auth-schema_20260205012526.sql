-- ============================================
-- MatchDO 認證與用戶系統資料表
-- 執行順序：在 Supabase SQL Editor 中執行
-- ============================================

-- 1. Users 表（擴充 auth.users）
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL CHECK (role IN ('client', 'expert')),
    profile_completed BOOLEAN DEFAULT FALSE,
    phone TEXT,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);

-- RLS 啟用
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用戶只能查看/編輯自己的資料
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.users FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 觸發器：自動更新 updated_at
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();


-- 2. Experts Profile 表（專家檔案）
-- ============================================
CREATE TABLE IF NOT EXISTS public.experts_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    specialty TEXT NOT NULL, -- 專長（對應 ai_categories）
    experience_years INTEGER DEFAULT 0,
    description TEXT, -- 自我介紹
    rating DECIMAL(3,2) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
    total_reviews INTEGER DEFAULT 0,
    portfolio_urls TEXT[], -- 作品集 URLs
    certifications TEXT[], -- 證照/認證
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verified_at TIMESTAMP WITH TIME ZONE,
    business_name TEXT, -- 商家名稱
    business_license TEXT, -- 商業登記證號
    service_areas TEXT[], -- 服務區域
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_experts_user_id ON public.experts_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_experts_specialty ON public.experts_profile(specialty);
CREATE INDEX IF NOT EXISTS idx_experts_rating ON public.experts_profile(rating DESC);
CREATE INDEX IF NOT EXISTS idx_experts_verification ON public.experts_profile(verification_status);

-- RLS 啟用
ALTER TABLE public.experts_profile ENABLE ROW LEVEL SECURITY;

-- RLS 策略：所有人可查看已驗證專家，專家只能編輯自己的檔案
CREATE POLICY "Anyone can view verified experts"
    ON public.experts_profile FOR SELECT
    USING (verification_status = 'verified' OR user_id = auth.uid());

CREATE POLICY "Experts can update own profile"
    ON public.experts_profile FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Experts can insert own profile"
    ON public.experts_profile FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- 觸發器：自動更新 updated_at
CREATE OR REPLACE FUNCTION update_experts_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_experts_profile_updated_at
    BEFORE UPDATE ON public.experts_profile
    FOR EACH ROW
    EXECUTE FUNCTION update_experts_profile_updated_at();


-- 3. Listings 表（專家上架的報價項目）
-- ============================================
CREATE TABLE IF NOT EXISTS public.listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id UUID NOT NULL REFERENCES public.experts_profile(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- 對應 ai_categories.key
    description TEXT NOT NULL,
    price_min INTEGER,
    price_max INTEGER,
    unit TEXT DEFAULT '次', -- 單位（次、件、坪、m²）
    delivery_days INTEGER, -- 交期（天）
    tags TEXT[], -- AI 生成的隱藏 Tags
    images TEXT[], -- 圖片 URLs（Supabase Storage）
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
    views_count INTEGER DEFAULT 0,
    inquiries_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '90 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_listings_expert_id ON public.listings(expert_id);
CREATE INDEX IF NOT EXISTS idx_listings_category ON public.listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON public.listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_tags ON public.listings USING GIN(tags);

-- RLS 啟用
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- RLS 策略：所有人可查看 active 項目，專家只能編輯自己的
CREATE POLICY "Anyone can view active listings"
    ON public.listings FOR SELECT
    USING (status = 'active' OR expert_id = auth.uid());

CREATE POLICY "Experts can manage own listings"
    ON public.listings FOR ALL
    USING (expert_id = auth.uid());

-- 觸發器：自動更新 updated_at
CREATE OR REPLACE FUNCTION update_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_listings_updated_at
    BEFORE UPDATE ON public.listings
    FOR EACH ROW
    EXECUTE FUNCTION update_listings_updated_at();


-- 4. 修改 Projects 表（新增欄位）
-- ============================================
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'analyzing' CHECK (status IN ('analyzing', 'matched', 'in_progress', 'completed', 'cancelled'));

-- 索引
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

-- RLS 啟用
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用戶只能查看/編輯自己的專案
CREATE POLICY "Users can view own projects"
    ON public.projects FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can manage own projects"
    ON public.projects FOR ALL
    USING (owner_id = auth.uid());


-- 5. 插入測試用戶（可選）
-- ============================================
-- 注意：實際用戶會透過 Supabase Auth 建立
-- 這裡僅為開發測試用

-- INSERT INTO public.users (id, email, full_name, role, profile_completed)
-- VALUES 
--     ('00000000-0000-0000-0000-000000000001', 'client@test.com', '測試發案者', 'client', true),
--     ('00000000-0000-0000-0000-000000000002', 'expert@test.com', '測試專家', 'expert', true);

-- INSERT INTO public.experts_profile (user_id, specialty, experience_years, rating)
-- VALUES 
--     ('00000000-0000-0000-0000-000000000002', '室內設計', 5, 4.8);


-- 6. 通知 PostgREST 刷新快取
-- ============================================
NOTIFY pgrst, 'reload schema';


-- ============================================
-- 執行完成後，請在 Supabase Dashboard 完成：
-- 1. Authentication → Providers → 啟用 Google OAuth
-- 2. Storage → 建立 Buckets: 'project-images', 'custom-products'
-- 3. 測試登入功能
-- ============================================
