-- 訂製品廠商分類（設計向：服飾、運動用品、沙發家具等）
-- 供訂製品流程與廠商 manufacturers.categories 對齊；後台可編輯
-- 執行：Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.custom_product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_product_categories_key ON public.custom_product_categories(key);
CREATE INDEX IF NOT EXISTS idx_custom_product_categories_sort ON public.custom_product_categories(sort_order);

ALTER TABLE public.custom_product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active custom product categories" ON public.custom_product_categories;
CREATE POLICY "Anyone can view active custom product categories"
    ON public.custom_product_categories FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Allow all for custom_product_categories" ON public.custom_product_categories;
CREATE POLICY "Allow all for custom_product_categories"
    ON public.custom_product_categories FOR ALL
    USING (true);

-- 種子：設計向分類（key 與 manufacturers.categories 對齊）
INSERT INTO public.custom_product_categories (key, name, sort_order) VALUES
('apparel', '服飾', 10),
('sports_goods', '運動用品', 20),
('sofa_furniture', '沙發／家具', 30),
('bag', '包袋', 40),
('shoes', '鞋類', 50),
('home_textile', '家居織品', 60),
('gift', '禮贈品', 70),
('furniture', '家具', 35),
('textile', '布料／織品', 65)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;
