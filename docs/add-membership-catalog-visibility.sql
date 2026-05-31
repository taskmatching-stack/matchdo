-- 會員降為免費時自動下架素材／供應商目錄；升級付費後還原（見 server.js syncMembershipCatalogVisibility）
-- 執行：Supabase SQL Editor

ALTER TABLE public.vendor_assets
ADD COLUMN IF NOT EXISTS public_hidden_by_membership boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vendor_assets.public_hidden_by_membership IS
  '因帳號降為免費會員而自動下架；升級付費後還原 is_public=true';

ALTER TABLE public.supplier_catalog_items
ADD COLUMN IF NOT EXISTS catalog_hidden_by_membership boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.supplier_catalog_items.catalog_hidden_by_membership IS
  '因產業供應商帳號降為免費而自動停用；升級付費後還原 is_active=true';

ALTER TABLE public.industry_suppliers
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_industry_suppliers_user_id ON public.industry_suppliers(user_id);
