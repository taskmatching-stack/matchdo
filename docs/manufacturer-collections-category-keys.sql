-- 廠商資料夾：新增分類複選欄位 category_keys
-- 執行：Supabase SQL Editor
-- 前置：若尚未建立廠商資料夾表，請先執行 docs/manufacturer-collections-schema.sql
-- 廠商建立/編輯資料夾時可複選「訂製品分類」，方便客戶依分類篩選時看到對應資料夾

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manufacturer_collections'
  ) THEN
    ALTER TABLE public.manufacturer_collections
    ADD COLUMN IF NOT EXISTS category_keys text[] DEFAULT NULL;
    COMMENT ON COLUMN public.manufacturer_collections.category_keys IS '此資料夾關聯的訂製品主分類 key 陣列（可複選）；空或 NULL 表示全部分類';
    RAISE NOTICE 'manufacturer_collections.category_keys 已新增或已存在。';
  ELSE
    RAISE EXCEPTION '資料表 public.manufacturer_collections 不存在。請先執行 docs/manufacturer-collections-schema.sql 建立廠商資料夾與關聯表後，再執行本檔。';
  END IF;
END $$;
