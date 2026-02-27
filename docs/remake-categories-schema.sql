-- 再製分類（改裝現有品服務：服裝改製、家具翻新、皮件保養等）
-- 供再製流程與廠商對齊；前後台皆可用
-- 執行：Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.remake_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_remake_categories_key ON public.remake_categories(key);
CREATE INDEX IF NOT EXISTS idx_remake_categories_sort ON public.remake_categories(sort_order);

COMMENT ON TABLE public.remake_categories IS '再製服務主分類（改裝現有品）';

ALTER TABLE public.remake_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active remake categories" ON public.remake_categories;
CREATE POLICY "Anyone can view active remake categories"
    ON public.remake_categories FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Allow all for remake_categories" ON public.remake_categories;
CREATE POLICY "Allow all for remake_categories"
    ON public.remake_categories FOR ALL
    USING (true);

-- 種子：改裝／再製向分類
INSERT INTO public.remake_categories (key, name, sort_order) VALUES
('apparel_remake', '服裝改製', 10),
('furniture_remake', '家具翻新', 20),
('leather_care', '皮件保養／改色', 30),
('shoes_repair', '鞋類維修／改款', 40),
('electronics_mod', '3C／電子改裝', 50),
('bag_repair', '包袋維修改製', 60),
('home_refurbish', '家居用品翻新', 70)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;
