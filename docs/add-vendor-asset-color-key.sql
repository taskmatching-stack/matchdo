-- 素材庫：色彩分類（供設計端篩選；上傳時可由 AI 語意自動推導）
-- 執行：Supabase SQL Editor

ALTER TABLE public.vendor_assets
ADD COLUMN IF NOT EXISTS color_key text DEFAULT NULL;

COMMENT ON COLUMN public.vendor_assets.color_key IS '色彩 key：white|black|gray|red|blue|green|brown|beige|yellow|orange|purple|pink|gold|silver|multi|other';

CREATE INDEX IF NOT EXISTS idx_vendor_assets_color_key ON public.vendor_assets(color_key);
