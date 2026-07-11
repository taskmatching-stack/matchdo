-- 數位版型／多圖素材：封面是否可供設計者選入 AI
-- gallery_images[].designer_selectable：非封面（預設 true；false=僅展示不可選）
-- cover_designer_selectable：封面（預設 true）
-- 執行：Supabase SQL Editor

ALTER TABLE public.vendor_assets
ADD COLUMN IF NOT EXISTS cover_designer_selectable boolean DEFAULT true;

COMMENT ON COLUMN public.vendor_assets.cover_designer_selectable IS
  '封面圖是否可供設計者選入 AI；false=僅展示。gallery 各張存於 gallery_images[].designer_selectable';

-- gallery_images JSON 範例：
-- [{ "url": "...", "sort_order": 1, "label": "情境照", "designer_selectable": false }]

NOTIFY pgrst, 'reload schema';
