-- 情境圖：是否展示於首頁媒體牆（邏輯同 custom_products.show_on_homepage）
ALTER TABLE public.product_promo_generations
    ADD COLUMN IF NOT EXISTS show_on_homepage BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.product_promo_generations.show_on_homepage IS '是否同意展示於首頁媒體牆「情境圖」篩選（免費會員生圖時後端強制 true）';

CREATE INDEX IF NOT EXISTS idx_product_promo_generations_show_on_homepage
    ON public.product_promo_generations (show_on_homepage, created_at DESC)
    WHERE show_on_homepage = true AND status = 'success';
