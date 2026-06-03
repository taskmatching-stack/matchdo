-- 主產品（prototype）↔ 材料／配件（material | part）多對多關聯
-- 僅一層；不支援材料下再掛配件。執行：Supabase SQL Editor（需已有 vendor_assets、manufacturers）

CREATE TABLE IF NOT EXISTS public.vendor_asset_prototype_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer_id uuid NOT NULL REFERENCES public.manufacturers(id) ON DELETE CASCADE,
    prototype_asset_id uuid NOT NULL REFERENCES public.vendor_assets(id) ON DELETE CASCADE,
    linked_asset_id uuid NOT NULL REFERENCES public.vendor_assets(id) ON DELETE CASCADE,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT vendor_asset_prototype_links_unique UNIQUE (prototype_asset_id, linked_asset_id),
    CONSTRAINT vendor_asset_prototype_links_no_self CHECK (prototype_asset_id <> linked_asset_id)
);

CREATE INDEX IF NOT EXISTS idx_vapl_prototype ON public.vendor_asset_prototype_links(prototype_asset_id);
CREATE INDEX IF NOT EXISTS idx_vapl_linked ON public.vendor_asset_prototype_links(linked_asset_id);
CREATE INDEX IF NOT EXISTS idx_vapl_manufacturer ON public.vendor_asset_prototype_links(manufacturer_id);

COMMENT ON TABLE public.vendor_asset_prototype_links IS '主產品與材料／配件一層關聯；非 catalog 分類樹';
COMMENT ON COLUMN public.vendor_asset_prototype_links.sort_order IS '同一主產品下推薦排序（設計端列表優先）';

ALTER TABLE public.vendor_asset_prototype_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_asset_prototype_links_select" ON public.vendor_asset_prototype_links;
CREATE POLICY "vendor_asset_prototype_links_select" ON public.vendor_asset_prototype_links FOR SELECT USING (true);

GRANT ALL ON public.vendor_asset_prototype_links TO service_role;
GRANT SELECT ON public.vendor_asset_prototype_links TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
