-- 數位資產「開放廠商搜尋」開關
-- 執行：Supabase SQL Editor（可重複執行）

-- 1. 加欄位
ALTER TABLE public.custom_products
    ADD COLUMN IF NOT EXISTS open_for_manufacturing boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS manufacturing_status   text    NOT NULL DEFAULT 'open'
        CONSTRAINT custom_products_mfg_status_check
        CHECK (manufacturing_status IN ('open', 'completed', 'closed'));

COMMENT ON COLUMN public.custom_products.open_for_manufacturing IS '設計者是否開放廠商搜尋';
COMMENT ON COLUMN public.custom_products.manufacturing_status   IS 'open=開放中 / completed=已完成訂製 / closed=已關閉';

-- 2. 查詢索引
CREATE INDEX IF NOT EXISTS idx_cp_open_for_mfg
    ON public.custom_products (open_for_manufacturing, manufacturing_status)
    WHERE open_for_manufacturing = true;
