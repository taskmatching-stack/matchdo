-- 主產品關聯：訂製者選圖規則（看可搭配 / 設計帶入）
-- allow_multi_pick=false：與其他「不可並選」關聯互斥（擇一槽）
-- pick_group：同主產品下同組代碼僅能選一筆；NULL 且 allow_multi_pick=true 可複選

ALTER TABLE public.vendor_asset_prototype_links
    ADD COLUMN IF NOT EXISTS allow_multi_pick boolean NOT NULL DEFAULT true;

ALTER TABLE public.vendor_asset_prototype_links
    ADD COLUMN IF NOT EXISTS pick_group text;

COMMENT ON COLUMN public.vendor_asset_prototype_links.allow_multi_pick IS
    'true=可與其他關聯並選；false=與其他 allow_multi_pick=false 互斥';

COMMENT ON COLUMN public.vendor_asset_prototype_links.pick_group IS
    '擇一組代碼：同主產品下同組僅能選一筆；NULL=依 allow_multi_pick';

NOTIFY pgrst, 'reload schema';
