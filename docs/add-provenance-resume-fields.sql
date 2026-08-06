-- 生圖履歷 P3：扣點 FK、完整 FLUX prompt、衍生鏈、生圖 meta

ALTER TABLE public.custom_products
    ADD COLUMN IF NOT EXISTS credit_transaction_id uuid,
    ADD COLUMN IF NOT EXISTS composed_flux_prompt text,
    ADD COLUMN IF NOT EXISTS generation_meta_json jsonb,
    ADD COLUMN IF NOT EXISTS parent_record_kind text,
    ADD COLUMN IF NOT EXISTS parent_record_id uuid;

COMMENT ON COLUMN public.custom_products.credit_transaction_id IS '生圖扣點 credit_transactions.id';
COMMENT ON COLUMN public.custom_products.composed_flux_prompt IS '送 FLUX 的完整 composed prompt（含參考附錄）';
COMMENT ON COLUMN public.custom_products.generation_meta_json IS '生圖 meta（模型、參考數等，供履歷）';
COMMENT ON COLUMN public.custom_products.parent_record_kind IS '衍生來源 kind：user_design|promo_scene|print|material_combo 等';
COMMENT ON COLUMN public.custom_products.parent_record_id IS '衍生來源 record id';

CREATE INDEX IF NOT EXISTS idx_custom_products_credit_tx
    ON public.custom_products (credit_transaction_id)
    WHERE credit_transaction_id IS NOT NULL;

ALTER TABLE public.product_promo_generations
    ADD COLUMN IF NOT EXISTS credit_transaction_id uuid,
    ADD COLUMN IF NOT EXISTS generation_meta_json jsonb,
    ADD COLUMN IF NOT EXISTS parent_record_kind text,
    ADD COLUMN IF NOT EXISTS parent_record_id uuid;

COMMENT ON COLUMN public.product_promo_generations.credit_transaction_id IS '情境圖扣點 credit_transactions.id';
COMMENT ON COLUMN public.product_promo_generations.generation_meta_json IS '生圖 meta（final_prompt 已在 final_prompt 欄）';
COMMENT ON COLUMN public.product_promo_generations.parent_record_kind IS '衍生來源 kind';
COMMENT ON COLUMN public.product_promo_generations.parent_record_id IS '衍生來源 record id';

CREATE INDEX IF NOT EXISTS idx_promo_gen_credit_tx
    ON public.product_promo_generations (credit_transaction_id)
    WHERE credit_transaction_id IS NOT NULL;
