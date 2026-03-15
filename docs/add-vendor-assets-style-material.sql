-- 素材庫：造型與材質分類，方便素材池篩選（避免只看見一堆同類圖）
-- 執行：Supabase SQL Editor

ALTER TABLE public.vendor_assets
ADD COLUMN IF NOT EXISTS style_key text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS material_key text DEFAULT NULL;

COMMENT ON COLUMN public.vendor_assets.style_key IS '造型分類：silhouette, accessories, furniture, bags, shoes, other';
COMMENT ON COLUMN public.vendor_assets.material_key IS '材質分類：fabric, leather, metal, wood, plastic, ceramic, other';

CREATE INDEX IF NOT EXISTS idx_vendor_assets_style_key ON public.vendor_assets(style_key);
CREATE INDEX IF NOT EXISTS idx_vendor_assets_material_key ON public.vendor_assets(material_key);
