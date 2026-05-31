-- 會員「付費→免費」時僅下架廠商本人上傳且已上架之素材；升級付費後還原標記列
-- 不影響：種子廠商、平台代管、管理員後台上傳（platform_managed=true）
-- 執行：Supabase SQL Editor

ALTER TABLE public.vendor_assets
ADD COLUMN IF NOT EXISTS public_hidden_by_membership boolean NOT NULL DEFAULT false;

ALTER TABLE public.vendor_assets
ADD COLUMN IF NOT EXISTS platform_managed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vendor_assets.public_hidden_by_membership IS
  '因帳號由付費降為免費而自動下架；升級付費後僅還原此標記列';
COMMENT ON COLUMN public.vendor_assets.platform_managed IS
  '管理員／平台代傳素材，不因會員降免費而自動下架';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS membership_catalog_tier text;

COMMENT ON COLUMN public.profiles.membership_catalog_tier IS
  'paid|free，用於偵測付費↔免費轉換；非每次登入掃描';

ALTER TABLE public.industry_suppliers
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_industry_suppliers_user_id ON public.industry_suppliers(user_id);

-- 標記既有管理員／種子廠商素材為平台代管（避免曾被誤下架後無法靠升級還原）
UPDATE public.vendor_assets va
SET platform_managed = true,
    public_hidden_by_membership = false,
    is_public = true
FROM public.manufacturers m
WHERE va.manufacturer_id = m.id
  AND (m.vendor_source = 'seed' OR m.vendor_source = 'platform');

-- 若曾誤下架且無會員標記，可手動還原種子廠商上架狀態（依實際 is_public 需求調整）
-- UPDATE public.vendor_assets va SET is_public = true, public_hidden_by_membership = false
-- FROM public.manufacturers m WHERE va.manufacturer_id = m.id AND m.vendor_source = 'seed';
