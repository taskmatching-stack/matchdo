-- 產業供應商目錄：支援 item_kind = part（配件／零件）
-- 若 seed 插入 part 失敗，請先執行本檔，再跑 seed-industry-supplier-materials.sql

ALTER TABLE public.supplier_catalog_items
    DROP CONSTRAINT IF EXISTS supplier_catalog_items_item_kind_check;

ALTER TABLE public.supplier_catalog_items
    ADD CONSTRAINT supplier_catalog_items_item_kind_check
    CHECK (item_kind IN ('prototype_set', 'material', 'part'));

ALTER TABLE public.manufacturer_supplier_imports
    DROP CONSTRAINT IF EXISTS manufacturer_supplier_imports_item_kind_check;

ALTER TABLE public.manufacturer_supplier_imports
    ADD CONSTRAINT manufacturer_supplier_imports_item_kind_check
    CHECK (item_kind IN ('prototype_set', 'material', 'part'));
