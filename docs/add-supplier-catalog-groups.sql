-- 產業供應商自訂分類（對稱 vendor_catalog_groups；與平台 category_key 無關）
-- 執行：Supabase SQL Editor（需已執行 add-industry-supplier-catalog.sql）

CREATE TABLE IF NOT EXISTS public.supplier_catalog_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    industry_supplier_id uuid NOT NULL REFERENCES public.industry_suppliers(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text,
    parent_id uuid REFERENCES public.supplier_catalog_groups(id) ON DELETE SET NULL,
    sort_order integer NOT NULL DEFAULT 0,
    asset_kind text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_catalog_groups_supplier ON public.supplier_catalog_groups(industry_supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_groups_parent ON public.supplier_catalog_groups(parent_id);

COMMENT ON TABLE public.supplier_catalog_groups IS '產業供應商自訂產品庫分類（獨立於網站訂製分類）';
COMMENT ON COLUMN public.supplier_catalog_groups.asset_kind IS 'prototype | material | part；NULL 視同 prototype';

CREATE TABLE IF NOT EXISTS public.supplier_catalog_item_group_links (
    catalog_item_id uuid NOT NULL REFERENCES public.supplier_catalog_items(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES public.supplier_catalog_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (catalog_item_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_catalog_item_group_links_group ON public.supplier_catalog_item_group_links(group_id);

ALTER TABLE public.supplier_catalog_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_catalog_item_group_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_catalog_groups_select" ON public.supplier_catalog_groups;
CREATE POLICY "supplier_catalog_groups_select" ON public.supplier_catalog_groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "supplier_catalog_item_group_links_select" ON public.supplier_catalog_item_group_links;
CREATE POLICY "supplier_catalog_item_group_links_select" ON public.supplier_catalog_item_group_links FOR SELECT USING (true);

GRANT ALL ON public.supplier_catalog_groups TO service_role;
GRANT ALL ON public.supplier_catalog_item_group_links TO service_role;
GRANT SELECT ON public.supplier_catalog_groups TO anon, authenticated;
GRANT SELECT ON public.supplier_catalog_item_group_links TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
