-- ========================================
-- MatchDO 聯絡資訊系統
-- 更新日期：2026-02-05
-- ========================================

-- 功能說明：
-- 1. 專家和發案者都可以填寫完整聯絡資訊
-- 2. 預設資訊隱藏，只有媒合成功後才能看到
-- 3. 支援多種聯絡方式：電話、LINE、Email、社群、官網等

-- ========================================
-- 清理舊資料（重新建立時使用）
-- ========================================
DROP TABLE IF EXISTS public.contact_info CASCADE;
DROP TABLE IF EXISTS public.social_links CASCADE;

-- 移除 users 表的聯絡欄位（如果存在）
ALTER TABLE public.users 
DROP COLUMN IF EXISTS phone,
DROP COLUMN IF EXISTS line_id,
DROP COLUMN IF EXISTS website_url,
DROP COLUMN IF EXISTS company_name,
DROP COLUMN IF EXISTS address,
DROP COLUMN IF EXISTS bio;

-- ========================================
-- 1. 擴展 users 表：新增基本聯絡欄位
-- ========================================

-- 為 users 表新增基本聯絡資訊欄位
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS line_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS company_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT;

COMMENT ON COLUMN public.users.phone IS '聯絡電話（媒合成功後揭露）';
COMMENT ON COLUMN public.users.line_id IS 'LINE ID（媒合成功後揭露）';
COMMENT ON COLUMN public.users.website_url IS '官方網站或作品集網址';
COMMENT ON COLUMN public.users.company_name IS '公司/工作室名稱';
COMMENT ON COLUMN public.users.address IS '服務地區或公司地址';
COMMENT ON COLUMN public.users.bio IS '自我介紹或服務說明';

-- ========================================
-- 2. 建立 contact_info 表：詳細聯絡資訊
-- ========================================

CREATE TABLE IF NOT EXISTS public.contact_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- 基本聯絡方式
    phone VARCHAR(20),
    phone_visible BOOLEAN DEFAULT FALSE,
    mobile VARCHAR(20),
    mobile_visible BOOLEAN DEFAULT FALSE,
    email VARCHAR(255),
    email_visible BOOLEAN DEFAULT FALSE,
    line_id VARCHAR(100),
    line_visible BOOLEAN DEFAULT FALSE,
    
    -- 社群網站
    facebook_url TEXT,
    facebook_visible BOOLEAN DEFAULT FALSE,
    instagram_url TEXT,
    instagram_visible BOOLEAN DEFAULT FALSE,
    linkedin_url TEXT,
    linkedin_visible BOOLEAN DEFAULT FALSE,
    youtube_url TEXT,
    youtube_visible BOOLEAN DEFAULT FALSE,
    
    -- 專業平台
    website_url TEXT,
    website_visible BOOLEAN DEFAULT TRUE, -- 官網預設可見
    portfolio_url TEXT,
    portfolio_visible BOOLEAN DEFAULT TRUE, -- 作品集預設可見
    
    -- 其他資訊
    wechat_id VARCHAR(100),
    wechat_visible BOOLEAN DEFAULT FALSE,
    telegram_id VARCHAR(100),
    telegram_visible BOOLEAN DEFAULT FALSE,
    whatsapp VARCHAR(20),
    whatsapp_visible BOOLEAN DEFAULT FALSE,
    
    -- 公司資訊
    company_name VARCHAR(200),
    company_address TEXT,
    company_tax_id VARCHAR(20), -- 統編（不對外顯示，僅用於開發票）
    
    -- 偏好聯絡方式（陣列，可多選）
    preferred_contact_methods TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- 營業時間
    business_hours JSONB DEFAULT '{"weekdays": "09:00-18:00", "weekend": "休息"}'::JSONB,
    
    -- 時間戳記
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 確保每個用戶只有一筆聯絡資訊
    UNIQUE(user_id)
);

COMMENT ON TABLE public.contact_info IS '用戶詳細聯絡資訊（媒合成功後才能揭露）';
COMMENT ON COLUMN public.contact_info.phone_visible IS '是否公開顯示電話';
COMMENT ON COLUMN public.contact_info.preferred_contact_methods IS '偏好聯絡方式: phone, line, email, facebook, instagram 等';
COMMENT ON COLUMN public.contact_info.company_tax_id IS '統一編號（不對外顯示，僅供開立發票使用）';

-- ========================================
-- 3. 建立 contact_unlocks 表：聯絡資訊解鎖記錄
-- ========================================

CREATE TABLE IF NOT EXISTS public.contact_unlocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 解鎖雙方
    requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- 解鎖原因（基於哪個專案或報價的媒合）
    match_type VARCHAR(50) NOT NULL, -- 'project_match', 'custom_product_match', 'listing_match'
    match_reference_id UUID, -- 關聯的 project_id, custom_product_id 或 listing_id
    
    -- 解鎖狀態
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, accepted, expired
    unlock_method VARCHAR(50), -- 'auto' (自動解鎖), 'mutual' (雙方同意)
    
    -- 解鎖範圍（可以只解鎖部分資訊）
    unlocked_fields TEXT[] DEFAULT ARRAY['phone', 'line_id', 'email']::TEXT[],
    
    -- 有效期限（可選，例如 30 天後自動過期）
    expires_at TIMESTAMPTZ,
    
    -- 時間戳記
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    
    -- 確保同一媒合不會重複解鎖
    UNIQUE(requester_id, target_id, match_reference_id)
);

COMMENT ON TABLE public.contact_unlocks IS '聯絡資訊解鎖記錄（媒合成功後建立）';
COMMENT ON COLUMN public.contact_unlocks.match_type IS '媒合類型：project_match, custom_product_match, listing_match';
COMMENT ON COLUMN public.contact_unlocks.unlocked_fields IS '已解鎖的欄位清單';

-- ========================================
-- 4. 建立索引
-- ========================================

CREATE INDEX IF NOT EXISTS idx_contact_info_user_id ON public.contact_info(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_requester ON public.contact_unlocks(requester_id);
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_target ON public.contact_unlocks(target_id);
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_match_ref ON public.contact_unlocks(match_reference_id);
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_status ON public.contact_unlocks(status);

-- ========================================
-- 5. 建立 RLS Policies
-- ========================================

-- contact_info RLS：用戶只能讀寫自己的聯絡資訊
ALTER TABLE public.contact_info ENABLE ROW LEVEL SECURITY;

-- 用戶可以讀取自己的完整資訊
CREATE POLICY "用戶可以查看自己的聯絡資訊"
ON public.contact_info FOR SELECT
USING (auth.uid() = user_id);

-- 用戶可以新增/更新自己的資訊
CREATE POLICY "用戶可以新增自己的聯絡資訊"
ON public.contact_info FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用戶可以更新自己的聯絡資訊"
ON public.contact_info FOR UPDATE
USING (auth.uid() = user_id);

-- contact_unlocks RLS
ALTER TABLE public.contact_unlocks ENABLE ROW LEVEL SECURITY;

-- 雙方都可以查看解鎖記錄
CREATE POLICY "用戶可以查看相關的解鎖記錄"
ON public.contact_unlocks FOR SELECT
USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- 用戶可以建立解鎖請求
CREATE POLICY "用戶可以建立解鎖請求"
ON public.contact_unlocks FOR INSERT
WITH CHECK (auth.uid() = requester_id);

-- 目標用戶可以接受/拒絕解鎖
CREATE POLICY "目標用戶可以更新解鎖狀態"
ON public.contact_unlocks FOR UPDATE
USING (auth.uid() = target_id);

-- ========================================
-- 6. 建立自動更新時間戳記的觸發器
-- ========================================

CREATE OR REPLACE FUNCTION update_contact_info_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_info_update_timestamp
BEFORE UPDATE ON public.contact_info
FOR EACH ROW
EXECUTE FUNCTION update_contact_info_timestamp();

-- ========================================
-- 7. 建立檢視：已解鎖的聯絡資訊
-- ========================================

-- 檢視：用戶可以看到已解鎖對象的聯絡資訊
CREATE OR REPLACE VIEW public.unlocked_contacts AS
SELECT 
    cu.id AS unlock_id,
    cu.requester_id,
    cu.target_id,
    cu.match_type,
    cu.match_reference_id,
    cu.status,
    cu.created_at AS unlocked_at,
    
    -- 目標用戶的基本資訊
    u.full_name,
    u.email AS public_email,
    u.company_name,
    u.avatar_url,
    
    -- 根據解鎖欄位和可見性設定，有條件地顯示聯絡資訊
    CASE 
        WHEN cu.status = 'accepted' AND 'phone' = ANY(cu.unlocked_fields) AND ci.phone_visible 
        THEN ci.phone 
    END AS phone,
    
    CASE 
        WHEN cu.status = 'accepted' AND 'mobile' = ANY(cu.unlocked_fields) AND ci.mobile_visible 
        THEN ci.mobile 
    END AS mobile,
    
    CASE 
        WHEN cu.status = 'accepted' AND 'line_id' = ANY(cu.unlocked_fields) AND ci.line_visible 
        THEN ci.line_id 
    END AS line_id,
    
    CASE 
        WHEN cu.status = 'accepted' AND 'email' = ANY(cu.unlocked_fields) AND ci.email_visible 
        THEN ci.email 
    END AS email,
    
    CASE 
        WHEN cu.status = 'accepted' AND 'facebook_url' = ANY(cu.unlocked_fields) AND ci.facebook_visible 
        THEN ci.facebook_url 
    END AS facebook_url,
    
    CASE 
        WHEN cu.status = 'accepted' AND 'instagram_url' = ANY(cu.unlocked_fields) AND ci.instagram_visible 
        THEN ci.instagram_url 
    END AS instagram_url,
    
    -- 官網和作品集通常預設可見
    ci.website_url,
    ci.portfolio_url,
    
    ci.preferred_contact_methods,
    ci.business_hours

FROM public.contact_unlocks cu
INNER JOIN public.users u ON u.id = cu.target_id
LEFT JOIN public.contact_info ci ON ci.user_id = cu.target_id
WHERE cu.status = 'accepted' 
  AND (cu.expires_at IS NULL OR cu.expires_at > NOW());

COMMENT ON VIEW public.unlocked_contacts IS '已解鎖的聯絡資訊檢視（自動根據權限過濾）';

-- ========================================
-- 8. 建立輔助函數：檢查解鎖權限
-- ========================================

CREATE OR REPLACE FUNCTION check_contact_unlock_permission(
    p_requester_id UUID,
    p_target_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.contact_unlocks
        WHERE requester_id = p_requester_id
          AND target_id = p_target_id
          AND status = 'accepted'
          AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_contact_unlock_permission IS '檢查用戶是否有權限查看目標用戶的聯絡資訊';

-- ========================================
-- 完成！
-- ========================================

-- 執行後請驗證：
-- SELECT * FROM public.contact_info LIMIT 1;
-- SELECT * FROM public.contact_unlocks LIMIT 1;
-- SELECT * FROM public.unlocked_contacts LIMIT 1;
