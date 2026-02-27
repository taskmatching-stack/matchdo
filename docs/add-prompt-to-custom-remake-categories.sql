-- 為訂製品／再製分類與子分類表新增「提示詞」欄位（供 AI 設計輔助）
-- 執行：Supabase SQL Editor。若某表尚未建立會略過，不會報錯。

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'custom_product_categories') THEN
    ALTER TABLE public.custom_product_categories ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT '';
    COMMENT ON COLUMN public.custom_product_categories.prompt IS 'AI 設計輔助用提示詞，可含 {subcategory}';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'custom_product_subcategories') THEN
    ALTER TABLE public.custom_product_subcategories ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT '';
    COMMENT ON COLUMN public.custom_product_subcategories.prompt IS 'AI 設計輔助用提示詞，空白可繼承主分類';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'remake_categories') THEN
    ALTER TABLE public.remake_categories ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT '';
    COMMENT ON COLUMN public.remake_categories.prompt IS 'AI 設計輔助用提示詞，可含 {subcategory}';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'remake_subcategories') THEN
    ALTER TABLE public.remake_subcategories ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT '';
    COMMENT ON COLUMN public.remake_subcategories.prompt IS 'AI 設計輔助用提示詞，空白可繼承主分類';
  END IF;
END $$;
