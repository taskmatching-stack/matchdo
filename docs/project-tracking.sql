-- 專案進度追蹤：對話連結設計資產 + 統計視圖
-- 執行：Supabase SQL Editor（可重複執行）

-- 1. direct_conversations 加 product_id（連結到哪個設計資產）
ALTER TABLE public.direct_conversations
    ADD COLUMN IF NOT EXISTS product_id uuid
        REFERENCES public.custom_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dc_product_id ON public.direct_conversations(product_id);

COMMENT ON COLUMN public.direct_conversations.product_id IS '對應的設計資產 ID（由廠商從需求頁聯絡時自動帶入）';

-- 2. 設計者專案統計視圖
CREATE OR REPLACE VIEW public.designer_project_stats AS
SELECT
    cp.id,
    cp.owner_id,
    cp.title,
    cp.manufacturing_status,                -- open / completed / closed
    cp.open_for_manufacturing,
    cp.created_at,
    COUNT(DISTINCT dc.id)          AS contact_count,  -- 已聯絡廠商數
    MAX(dc.updated_at)             AS last_contact_at
FROM public.custom_products cp
LEFT JOIN public.direct_conversations dc ON dc.product_id = cp.id
GROUP BY cp.id;

-- 3. 廠商端視圖：我接觸過哪些設計（由廠商的 user_id 過濾）
CREATE OR REPLACE VIEW public.maker_project_contacts AS
SELECT
    dc.id            AS conversation_id,
    dc.product_id,
    dc.updated_at,
    CASE WHEN dc.user_a_id = cp.owner_id THEN dc.user_b_id
         ELSE dc.user_a_id END      AS maker_id,   -- 廠商 user_id
    cp.title         AS product_title,
    cp.manufacturing_status,
    cp.owner_id      AS designer_id
FROM public.direct_conversations dc
JOIN public.custom_products cp ON cp.id = dc.product_id;
