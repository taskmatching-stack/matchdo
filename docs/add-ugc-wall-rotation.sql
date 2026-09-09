-- 媒體牆小分類內部輪替：標記系統下架（不刪檔）
-- 見 docs/PLAN-free-tier-90d-retention.md §4.5

ALTER TABLE public.custom_products
    ADD COLUMN IF NOT EXISTS wall_rotated_off_at timestamptz;

ALTER TABLE public.product_promo_generations
    ADD COLUMN IF NOT EXISTS wall_rotated_off_at timestamptz;

COMMENT ON COLUMN public.custom_products.wall_rotated_off_at IS '內部牆輪替下架時間；enforceFreeWall 不強制重新上牆';
COMMENT ON COLUMN public.product_promo_generations.wall_rotated_off_at IS '內部牆輪替下架時間；enforceFreeWall 不強制重新上牆';
