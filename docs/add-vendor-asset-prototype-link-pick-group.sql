-- 主產品關聯：訂製者「擇一組」設定（規劃；後台 UI 與 guide 邏輯待接）
-- 同 prototype 下，pick_group 相同者訂製者只能選一筆；NULL = 可與其他關聯並選

ALTER TABLE public.vendor_asset_prototype_links
    ADD COLUMN IF NOT EXISTS pick_group text;

COMMENT ON COLUMN public.vendor_asset_prototype_links.pick_group IS
    '擇一組代碼：同主產品下同組僅能選一筆帶入設計；NULL=可複選';

NOTIFY pgrst, 'reload schema';
