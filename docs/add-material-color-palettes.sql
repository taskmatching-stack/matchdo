-- 材料組合：雙色配色範例（官方＋使用者偏好；三色欄位預留）
-- 執行：Supabase SQL Editor 或後台「資料庫維護」

CREATE TABLE IF NOT EXISTS public.material_color_palette_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.material_color_palette_types IS '材料組合官方配色範例的類型字典（管理區維護）';

CREATE TABLE IF NOT EXISTS public.material_color_palettes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_scope TEXT NOT NULL CHECK (owner_scope IN ('platform', 'user')),
    owner_user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
    type_id UUID REFERENCES public.material_color_palette_types (id) ON DELETE SET NULL,
    type_text TEXT,
    name TEXT NOT NULL,
    color_count INTEGER NOT NULL DEFAULT 2,
    primary_hex TEXT NOT NULL,
    accent_hex TEXT NOT NULL,
    tertiary_hex TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT material_color_palettes_platform_chk CHECK (
        (owner_scope = 'platform' AND owner_user_id IS NULL AND type_id IS NOT NULL)
        OR (owner_scope = 'user' AND owner_user_id IS NOT NULL AND type_id IS NULL)
    )
);

COMMENT ON TABLE public.material_color_palettes IS '材料組合配色範例：platform=官方；user=帳號共用偏好';
COMMENT ON COLUMN public.material_color_palettes.type_text IS '使用者自建類型（自由字、可空）；官方列用 type_id';
COMMENT ON COLUMN public.material_color_palettes.tertiary_hex IS '三色預留；目前 UI 不使用';

CREATE INDEX IF NOT EXISTS idx_mcp_types_active_sort
    ON public.material_color_palette_types (is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_mcp_platform_type
    ON public.material_color_palettes (owner_scope, type_id, is_active, sort_order)
    WHERE owner_scope = 'platform';

CREATE INDEX IF NOT EXISTS idx_mcp_user_owner
    ON public.material_color_palettes (owner_user_id, is_active, sort_order)
    WHERE owner_scope = 'user';
