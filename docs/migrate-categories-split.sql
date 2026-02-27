-- ========================================
-- 遷移：將子分類從 ai_categories 獨立到 ai_subcategories
-- 執行前請備份資料。執行後 ai_categories 僅保留主分類，子分類移至 ai_subcategories。
-- ========================================

-- 步驟 1：建立 ai_subcategories 表（若尚未建立，可先執行 ai-subcategories-schema.sql）
CREATE TABLE IF NOT EXISTS public.ai_subcategories (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category_key TEXT NOT NULL REFERENCES public.ai_categories(key) ON DELETE CASCADE,
    prompt TEXT DEFAULT '',
    image_url TEXT,
    form_config JSONB DEFAULT '{}'::jsonb,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_subcategories_category_key ON public.ai_subcategories(category_key);
CREATE INDEX IF NOT EXISTS idx_ai_subcategories_sort ON public.ai_subcategories(category_key, sort_order);

ALTER TABLE public.ai_subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "子分類公開可讀" ON public.ai_subcategories;
CREATE POLICY "子分類公開可讀" ON public.ai_subcategories FOR SELECT USING (true);

DROP POLICY IF EXISTS "管理員可管理子分類" ON public.ai_subcategories;
CREATE POLICY "管理員可管理子分類" ON public.ai_subcategories FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- 步驟 2：將現有「子分類資料列」搬進 ai_subcategories
-- （目前結構：ai_categories 中 parent_key IS NOT NULL 的列為子分類）
INSERT INTO public.ai_subcategories (key, name, category_key, prompt, image_url, sort_order, updated_at)
SELECT 
    c.key,
    c.name,
    c.parent_key,
    COALESCE(c.prompt, ''),
    c.image_url,
    ROW_NUMBER() OVER (PARTITION BY c.parent_key ORDER BY c.name)::INT - 1,
    COALESCE(c.updated_at, NOW())
FROM public.ai_categories c
WHERE c.parent_key IS NOT NULL
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    category_key = EXCLUDED.category_key,
    prompt = EXCLUDED.prompt,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    updated_at = EXCLUDED.updated_at;

-- 步驟 3：若沒有「子分類資料列」、但主分類有 subcategories jsonb，則從 jsonb 展開寫入 ai_subcategories
DO $$
DECLARE
    parent_rec RECORD;
    sub_name TEXT;
    sub_key TEXT;
    ord INT;
BEGIN
    FOR parent_rec IN 
        SELECT key, name, subcategories 
        FROM public.ai_categories 
        WHERE parent_key IS NULL 
          AND subcategories IS NOT NULL 
          AND jsonb_typeof(subcategories) = 'array'
          AND jsonb_array_length(subcategories) > 0
    LOOP
        ord := 0;
        FOR sub_name IN 
            SELECT jsonb_array_elements_text(parent_rec.subcategories)
        LOOP
            sub_key := parent_rec.key || '__' || regexp_replace(trim(sub_name), '\s+', '_', 'g');
            IF length(sub_key) > 200 THEN
                sub_key := parent_rec.key || '__sub_' || ord;
            END IF;
            INSERT INTO public.ai_subcategories (key, name, category_key, sort_order)
            VALUES (sub_key, sub_name, parent_rec.key, ord)
            ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;
            ord := ord + 1;
        END LOOP;
    END LOOP;
END $$;

-- 步驟 4：刪除 ai_categories 中的子分類資料列
DELETE FROM public.ai_categories WHERE parent_key IS NOT NULL;

-- 步驟 5：從 ai_categories 移除子分類相關欄位
ALTER TABLE public.ai_categories DROP COLUMN IF EXISTS subcategories;
ALTER TABLE public.ai_categories DROP COLUMN IF EXISTS parent_key;

-- 步驟 6：確保主分類表有 updated_at（若沒有則加上）
ALTER TABLE public.ai_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 驗證
SELECT '主分類數量' AS "項目", COUNT(*)::TEXT AS "值" FROM public.ai_categories
UNION ALL
SELECT '子分類數量', COUNT(*)::TEXT FROM public.ai_subcategories;

SELECT c.key AS "主分類key", c.name AS "主分類名稱", 
       (SELECT COUNT(*) FROM public.ai_subcategories s WHERE s.category_key = c.key) AS "子分類數"
FROM public.ai_categories c
ORDER BY c.name;
