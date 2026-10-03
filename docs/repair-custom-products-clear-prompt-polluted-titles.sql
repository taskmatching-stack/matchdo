-- 一次性：清掉「把 generation_prompt 當 title 存進 DB」的舊稿污染
-- 僅影響尚未成功讀圖 enrich（semantics_generated_at IS NULL）且有成品圖的列
-- 執行：Supabase SQL Editor（或後台 migration：repair-custom-products-clear-prompt-polluted-titles）

UPDATE public.custom_products cp
SET title = ''
WHERE cp.ai_generated_image_url IS NOT NULL
  AND btrim(cp.ai_generated_image_url) <> ''
  AND cp.semantics_generated_at IS NULL
  AND cp.generation_prompt IS NOT NULL
  AND btrim(cp.generation_prompt) <> ''
  AND btrim(coalesce(cp.title, '')) <> ''
  AND (
    btrim(cp.title) = btrim(cp.generation_prompt)
    OR btrim(cp.title) = left(btrim(cp.generation_prompt), 80) || '…'
    OR (
      length(btrim(cp.title)) >= 6
      AND left(btrim(cp.generation_prompt), length(btrim(cp.title))) = btrim(cp.title)
    )
  );

-- 若已有 title_en 且與 prompt 相同，一併清空（欄位不存在時略過）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'custom_products' AND column_name = 'title_en'
  ) THEN
    UPDATE public.custom_products cp
    SET title_en = NULL
    WHERE cp.ai_generated_image_url IS NOT NULL
      AND btrim(cp.ai_generated_image_url) <> ''
      AND cp.semantics_generated_at IS NULL
      AND cp.generation_prompt IS NOT NULL
      AND btrim(cp.generation_prompt) <> ''
      AND btrim(coalesce(cp.title_en, '')) <> ''
      AND (
        btrim(cp.title_en) = btrim(cp.generation_prompt)
        OR (
          length(btrim(cp.title_en)) >= 6
          AND left(btrim(cp.generation_prompt), length(btrim(cp.title_en))) = btrim(cp.title_en)
        )
      );
  END IF;
END $$;
