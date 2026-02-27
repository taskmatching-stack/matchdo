-- ========================================
-- 子分類獨立表：ai_subcategories
-- 將子分類從 ai_categories 獨立出來，方便後續開發與查詢
-- ========================================
-- 執行前請確認：ai_categories 已存在，且主分類為 parent_key IS NULL 的資料列
-- 若目前子分類仍在 ai_categories（parent_key 不為空），請先執行 docs/migrate-categories-split.sql

-- 1. 建立子分類表
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

-- 2. 索引
CREATE INDEX IF NOT EXISTS idx_ai_subcategories_category_key ON public.ai_subcategories(category_key);
CREATE INDEX IF NOT EXISTS idx_ai_subcategories_sort ON public.ai_subcategories(category_key, sort_order);

-- 3. 註解
COMMENT ON TABLE public.ai_subcategories IS '子分類（獨立於主分類表，便於 CRUD 與擴充）';
COMMENT ON COLUMN public.ai_subcategories.key IS '唯一鍵，建議格式：主分類key__子分類英文或代碼，例：wedding__photography';
COMMENT ON COLUMN public.ai_subcategories.category_key IS '所屬主分類的 key，對應 ai_categories.key';
COMMENT ON COLUMN public.ai_subcategories.form_config IS '表單設定（動態欄位等），供管理後台使用';

-- 4. RLS
ALTER TABLE public.ai_subcategories ENABLE ROW LEVEL SECURITY;

-- 所有人可讀
CREATE POLICY "子分類公開可讀"
    ON public.ai_subcategories
    FOR SELECT
    USING (true);

-- 僅管理員可寫
CREATE POLICY "管理員可管理子分類"
    ON public.ai_subcategories
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 5. 觸發更新 updated_at（若專案有該函數可共用）
DO $outer$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'set_updated_at') THEN
        CREATE OR REPLACE FUNCTION public.set_updated_at()
        RETURNS TRIGGER AS $body$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $body$ LANGUAGE plpgsql;
    END IF;
END $outer$;

DROP TRIGGER IF EXISTS ai_subcategories_updated_at ON public.ai_subcategories;
CREATE TRIGGER ai_subcategories_updated_at
    BEFORE UPDATE ON public.ai_subcategories
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_updated_at();
