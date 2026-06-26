-- =============================================
-- Contact Unlocks 聯絡資訊解鎖表 Schema
-- 功能：管理聯絡資訊的解鎖申請與審核
-- =============================================

-- 清理舊資料（重新建立時使用）
DROP TABLE IF EXISTS public.contact_unlocks CASCADE;
DROP FUNCTION IF EXISTS request_contact_unlock CASCADE;
DROP FUNCTION IF EXISTS approve_contact_unlock CASCADE;
DROP FUNCTION IF EXISTS reject_contact_unlock CASCADE;
DROP FUNCTION IF EXISTS get_unlocked_contacts CASCADE;

-- 建立 contact_unlocks 表
CREATE TABLE IF NOT EXISTS public.contact_unlocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    unlocked_fields text[] DEFAULT ARRAY[]::text[],
    request_message text,
    response_message text,
    expires_at timestamptz,
    approved_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- 確保同一組合只有一筆有效申請
    UNIQUE(requester_id, target_id, match_id)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_requester_id ON public.contact_unlocks(requester_id);
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_target_id ON public.contact_unlocks(target_id);
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_match_id ON public.contact_unlocks(match_id);
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_status ON public.contact_unlocks(status);
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_created_at ON public.contact_unlocks(created_at DESC);

-- 複合索引
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_target_status ON public.contact_unlocks(target_id, status);

-- 添加註解
COMMENT ON TABLE public.contact_unlocks IS '聯絡資訊解鎖申請記錄';
COMMENT ON COLUMN public.contact_unlocks.id IS '解鎖記錄唯一識別碼';
COMMENT ON COLUMN public.contact_unlocks.requester_id IS '申請者用戶ID';
COMMENT ON COLUMN public.contact_unlocks.target_id IS '被申請者用戶ID';
COMMENT ON COLUMN public.contact_unlocks.match_id IS '相關媒合記錄ID';
COMMENT ON COLUMN public.contact_unlocks.status IS '狀態：pending=待審核, approved=已同意, rejected=已拒絕, expired=已過期';
COMMENT ON COLUMN public.contact_unlocks.unlocked_fields IS '已解鎖的欄位列表';
COMMENT ON COLUMN public.contact_unlocks.request_message IS '申請留言';
COMMENT ON COLUMN public.contact_unlocks.response_message IS '回覆留言';
COMMENT ON COLUMN public.contact_unlocks.expires_at IS '過期時間';
COMMENT ON COLUMN public.contact_unlocks.approved_at IS '同意時間';

-- 啟用 RLS
ALTER TABLE public.contact_unlocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1. 申請者可以查看自己發起的申請
DROP POLICY IF EXISTS "Requesters can view their requests" ON public.contact_unlocks;
CREATE POLICY "Requesters can view their requests"
    ON public.contact_unlocks FOR SELECT
    USING (requester_id = auth.uid());

-- 2. 被申請者可以查看針對自己的申請
DROP POLICY IF EXISTS "Targets can view requests for them" ON public.contact_unlocks;
CREATE POLICY "Targets can view requests for them"
    ON public.contact_unlocks FOR SELECT
    USING (target_id = auth.uid());

-- 3. 用戶可以發起解鎖申請
DROP POLICY IF EXISTS "Users can create unlock requests" ON public.contact_unlocks;
CREATE POLICY "Users can create unlock requests"
    ON public.contact_unlocks FOR INSERT
    WITH CHECK (requester_id = auth.uid());

-- 4. 被申請者可以更新申請狀態（同意/拒絕）
DROP POLICY IF EXISTS "Targets can update request status" ON public.contact_unlocks;
CREATE POLICY "Targets can update request status"
    ON public.contact_unlocks FOR UPDATE
    USING (target_id = auth.uid())
    WITH CHECK (target_id = auth.uid());

-- 5. 管理員可以查看所有解鎖記錄
DROP POLICY IF EXISTS "Admins can view all unlocks" ON public.contact_unlocks;
CREATE POLICY "Admins can view all unlocks"
    ON public.contact_unlocks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 建立自動更新 updated_at 的觸發器
CREATE OR REPLACE FUNCTION update_contact_unlocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contact_unlocks_updated_at_trigger ON public.contact_unlocks;
CREATE TRIGGER update_contact_unlocks_updated_at_trigger
    BEFORE UPDATE ON public.contact_unlocks
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_unlocks_updated_at();

-- 建立檢視：已解鎖的聯絡資訊
CREATE OR REPLACE VIEW public.unlocked_contacts AS
SELECT 
    cu.id as unlock_id,
    cu.requester_id,
    cu.target_id,
    cu.match_id,
    cu.unlocked_fields,
    cu.approved_at,
    cu.expires_at,
    -- 從 contact_info 表取得聯絡資訊（只顯示已解鎖的欄位）
    ci.phone,
    ci.mobile,
    ci.line_id,
    ci.wechat_id,
    ci.telegram_id,
    ci.email,
    ci.facebook_url as facebook,
    ci.instagram_url as instagram,
    ci.company_name,
    ci.company_address,
    ci.website_url as website,
    ci.portfolio_url
FROM public.contact_unlocks cu
LEFT JOIN public.contact_info ci ON ci.user_id = cu.target_id
WHERE cu.status = 'approved'
  AND (cu.expires_at IS NULL OR cu.expires_at > now());

COMMENT ON VIEW public.unlocked_contacts IS '已解鎖的聯絡資訊（僅顯示已同意且未過期的記錄）';

-- 驗證建立結果
SELECT 
    'contact_unlocks 表建立成功！' as message,
    COUNT(*) as total_unlocks
FROM public.contact_unlocks;
