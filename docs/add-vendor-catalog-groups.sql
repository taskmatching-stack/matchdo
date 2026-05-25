-- 廠商自訂分類（與網站 category_key 無關，供廠商後台整理與廠商頁／素材庫瀏覽）
-- 執行：Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.vendor_catalog_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer_id uuid NOT NULL REFERENCES public.manufacturers(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text,
    parent_id uuid REFERENCES public.vendor_catalog_groups(id) ON DELETE SET NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_catalog_groups_mfr ON public.vendor_catalog_groups(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_vendor_catalog_groups_parent ON public.vendor_catalog_groups(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_catalog_groups_mfr_slug
    ON public.vendor_catalog_groups(manufacturer_id, slug) WHERE slug IS NOT NULL AND slug <> '';

COMMENT ON TABLE public.vendor_catalog_groups IS '廠商自訂素材分類（獨立於網站訂製分類）';

CREATE TABLE IF NOT EXISTS public.vendor_asset_group_links (
    asset_id uuid NOT NULL REFERENCES public.vendor_assets(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES public.vendor_catalog_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_asset_group_links_group ON public.vendor_asset_group_links(group_id);

ALTER TABLE public.vendor_catalog_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_asset_group_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_catalog_groups_select" ON public.vendor_catalog_groups;
CREATE POLICY "vendor_catalog_groups_select" ON public.vendor_catalog_groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "vendor_asset_group_links_select" ON public.vendor_asset_group_links;
CREATE POLICY "vendor_asset_group_links_select" ON public.vendor_asset_group_links FOR SELECT USING (true);
