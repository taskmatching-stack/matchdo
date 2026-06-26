-- ============================================
-- 修復腳本：先清理舊表再重建
-- ============================================

-- 1. 刪除所有相關表（CASCADE 會自動刪除依賴）
DROP TABLE IF EXISTS public.listings CASCADE;
DROP TABLE IF EXISTS public.experts_profile CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 2. 刪除觸發函數
DROP FUNCTION IF EXISTS update_users_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_experts_profile_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_listings_updated_at() CASCADE;

-- 3. 刪除舊的 RLS policies（如果存在）
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;

-- ============================================
-- 重新建立所有表
-- ============================================

-- Users 表
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    profile_completed BOOLEAN DEFAULT TRUE,
    phone TEXT,
    location TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_created_at ON public.users(created_at);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.users FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE FUNCTION update_users_updated_at()
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


-- Experts Profile 表
CREATE TABLE public.experts_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    specialty TEXT,
    experience_years INTEGER DEFAULT 0,
    description TEXT,
    rating DECIMAL(3,2) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
    total_reviews INTEGER DEFAULT 0,
    portfolio_urls TEXT[],
    certifications TEXT[],
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verified_at TIMESTAMP WITH TIME ZONE,
    business_name TEXT,
    business_license TEXT,
    service_areas TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_experts_user_id ON public.experts_profile(user_id);
CREATE INDEX idx_experts_specialty ON public.experts_profile(specialty);
CREATE INDEX idx_experts_rating ON public.experts_profile(rating DESC);
CREATE INDEX idx_experts_verification ON public.experts_profile(verification_status);

ALTER TABLE public.experts_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view verified experts"
    ON public.experts_profile FOR SELECT
    USING (verification_status = 'verified' OR user_id = auth.uid());

CREATE POLICY "Experts can update own profile"
    ON public.experts_profile FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Experts can insert own profile"
    ON public.experts_profile FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE FUNCTION update_experts_profile_updated_at()
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


-- Listings 表
CREATE TABLE public.listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    price_min INTEGER,
    price_max INTEGER,
    unit TEXT DEFAULT '次',
    delivery_days INTEGER,
    tags TEXT[],
    images TEXT[],
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
    views_count INTEGER DEFAULT 0,
    inquiries_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '90 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_listings_expert_id ON public.listings(expert_id);
CREATE INDEX idx_listings_category ON public.listings(category);
CREATE INDEX idx_listings_status ON public.listings(status);
CREATE INDEX idx_listings_created_at ON public.listings(created_at DESC);
CREATE INDEX idx_listings_tags ON public.listings USING GIN(tags);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active listings"
    ON public.listings FOR SELECT
    USING (status = 'active' OR expert_id = auth.uid());

CREATE POLICY "Experts can manage own listings"
    ON public.listings FOR ALL
    USING (expert_id = auth.uid());

CREATE FUNCTION update_listings_updated_at()
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


-- 修改 Projects 表
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'analyzing' CHECK (status IN ('analyzing', 'matched', 'in_progress', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
    ON public.projects FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can manage own projects"
    ON public.projects FOR ALL
    USING (owner_id = auth.uid());


-- 通知刷新
NOTIFY pgrst, 'reload schema';
