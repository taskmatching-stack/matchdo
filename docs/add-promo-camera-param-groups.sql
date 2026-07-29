-- 攝影模擬：分組獨立表（底片模擬／鏡頭等 groupable 參數）
-- 已有 promo_camera_param_options 時執行（Supabase SQL Editor）

CREATE TABLE IF NOT EXISTS public.promo_camera_param_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    name_en TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category, key)
);

CREATE INDEX IF NOT EXISTS idx_promo_camera_param_groups_cat_sort
    ON public.promo_camera_param_groups (category, sort_order, key);

COMMENT ON TABLE public.promo_camera_param_groups IS '攝影模擬參數分組（後台獨立管理；options.group_id 對應）';
COMMENT ON COLUMN public.promo_camera_param_groups.category IS '對應 promo_camera_param_categories.key，如 film_simulation、lens';

ALTER TABLE public.promo_camera_param_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for promo_camera_param_groups" ON public.promo_camera_param_groups;
CREATE POLICY "Allow all for promo_camera_param_groups"
    ON public.promo_camera_param_groups FOR ALL USING (true);

ALTER TABLE public.promo_camera_param_options
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.promo_camera_param_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_promo_camera_param_options_group_id
    ON public.promo_camera_param_options (group_id);

-- 由既有 meta.group 匯入分組（中文名稱相同者合併）
INSERT INTO public.promo_camera_param_groups (category, key, name, name_en, sort_order)
SELECT DISTINCT ON (o.category, trim(o.meta->>'group'))
    o.category,
    'g_' || substr(md5(o.category || coalesce(trim(o.meta->>'group'), '')), 1, 12),
    trim(o.meta->>'group'),
    NULLIF(trim(o.meta->>'group_en'), ''),
    10
FROM public.promo_camera_param_options o
WHERE o.meta->>'group' IS NOT NULL
  AND trim(o.meta->>'group') <> ''
  AND o.category IN ('film_simulation', 'lens')
ORDER BY o.category, trim(o.meta->>'group'), o.sort_order
ON CONFLICT (category, key) DO UPDATE SET
    name = EXCLUDED.name,
    name_en = COALESCE(EXCLUDED.name_en, promo_camera_param_groups.name_en),
    updated_at = NOW();

UPDATE public.promo_camera_param_options o
SET group_id = g.id,
    updated_at = NOW()
FROM public.promo_camera_param_groups g
WHERE o.category = g.category
  AND trim(coalesce(o.meta->>'group', '')) = g.name
  AND o.group_id IS DISTINCT FROM g.id;
