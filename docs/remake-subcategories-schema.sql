-- 設計風向子分類（隸屬 remake_categories；表名沿用 remake_*）
-- 執行：Supabase SQL Editor（請先執行 remake-categories-schema.sql）
-- 種子請執行 docs/seed-design-direction-categories.sql

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

COMMENT ON TABLE public.remake_subcategories IS '設計風向子分類（具體品類；表名沿用 remake_*）';

ALTER TABLE public.remake_subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active remake subcategories" ON public.remake_subcategories;
CREATE POLICY "Anyone can view active remake subcategories"
    ON public.remake_subcategories FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Allow all for remake_subcategories" ON public.remake_subcategories;
CREATE POLICY "Allow all for remake_subcategories"
    ON public.remake_subcategories FOR ALL
    USING (true);

-- 建表後請執行 docs/seed-design-direction-categories.sql 寫入正確種子
