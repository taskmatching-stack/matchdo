-- =============================================
-- 廠商作品圖表：一次建立（含作品重點、第二張圖欄位）
-- 執行：Supabase SQL Editor（整份複製貼上執行）
-- 前置：需先有 public.manufacturers 表（見 docs/custom-products-schema.sql）
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

COMMENT ON TABLE public.manufacturer_portfolio IS '訂製品廠商作品圖（圖庫找廠商、從圖庫選擇、純文字搜廠商圖用）';
COMMENT ON COLUMN public.manufacturer_portfolio.design_highlight IS '作品重點說明（圖庫與詳情顯示）';
COMMENT ON COLUMN public.manufacturer_portfolio.image_url_before IS '第二張圖片 URL（選填）';

ALTER TABLE public.manufacturer_portfolio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view manufacturer portfolio" ON public.manufacturer_portfolio;
CREATE POLICY "Public can view manufacturer portfolio"
    ON public.manufacturer_portfolio FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated can manage manufacturer portfolio" ON public.manufacturer_portfolio;
CREATE POLICY "Authenticated can manage manufacturer portfolio"
    ON public.manufacturer_portfolio FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
