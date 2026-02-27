-- =============================================
-- Subscriptions 訂閱方案與點數系統 Schema
-- 功能：管理訂閱方案、用戶訂閱、點數系統、使用量追蹤
-- =============================================

-- 清理舊資料（重新建立時使用）
DROP TABLE IF EXISTS public.credit_transactions CASCADE;
DROP TABLE IF EXISTS public.user_credits CASCADE;
DROP TABLE IF EXISTS public.user_usage_stats CASCADE;
DROP TABLE IF EXISTS public.user_subscriptions CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;
DROP FUNCTION IF EXISTS update_subscription_plans_updated_at CASCADE;
DROP FUNCTION IF EXISTS update_user_usage_stats_updated_at CASCADE;
DROP FUNCTION IF EXISTS update_user_credits_updated_at CASCADE;

-- 建立訂閱方案表
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    price integer NOT NULL,
    duration_months integer NOT NULL,
    credits_monthly integer DEFAULT 0,
    
    -- 方案限制設定（可在管理後台調整，-1 表示無限制）
    max_projects integer DEFAULT -1,
    max_listings integer DEFAULT -1,
    max_active_projects integer DEFAULT -1,
    max_project_items integer DEFAULT -1,
    
    -- 方案特色與權益
    features jsonb DEFAULT '[]'::jsonb,
    is_vendor_listing boolean DEFAULT false,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    plan_key text,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_sort ON public.subscription_plans(sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_plan_key ON public.subscription_plans(plan_key) WHERE plan_key IS NOT NULL;

-- 添加註解
COMMENT ON TABLE public.subscription_plans IS '訂閱方案設定';
COMMENT ON COLUMN public.subscription_plans.name IS '方案名稱';
COMMENT ON COLUMN public.subscription_plans.price IS '方案價格（台幣）';
COMMENT ON COLUMN public.subscription_plans.duration_months IS '訂閱期限（月數）';
COMMENT ON COLUMN public.subscription_plans.credits_monthly IS '每月贈送點數';
COMMENT ON COLUMN public.subscription_plans.max_projects IS '發案數量上限（-1=無限制）';
COMMENT ON COLUMN public.subscription_plans.max_listings IS '報價刊登數量上限（-1=無限制）';
COMMENT ON COLUMN public.subscription_plans.max_active_projects IS '同時進行中專案數上限（-1=無限制）';
COMMENT ON COLUMN public.subscription_plans.max_project_items IS '單一專案分包項目數上限（-1=無限制）';
COMMENT ON COLUMN public.subscription_plans.features IS '方案特色列表';
COMMENT ON COLUMN public.subscription_plans.is_vendor_listing IS '是否可公開廠商資料（長期訂閱專屬）';
COMMENT ON COLUMN public.subscription_plans.plan_key IS '方案代碼，與前端 data-plan 對應，例 tier2、tier3、tier4（年付建立 user_subscriptions 時用）';

-- 建立用戶訂閱記錄表
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
    start_date timestamptz DEFAULT now(),
    end_date timestamptz NOT NULL,
    status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    auto_renew boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_end_date ON public.user_subscriptions(end_date);

-- 複合索引
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON public.user_subscriptions(user_id, status);

-- 添加註解
COMMENT ON TABLE public.user_subscriptions IS '用戶訂閱記錄';
COMMENT ON COLUMN public.user_subscriptions.status IS '訂閱狀態：active=進行中, expired=已過期, cancelled=已取消';

-- 建立使用量追蹤表
CREATE TABLE IF NOT EXISTS public.user_usage_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    current_projects integer DEFAULT 0,
    current_active_projects integer DEFAULT 0,
    current_listings integer DEFAULT 0,
    monthly_projects_created integer DEFAULT 0,
    monthly_listings_created integer DEFAULT 0,
    last_reset_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_user_usage_stats_user_id ON public.user_usage_stats(user_id);

-- 添加註解
COMMENT ON TABLE public.user_usage_stats IS '用戶使用量統計（用於檢查方案限制）';
COMMENT ON COLUMN public.user_usage_stats.current_projects IS '當前專案總數';
COMMENT ON COLUMN public.user_usage_stats.current_active_projects IS '當前進行中專案數';
COMMENT ON COLUMN public.user_usage_stats.current_listings IS '當前報價刊登數';
COMMENT ON COLUMN public.user_usage_stats.monthly_projects_created IS '本月建立專案數（每月1號重置）';
COMMENT ON COLUMN public.user_usage_stats.monthly_listings_created IS '本月建立報價數（每月1號重置）';
COMMENT ON COLUMN public.user_usage_stats.last_reset_at IS '上次重置時間';

-- 建立點數表
CREATE TABLE IF NOT EXISTS public.user_credits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    balance integer DEFAULT 0,
    total_earned integer DEFAULT 0,
    total_spent integer DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);

-- 添加註解
COMMENT ON TABLE public.user_credits IS '用戶點數餘額（永久有效，不過期）';
COMMENT ON COLUMN public.user_credits.balance IS '當前點數餘額';
COMMENT ON COLUMN public.user_credits.total_earned IS '累計獲得點數';
COMMENT ON COLUMN public.user_credits.total_spent IS '累計消費點數';

-- 建立點數交易記錄表
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('purchase', 'granted', 'consumed')),
    amount integer NOT NULL,
    balance_after integer NOT NULL,
    source text,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);

-- 複合索引
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created ON public.credit_transactions(user_id, created_at DESC);

-- 添加註解
COMMENT ON TABLE public.credit_transactions IS '點數交易記錄';
COMMENT ON COLUMN public.credit_transactions.type IS '交易類型：purchase=購買, granted=贈送, consumed=消費';
COMMENT ON COLUMN public.credit_transactions.amount IS '交易金額（正數=獲得，負數=消費）';
COMMENT ON COLUMN public.credit_transactions.balance_after IS '交易後餘額';
COMMENT ON COLUMN public.credit_transactions.source IS '來源：subscription=訂閱贈送, purchase=直接購買, ai_service=AI服務消費';

-- 啟用 RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans

-- 1. 所有人都可以查看啟用的方案
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view active plans"
    ON public.subscription_plans FOR SELECT
    USING (is_active = true);

-- 2. 管理員可以查看所有方案
DROP POLICY IF EXISTS "Admins can view all plans" ON public.subscription_plans;
CREATE POLICY "Admins can view all plans"
    ON public.subscription_plans FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 3. 管理員可以新增方案
DROP POLICY IF EXISTS "Admins can insert plans" ON public.subscription_plans;
CREATE POLICY "Admins can insert plans"
    ON public.subscription_plans FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 4. 管理員可以更新方案
DROP POLICY IF EXISTS "Admins can update plans" ON public.subscription_plans;
CREATE POLICY "Admins can update plans"
    ON public.subscription_plans FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- RLS Policies for user_subscriptions

-- 1. 用戶可以查看自己的訂閱
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscriptions"
    ON public.user_subscriptions FOR SELECT
    USING (user_id = auth.uid());

-- 2. 管理員可以查看所有訂閱
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can view all subscriptions"
    ON public.user_subscriptions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- RLS Policies for user_usage_stats

-- 1. 用戶可以查看自己的使用量
DROP POLICY IF EXISTS "Users can view own usage stats" ON public.user_usage_stats;
CREATE POLICY "Users can view own usage stats"
    ON public.user_usage_stats FOR SELECT
    USING (user_id = auth.uid());

-- 2. 管理員可以查看所有使用量
DROP POLICY IF EXISTS "Admins can view all usage stats" ON public.user_usage_stats;
CREATE POLICY "Admins can view all usage stats"
    ON public.user_usage_stats FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- RLS Policies for user_credits

-- 1. 用戶可以查看自己的點數
DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
CREATE POLICY "Users can view own credits"
    ON public.user_credits FOR SELECT
    USING (user_id = auth.uid());

-- 2. 管理員可以查看所有點數
DROP POLICY IF EXISTS "Admins can view all credits" ON public.user_credits;
CREATE POLICY "Admins can view all credits"
    ON public.user_credits FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- RLS Policies for credit_transactions

-- 1. 用戶可以查看自己的交易記錄
DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;
CREATE POLICY "Users can view own transactions"
    ON public.credit_transactions FOR SELECT
    USING (user_id = auth.uid());

-- 2. 管理員可以查看所有交易記錄
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.credit_transactions;
CREATE POLICY "Admins can view all transactions"
    ON public.credit_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 建立自動更新 updated_at 的觸發器
CREATE OR REPLACE FUNCTION update_subscription_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at_trigger ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at_trigger
    BEFORE UPDATE ON public.subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_plans_updated_at();

-- 建立自動更新 user_usage_stats.updated_at 的觸發器
CREATE OR REPLACE FUNCTION update_user_usage_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_usage_stats_updated_at_trigger ON public.user_usage_stats;
CREATE TRIGGER update_user_usage_stats_updated_at_trigger
    BEFORE UPDATE ON public.user_usage_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_user_usage_stats_updated_at();

-- 建立自動更新 user_credits.updated_at 的觸發器
CREATE OR REPLACE FUNCTION update_user_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_credits_updated_at_trigger ON public.user_credits;
CREATE TRIGGER update_user_credits_updated_at_trigger
    BEFORE UPDATE ON public.user_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_user_credits_updated_at();

-- 驗證建立結果
SELECT 
    'subscriptions 系統建立成功！' as message,
    (SELECT COUNT(*) FROM public.subscription_plans) as total_plans,
    (SELECT COUNT(*) FROM public.user_subscriptions) as total_subscriptions,
    (SELECT COUNT(*) FROM public.user_credits) as total_users_with_credits;
