-- 看可搭配：主產品層級「配件可複選」（取代每筆關聯的 allow_multi_pick / pick_group 給廠商設定）
ALTER TABLE public.vendor_assets
    ADD COLUMN IF NOT EXISTS guide_links_multi_pick boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.vendor_assets.guide_links_multi_pick IS
    '僅 prototype：看可搭配頁訂製者能否複選配件；false=配件僅能選一筆。材料前台仍固定僅能選一筆。';
