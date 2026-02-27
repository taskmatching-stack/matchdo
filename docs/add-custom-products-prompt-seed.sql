-- 客製產品：正式欄位存放「使用者輸入的提示詞」與「SEED」
-- 執行後請重啟或依需測試 API
-- 說明：不再依賴 analysis_json 存 prompt/seed，方便查詢與顯示

ALTER TABLE public.custom_products
ADD COLUMN IF NOT EXISTS generation_prompt TEXT;

ALTER TABLE public.custom_products
ADD COLUMN IF NOT EXISTS generation_seed BIGINT;

COMMENT ON COLUMN public.custom_products.generation_prompt IS '使用者輸入的生成提示詞（非系統基礎提示詞）';
COMMENT ON COLUMN public.custom_products.generation_seed IS 'FLUX 生圖時使用的 seed；NULL 表示隨機';

-- 可選：從既有 analysis_json 回填（若之前有存過）
UPDATE public.custom_products
SET
  generation_prompt = COALESCE(generation_prompt, (analysis_json->>'generation_prompt')::text),
  generation_seed = COALESCE(generation_seed, (analysis_json->>'generation_seed')::bigint)
WHERE analysis_json IS NOT NULL
  AND (generation_prompt IS NULL AND (analysis_json->>'generation_prompt') IS NOT NULL
    OR generation_seed IS NULL AND (analysis_json->>'generation_seed') IS NOT NULL);
