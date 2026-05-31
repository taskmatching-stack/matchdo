-- 產業供應商目錄（B 線）+ 製造商導入紀錄
-- 執行：Supabase SQL Editor 或管理後台 migration

CREATE TABLE IF NOT EXISTS public.industry_suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    contact_json jsonb DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_catalog_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    industry_supplier_id uuid NOT NULL REFERENCES public.industry_suppliers(id) ON DELETE CASCADE,
    item_kind text NOT NULL CHECK (item_kind IN ('prototype_set', 'material', 'part')),
    title text NOT NULL,
    description text,
    cover_image_url text,
    spec_json jsonb DEFAULT '{}'::jsonb,
    category_key text,
    is_active boolean NOT NULL DEFAULT true,
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_catalog_items_kind ON public.supplier_catalog_items(item_kind);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_items_supplier ON public.supplier_catalog_items(industry_supplier_id);

CREATE TABLE IF NOT EXISTS public.manufacturer_supplier_imports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer_id uuid NOT NULL REFERENCES public.manufacturers(id) ON DELETE CASCADE,
    catalog_item_id uuid NOT NULL REFERENCES public.supplier_catalog_items(id) ON DELETE CASCADE,
    item_kind text NOT NULL CHECK (item_kind IN ('prototype_set', 'material', 'part')),
    vendor_asset_id uuid REFERENCES public.vendor_assets(id) ON DELETE SET NULL,
    snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    notes text,
    imported_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (manufacturer_id, catalog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_mfr_supplier_imports_mfr ON public.manufacturer_supplier_imports(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_mfr_supplier_imports_kind ON public.manufacturer_supplier_imports(item_kind);

-- 導入來源（可選，方便 vendor_assets 追溯）
ALTER TABLE public.vendor_assets
ADD COLUMN IF NOT EXISTS source_catalog_item_id uuid REFERENCES public.supplier_catalog_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_assets_source_catalog ON public.vendor_assets(source_catalog_item_id);
