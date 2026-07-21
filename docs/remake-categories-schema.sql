-- 設計風向分類（設計意圖分析；表名沿用 remake_*）
-- 供設計風向 → 設計意圖分析；前後台皆可用
-- 種子請執行 docs/seed-design-direction-categories.sql（勿用再製／改裝語意）
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

COMMENT ON TABLE public.remake_categories IS '設計風向主分類（設計意圖分析；表名沿用 remake_*）';

ALTER TABLE public.remake_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active remake categories" ON public.remake_categories;
CREATE POLICY "Anyone can view active remake categories"
    ON public.remake_categories FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Allow all for remake_categories" ON public.remake_categories;
CREATE POLICY "Allow all for remake_categories"
    ON public.remake_categories FOR ALL
    USING (true);

-- 建表後請執行 docs/seed-design-direction-categories.sql 寫入正確種子
