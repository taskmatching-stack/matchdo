-- =============================================
-- Notifications 通知系統表 Schema
-- 功能：管理用戶通知（媒合、解鎖申請等）
-- =============================================

-- 建立 notifications 表
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN (
        'new_match',           -- 新媒合
        'unlock_request',      -- 收到解鎖申請
        'unlock_approved',     -- 解鎖申請已同意
        'unlock_rejected',     -- 解鎖申請被拒絕
        'new_message',         -- 新訊息
        'match_contacted',     -- 媒合已聯繫
        'system'               -- 系統通知
    )),
    title text NOT NULL,
    message text NOT NULL,
    link text,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    read_at timestamptz,
    created_at timestamptz DEFAULT now(),
    
    -- 關聯的資源 ID（可選）
    related_match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
    related_unlock_id uuid REFERENCES public.contact_unlocks(id) ON DELETE CASCADE
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 複合索引（常用查詢）
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- 添加註解
COMMENT ON TABLE public.notifications IS '用戶通知記錄';
COMMENT ON COLUMN public.notifications.id IS '通知唯一識別碼';
COMMENT ON COLUMN public.notifications.user_id IS '接收通知的用戶ID';
COMMENT ON COLUMN public.notifications.type IS '通知類型';
COMMENT ON COLUMN public.notifications.title IS '通知標題';
COMMENT ON COLUMN public.notifications.message IS '通知內容';
COMMENT ON COLUMN public.notifications.link IS '通知連結';
COMMENT ON COLUMN public.notifications.metadata IS '額外資料 JSON';
COMMENT ON COLUMN public.notifications.is_read IS '是否已讀';
COMMENT ON COLUMN public.notifications.read_at IS '已讀時間';
COMMENT ON COLUMN public.notifications.created_at IS '建立時間';
COMMENT ON COLUMN public.notifications.related_match_id IS '相關媒合記錄ID';
COMMENT ON COLUMN public.notifications.related_unlock_id IS '相關解鎖記錄ID';

-- 啟用 RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1. 用戶只能查看自己的通知
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (user_id = auth.uid());

-- 2. 系統可以插入通知（由後端 service_role 執行）
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

-- 3. 用戶可以更新自己的通知（標記已讀）
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 4. 用戶可以刪除自己的通知
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    USING (user_id = auth.uid());

-- 5. 管理員可以查看所有通知
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
CREATE POLICY "Admins can view all notifications"
    ON public.notifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 建立自動標記已讀時間的觸發器
CREATE OR REPLACE FUNCTION update_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_read = true AND OLD.is_read = false THEN
        NEW.read_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notification_read_at_trigger ON public.notifications;
CREATE TRIGGER update_notification_read_at_trigger
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_read_at();

-- 建立輔助函數：取得未讀通知數量
CREATE OR REPLACE FUNCTION get_unread_notification_count(target_user_id uuid)
RETURNS integer AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::integer
        FROM public.notifications
        WHERE user_id = target_user_id
        AND is_read = false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_unread_notification_count IS '取得指定用戶的未讀通知數量';

-- 建立輔助函數：批量標記已讀
CREATE OR REPLACE FUNCTION mark_notifications_as_read(
    target_user_id uuid,
    notification_ids uuid[] DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
    updated_count integer;
BEGIN
    IF notification_ids IS NULL THEN
        -- 標記所有未讀通知為已讀
        UPDATE public.notifications
        SET is_read = true
        WHERE user_id = target_user_id
        AND is_read = false;
    ELSE
        -- 標記指定通知為已讀
        UPDATE public.notifications
        SET is_read = true
        WHERE user_id = target_user_id
        AND id = ANY(notification_ids)
        AND is_read = false;
    END IF;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_notifications_as_read IS '批量標記通知為已讀';

-- 驗證建立結果
SELECT 
    'notifications 表建立成功！' as message,
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE is_read = false) as unread_notifications
FROM public.notifications;
