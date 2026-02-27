-- 訂製品廠商「子分類」（隸屬於 custom_product_categories）
-- 執行：Supabase SQL Editor（請先執行 custom-product-categories-schema.sql）

CREATE TABLE IF NOT EXISTS public.custom_product_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_key TEXT NOT NULL REFERENCES public.custom_product_categories(key) ON DELETE CASCADE,
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category_key, key)
);

CREATE INDEX IF NOT EXISTS idx_custom_product_subcategories_category ON public.custom_product_subcategories(category_key);
CREATE INDEX IF NOT EXISTS idx_custom_product_subcategories_sort ON public.custom_product_subcategories(category_key, sort_order);

COMMENT ON TABLE public.custom_product_subcategories IS '訂製品廠商子分類（隸屬主分類）';
COMMENT ON COLUMN public.custom_product_subcategories.key IS '子分類 key，同一主分類內不可重複';

ALTER TABLE public.custom_product_subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active custom product subcategories" ON public.custom_product_subcategories;
CREATE POLICY "Anyone can view active custom product subcategories"
    ON public.custom_product_subcategories FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Allow all for custom_product_subcategories" ON public.custom_product_subcategories;
CREATE POLICY "Allow all for custom_product_subcategories"
    ON public.custom_product_subcategories FOR ALL
    USING (true);

-- 種子：每主分類下各加幾個子分類範例（可依需要修改）
INSERT INTO public.custom_product_subcategories (category_key, key, name, sort_order) VALUES
('apparel', 'tshirt', 'T恤', 10),
('apparel', 'jacket', '外套', 20),
('apparel', 'pants', '褲裝', 30),
('furniture', 'sofa', '沙發', 10),
('furniture', 'chair', '椅凳', 20),
('furniture', 'table', '桌几', 30),
('bag', 'backpack', '後背包', 10),
('bag', 'tote', '托特包', 20),
('shoes', 'sneakers', '休閒鞋', 10),
('shoes', 'boots', '靴子', 20)
ON CONFLICT (category_key, key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;
