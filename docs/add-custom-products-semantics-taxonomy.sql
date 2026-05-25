-- 設計圖 AI 語意：依維度分類的標籤（風格、材質、顏色…）供分析聚合
-- 需先執行 add-custom-products-semantics.sql
-- 執行：Supabase SQL Editor 或 /admin/db-migrations.html

ALTER TABLE public.custom_products
    ADD COLUMN IF NOT EXISTS ai_tags_by_dimension jsonb DEFAULT NULL;

COMMENT ON COLUMN public.custom_products.ai_tags_by_dimension IS
    '生成圖語意分維標籤，例：{ "style":[], "material":[], "color":[], "structure":[], "features":[], "patterns":[], "craftsmanship":[], "form":[], "mood":[], "use_case":[], "category":[] }';

CREATE INDEX IF NOT EXISTS idx_custom_products_tags_by_dim
    ON public.custom_products USING GIN (ai_tags_by_dimension);
