-- 再製子分類（隸屬於 remake_categories）
-- 執行：Supabase SQL Editor（請先執行 remake-categories-schema.sql）

CREATE TABLE IF NOT EXISTS public.remake_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_key TEXT NOT NULL REFERENCES public.remake_categories(key) ON DELETE CASCADE,
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category_key, key)
);

CREATE INDEX IF NOT EXISTS idx_remake_subcategories_category ON public.remake_subcategories(category_key);
CREATE INDEX IF NOT EXISTS idx_remake_subcategories_sort ON public.remake_subcategories(category_key, sort_order);

COMMENT ON TABLE public.remake_subcategories IS '再製服務子分類（隸屬主分類）';

ALTER TABLE public.remake_subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active remake subcategories" ON public.remake_subcategories;
CREATE POLICY "Anyone can view active remake subcategories"
    ON public.remake_subcategories FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Allow all for remake_subcategories" ON public.remake_subcategories;
CREATE POLICY "Allow all for remake_subcategories"
    ON public.remake_subcategories FOR ALL
    USING (true);

-- 種子
INSERT INTO public.remake_subcategories (category_key, key, name, sort_order) VALUES
('apparel_remake', 'alter', '修改尺寸／版型', 10),
('apparel_remake', 'dye', '染色／改色', 20),
('apparel_remake', 'patch', '補丁／拼布', 30),
('furniture_remake', 'repaint', '重新塗裝', 10),
('furniture_remake', 'reupholster', '重新包布', 20),
('furniture_remake', 'restore', '修復／古董翻新', 30),
('leather_care', 'clean', '清潔保養', 10),
('leather_care', 'recolor', '改色／染色', 20),
('shoes_repair', 'resole', '換底', 10),
('shoes_repair', 'stretch', '撐大／改楦', 20),
('electronics_mod', 'case', '機殼改裝', 10),
('electronics_mod', 'paint', '外觀塗裝', 20)
ON CONFLICT (category_key, key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;
