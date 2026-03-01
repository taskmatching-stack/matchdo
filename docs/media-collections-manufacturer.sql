-- 為 media_collections（靈感牆資料夾/系列）加上廠商關聯
-- 執行：Supabase SQL Editor

-- 1. 加欄位（廠商 ID，可為 null，表示平台自建資料夾）
ALTER TABLE public.media_collections
    ADD COLUMN IF NOT EXISTS manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL;

-- 2. 加索引加速查詢
CREATE INDEX IF NOT EXISTS idx_media_collections_manufacturer_id
    ON public.media_collections(manufacturer_id);

-- 3. 說明：
--    - 廠商上傳的系列/資料夾，設定 manufacturer_id = 廠商 UUID
--    - 平台管理員自建的資料夾，manufacturer_id = NULL
--    - 已有資料夾可用以下語法更新（將 XXX 換成實際 manufacturer UUID）：
--      UPDATE public.media_collections SET manufacturer_id = 'XXX' WHERE id = 'YYY';
