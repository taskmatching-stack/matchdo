-- =============================================
-- 廠商資料夾（系列）與資料夾內作品關聯
-- 執行：Supabase SQL Editor
-- 廠商可在「我的廠商作品」建立資料夾、將作品加入資料夾
-- =============================================

-- 廠商資料夾（一個廠商可有多個資料夾）
CREATE TABLE IF NOT EXISTS public.manufacturer_collections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer_id uuid NOT NULL REFERENCES public.manufacturers(id) ON DELETE CASCADE,
    title text NOT NULL,
    slug text,
    cover_image_url text,
    description text,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manufacturer_collections_manufacturer_id ON public.manufacturer_collections(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_manufacturer_collections_sort ON public.manufacturer_collections(manufacturer_id, sort_order);

COMMENT ON TABLE public.manufacturer_collections IS '廠商自建資料夾（系列），用於整理作品集';

ALTER TABLE public.manufacturer_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view manufacturer collections" ON public.manufacturer_collections;
CREATE POLICY "Public can view manufacturer collections"
    ON public.manufacturer_collections FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated can manage own manufacturer collections" ON public.manufacturer_collections;
CREATE POLICY "Authenticated can manage own manufacturer collections"
    ON public.manufacturer_collections FOR ALL
    USING (
        manufacturer_id IN (
            SELECT id FROM public.manufacturers WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        manufacturer_id IN (
            SELECT id FROM public.manufacturers WHERE user_id = auth.uid()
        )
    );

-- 資料夾內作品（多對多：一筆作品可屬於多個資料夾）
CREATE TABLE IF NOT EXISTS public.manufacturer_collection_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id uuid NOT NULL REFERENCES public.manufacturer_collections(id) ON DELETE CASCADE,
    portfolio_id uuid NOT NULL REFERENCES public.manufacturer_portfolio(id) ON DELETE CASCADE,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(collection_id, portfolio_id)
);

CREATE INDEX IF NOT EXISTS idx_manufacturer_collection_items_collection_id ON public.manufacturer_collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_manufacturer_collection_items_portfolio_id ON public.manufacturer_collection_items(portfolio_id);

COMMENT ON TABLE public.manufacturer_collection_items IS '廠商資料夾內的作品關聯';

ALTER TABLE public.manufacturer_collection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view manufacturer collection items" ON public.manufacturer_collection_items;
CREATE POLICY "Public can view manufacturer collection items"
    ON public.manufacturer_collection_items FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated can manage own manufacturer collection items" ON public.manufacturer_collection_items;
CREATE POLICY "Authenticated can manage own manufacturer collection items"
    ON public.manufacturer_collection_items FOR ALL
    USING (
        collection_id IN (
            SELECT c.id FROM public.manufacturer_collections c
            JOIN public.manufacturers m ON m.id = c.manufacturer_id
            WHERE m.user_id = auth.uid()
        )
    )
    WITH CHECK (
        collection_id IN (
            SELECT c.id FROM public.manufacturer_collections c
            JOIN public.manufacturers m ON m.id = c.manufacturer_id
            WHERE m.user_id = auth.uid()
        )
    );
