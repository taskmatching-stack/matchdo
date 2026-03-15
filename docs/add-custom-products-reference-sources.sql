-- 再設計：記錄引用來源（廠商素材），供產品詳情顯示「引用來源」圖與廠商連結
-- 執行後 custom_products 可存 reference_sources（JSONB 陣列）

ALTER TABLE public.custom_products
ADD COLUMN IF NOT EXISTS reference_sources JSONB DEFAULT NULL;

COMMENT ON COLUMN public.custom_products.reference_sources IS '引用來源陣列，每項: { vendor_asset_id, manufacturer_id, manufacturer_name, manufacturer_profile_url, image_url }';
