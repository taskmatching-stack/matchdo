-- 子分類：設計頁生圖 Seed 預設（留空＝隨機）
-- 執行：Supabase SQL Editor（需已有 custom_product_subcategories）

ALTER TABLE public.custom_product_subcategories
    ADD COLUMN IF NOT EXISTS default_generation_seed BIGINT NULL;

COMMENT ON COLUMN public.custom_product_subcategories.default_generation_seed IS
    '設計頁 FLUX 生圖 Seed 預設；NULL 表示 Seed 欄位留空（後端隨機）。後台子分類編輯可設定。';

-- 範例（請依實際 category_key / key 修改後取消註解）：
-- UPDATE public.custom_product_subcategories
-- SET default_generation_seed = 9322222, updated_at = NOW()
-- WHERE category_key = 'your_main_key' AND key = 'your_sub_key';
