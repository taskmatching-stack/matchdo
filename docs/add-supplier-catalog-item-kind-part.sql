-- 產業供應商目錄：允許 item_kind = part（配件／零件）
-- 錯誤 23514 supplier_catalog_items_item_kind_check → 請先執行本檔，再跑 seed STEP 4
-- 可重複執行

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'supplier_catalog_items'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%item_kind%'
    LOOP
        EXECUTE format('ALTER TABLE public.supplier_catalog_items DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE public.supplier_catalog_items
    ADD CONSTRAINT supplier_catalog_items_item_kind_check
    CHECK (item_kind IN ('prototype_set', 'material', 'part'));

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'manufacturer_supplier_imports'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%item_kind%'
    LOOP
        EXECUTE format('ALTER TABLE public.manufacturer_supplier_imports DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE public.manufacturer_supplier_imports
    ADD CONSTRAINT manufacturer_supplier_imports_item_kind_check
    CHECK (item_kind IN ('prototype_set', 'material', 'part'));

-- 驗證（應含 part）
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid = 'public.supplier_catalog_items'::regclass AND contype = 'c';
