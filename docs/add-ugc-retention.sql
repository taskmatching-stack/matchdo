-- 免費方案 UGC 留存（Coldline／存取驅動）— profiles + UGC 表 + 訂閱取消原因
-- 見 docs/PLAN-free-tier-90d-retention.md

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS wall_grace_until timestamptz,
    ADD COLUMN IF NOT EXISTS ugc_free_retention_started_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_downgrade_kind text;

COMMENT ON COLUMN public.profiles.wall_grace_until IS '非自願降級：上牆控制緩衝截止（通常 +15 天）';
COMMENT ON COLUMN public.profiles.ugc_free_retention_started_at IS '最近一次進入免費 UGC 留存規則';
COMMENT ON COLUMN public.profiles.last_downgrade_kind IS 'voluntary | involuntary';

ALTER TABLE public.user_subscriptions
    ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
    ADD COLUMN IF NOT EXISTS cancellation_reason text;

COMMENT ON COLUMN public.user_subscriptions.cancellation_reason IS 'user_voluntary | payment_failed | expired_no_renew | plan_change | admin';

ALTER TABLE public.custom_products
    ADD COLUMN IF NOT EXISTS generation_completed_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz,
    ADD COLUMN IF NOT EXISTS free_retention_started_at timestamptz,
    ADD COLUMN IF NOT EXISTS retention_tier text DEFAULT 'free',
    ADD COLUMN IF NOT EXISTS storage_tier text DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS soft_deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS wall_category_key text,
    ADD COLUMN IF NOT EXISTS content_kind text DEFAULT 'design';

COMMENT ON COLUMN public.custom_products.retention_tier IS 'free | paid | staff';
COMMENT ON COLUMN public.custom_products.storage_tier IS 'standard | coldline';
COMMENT ON COLUMN public.custom_products.content_kind IS 'design（訂製品生圖）';

ALTER TABLE public.product_promo_generations
    ADD COLUMN IF NOT EXISTS generation_completed_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz,
    ADD COLUMN IF NOT EXISTS free_retention_started_at timestamptz,
    ADD COLUMN IF NOT EXISTS retention_tier text DEFAULT 'free',
    ADD COLUMN IF NOT EXISTS storage_tier text DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS soft_deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS wall_category_key text,
    ADD COLUMN IF NOT EXISTS content_kind text;

COMMENT ON COLUMN public.product_promo_generations.content_kind IS 'promo_product | promo_space | promo_portrait';

CREATE INDEX IF NOT EXISTS idx_custom_products_retention_sweep
    ON public.custom_products (retention_tier, storage_tier, last_accessed_at)
    WHERE soft_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_promo_generations_retention_sweep
    ON public.product_promo_generations (retention_tier, storage_tier, last_accessed_at)
    WHERE soft_deleted_at IS NULL;
