-- =============================================
-- 訂製品廠商作品圖表（供圖庫找廠商、從圖庫選擇、純文字搜廠商圖）
-- 執行：Supabase SQL Editor
-- 依 custom-product-design-and-manufacturer-search-plan.md §四
-- =============================================

CREATE TABLE IF NOT EXISTS public.manufacturer_portfolio (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer_id uuid NOT NULL REFERENCES public.manufacturers(id) ON DELETE CASCADE,
    title text,
    description text,
    image_url text NOT NULL,
    image_url_before text,
    design_highlight text,
    tags text[] DEFAULT '{}',
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manufacturer_portfolio_manufacturer_id ON public.manufacturer_portfolio(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_manufacturer_portfolio_sort ON public.manufacturer_portfolio(manufacturer_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_manufacturer_portfolio_tags ON public.manufacturer_portfolio USING GIN(tags);

COMMENT ON TABLE public.manufacturer_portfolio IS '廠商作品圖（圖庫找廠商、從圖庫選擇、純文字搜廠商圖用）';

ALTER TABLE public.manufacturer_portfolio ENABLE ROW LEVEL SECURITY;

-- 所有人可讀（前台圖庫、廠商卡展示）
DROP POLICY IF EXISTS "Public can view manufacturer portfolio" ON public.manufacturer_portfolio;
CREATE POLICY "Public can view manufacturer portfolio"
    ON public.manufacturer_portfolio FOR SELECT
    USING (true);

-- 已登入可寫（後台管理廠商時上傳／編輯；實際多由 service role 或後台 API 寫入）
DROP POLICY IF EXISTS "Authenticated can manage manufacturer portfolio" ON public.manufacturer_portfolio;
CREATE POLICY "Authenticated can manage manufacturer portfolio"
    ON public.manufacturer_portfolio FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
