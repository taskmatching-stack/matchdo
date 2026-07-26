-- FLUX 內容審核敏感度（BFL safety_tolerance 0–6；NULL＝使用預設 2）
-- 僅後台管理，前台不顯示。執行後至「分類管理」「情境圖主題／場景」設定。
--
-- 若出現 relation "ai_categories" does not exist：本檔會先建立分類表再 ADD COLUMN。
-- 建表後若分類列表為空，請至後台「分類管理」→「一鍵匯入（保留現有提示詞）」。

-- ── 1) 主分類表（現行架構：主分類在 ai_categories，子分類在 ai_subcategories）──
CREATE TABLE IF NOT EXISTS public.ai_categories (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_categories ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ai_categories ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
ALTER TABLE public.ai_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── 2) 子分類表 ──
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

ALTER TABLE public.ai_subcategories ADD COLUMN IF NOT EXISTS form_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.ai_subcategories ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- ── 3) FLUX 審核欄位 ──
ALTER TABLE public.ai_categories
  ADD COLUMN IF NOT EXISTS flux_safety_tolerance smallint
  CHECK (flux_safety_tolerance IS NULL OR (flux_safety_tolerance >= 0 AND flux_safety_tolerance <= 6));

ALTER TABLE public.ai_subcategories
  ADD COLUMN IF NOT EXISTS flux_safety_tolerance smallint
  CHECK (flux_safety_tolerance IS NULL OR (flux_safety_tolerance >= 0 AND flux_safety_tolerance <= 6));

-- promo_scene_templates 可能尚未建立（請另執行 docs/add-product-promo-image.sql）
DO $promo$
BEGIN
    IF to_regclass('public.promo_scene_templates') IS NOT NULL THEN
        ALTER TABLE public.promo_scene_templates
          ADD COLUMN IF NOT EXISTS flux_safety_tolerance smallint
          CHECK (flux_safety_tolerance IS NULL OR (flux_safety_tolerance >= 0 AND flux_safety_tolerance <= 6));
    ELSE
        RAISE NOTICE '略過 promo_scene_templates（表不存在；請先執行 docs/add-product-promo-image.sql）';
    END IF;
END $promo$;

COMMENT ON COLUMN public.ai_categories.flux_safety_tolerance IS 'BFL FLUX safety_tolerance override; NULL=default 2';
COMMENT ON COLUMN public.ai_subcategories.flux_safety_tolerance IS 'BFL FLUX safety_tolerance override; NULL=default 2';

DO $cmt$
BEGIN
    IF to_regclass('public.promo_scene_templates') IS NOT NULL THEN
        EXECUTE $sql$COMMENT ON COLUMN public.promo_scene_templates.flux_safety_tolerance IS 'BFL FLUX safety_tolerance override; NULL=default 2'$sql$;
    END IF;
END $cmt$;

-- ── 4) 自查 ──
SELECT 'ai_categories' AS tbl, to_regclass('public.ai_categories') IS NOT NULL AS exists,
       (SELECT COUNT(*)::int FROM public.ai_categories) AS row_count
UNION ALL
SELECT 'ai_subcategories', to_regclass('public.ai_subcategories') IS NOT NULL,
       (SELECT COUNT(*)::int FROM public.ai_subcategories)
UNION ALL
SELECT 'promo_scene_templates', to_regclass('public.promo_scene_templates') IS NOT NULL,
       CASE WHEN to_regclass('public.promo_scene_templates') IS NOT NULL
            THEN (SELECT COUNT(*)::int FROM public.promo_scene_templates) ELSE NULL END;
