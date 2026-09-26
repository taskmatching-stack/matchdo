-- 限時特價（僅年付訂閱）— 活動檔與各 tier 年付特價
-- 規劃：docs/PLAN-pricing-campaigns.md
-- 後台 migration id：pricing-campaigns

CREATE TABLE IF NOT EXISTS public.pricing_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    title_en text,
    note_internal text,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    input_timezone text NOT NULL DEFAULT 'Asia/Taipei',
    is_enabled boolean NOT NULL DEFAULT true,
    priority integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pricing_campaigns_ends_after_start CHECK (ends_at > starts_at)
);

COMMENT ON TABLE public.pricing_campaigns IS '訂閱年付限時特價活動（檔期；不修改 subscription_plans 常態價）';
COMMENT ON COLUMN public.pricing_campaigns.title IS '活動主題（繁中／預設）';
COMMENT ON COLUMN public.pricing_campaigns.title_en IS '活動主題（英文前台）';
COMMENT ON COLUMN public.pricing_campaigns.input_timezone IS '後台輸入檔期時使用的 IANA 時區（預設台北）';
COMMENT ON COLUMN public.pricing_campaigns.priority IS 'v1 建議單檔；保留供日後疊加';

CREATE INDEX IF NOT EXISTS idx_pricing_campaigns_enabled_window
    ON public.pricing_campaigns (is_enabled, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS public.pricing_campaign_yearly_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES public.pricing_campaigns(id) ON DELETE CASCADE,
    plan_key text NOT NULL,
    yearly_price_twd integer NOT NULL,
    yearly_price_usd numeric(10, 2) NOT NULL,
    CONSTRAINT pricing_campaign_yearly_rules_plan_key CHECK (
        plan_key IN ('tier2', 'tier3', 'tier4')
    ),
    CONSTRAINT pricing_campaign_yearly_rules_prices_positive CHECK (
        yearly_price_twd > 0 AND yearly_price_usd > 0
    ),
    UNIQUE (campaign_id, plan_key)
);

COMMENT ON TABLE public.pricing_campaign_yearly_rules IS '單檔活動內各公開方案的年付特價（整年 TWD／USD 一筆）';
COMMENT ON COLUMN public.pricing_campaign_yearly_rules.plan_key IS '與結帳 metadata.plan_key、前台 data-plan 一致';

CREATE INDEX IF NOT EXISTS idx_pricing_campaign_yearly_rules_campaign
    ON public.pricing_campaign_yearly_rules (campaign_id);
