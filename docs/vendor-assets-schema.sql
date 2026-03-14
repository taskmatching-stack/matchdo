-- =============================================
-- 廠商素材庫（設計端參考圖來源，依設計當下分類載入；必顯示廠商名稱與連結）
-- 規格：docs/設計與開店路徑-廠商素材庫規格.md
-- 執行：Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS public.vendor_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer_id uuid NOT NULL REFERENCES public.manufacturers(id) ON DELETE CASCADE,
    category_key text NOT NULL,
    subcategory_key text,
    title text,
    description text,
    image_url text NOT NULL,
    usage_type text DEFAULT 'reference_only',
    is_public boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_assets_manufacturer_id ON public.vendor_assets(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_vendor_assets_category ON public.vendor_assets(category_key);
CREATE INDEX IF NOT EXISTS idx_vendor_assets_category_sub ON public.vendor_assets(category_key, subcategory_key);
CREATE INDEX IF NOT EXISTS idx_vendor_assets_sort ON public.vendor_assets(manufacturer_id, sort_order);

COMMENT ON TABLE public.vendor_assets IS '廠商素材庫：廠商上傳供設計者當參考圖的造型/結構/材質圖；設計端依 category_key 載入並顯示廠商名稱與連結';

ALTER TABLE public.vendor_assets ENABLE ROW LEVEL SECURITY;

-- 所有人可讀（設計端選圖、圖庫；篩選由 API 做）
DROP POLICY IF EXISTS "Public can view vendor assets" ON public.vendor_assets;
CREATE POLICY "Public can view vendor assets"
    ON public.vendor_assets FOR SELECT
    USING (true);

-- 已登入可寫（實際由後端 API 以 service role 或依 manufacturer_id 權限寫入）
DROP POLICY IF EXISTS "Authenticated can manage vendor assets" ON public.vendor_assets;
CREATE POLICY "Authenticated can manage vendor assets"
    ON public.vendor_assets FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
