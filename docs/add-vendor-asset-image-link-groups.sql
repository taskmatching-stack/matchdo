-- 主產品／多圖素材：連動組（同組圖片宜一起帶入生圖；跨組混選僅提醒）
-- gallery_images[].link_group：非封面圖的組代碼
-- cover_link_group：封面圖的組代碼
-- 執行：Supabase SQL Editor

ALTER TABLE public.vendor_assets
ADD COLUMN IF NOT EXISTS cover_link_group text;

COMMENT ON COLUMN public.vendor_assets.cover_link_group IS '封面圖連動組代碼；gallery 各張存於 gallery_images[].link_group；留空=不參與混選檢查';

-- gallery_images JSON 範例：
-- [{ "url": "...", "sort_order": 1, "label": "手背側", "link_group": "black" }]

NOTIFY pgrst, 'reload schema';
