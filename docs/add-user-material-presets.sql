-- 材料組合：使用者常用文字（材質、分界處；僅方便選取）
-- 執行：Supabase SQL Editor 或後台「資料庫維護」

CREATE TABLE IF NOT EXISTS public.user_material_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'material',
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_material_presets_kind_chk CHECK (kind IN ('material', 'boundary')),
    CONSTRAINT user_material_presets_name_len CHECK (char_length(name) >= 1 AND char_length(name) <= 64)
);

COMMENT ON TABLE public.user_material_presets IS '材料組合：帳號常用文字（材質／分界處；手打存檔、點選填入）';
COMMENT ON COLUMN public.user_material_presets.kind IS 'material=材質；boundary=分界處';

ALTER TABLE public.user_material_presets
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'material';

ALTER TABLE public.user_material_presets
    DROP CONSTRAINT IF EXISTS user_material_presets_kind_chk;
ALTER TABLE public.user_material_presets
    ADD CONSTRAINT user_material_presets_kind_chk CHECK (kind IN ('material', 'boundary'));

DROP INDEX IF EXISTS public.idx_user_material_presets_user_name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_material_presets_user_kind_name
    ON public.user_material_presets (user_id, kind, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_user_material_presets_user_sort
    ON public.user_material_presets (user_id, kind, sort_order, created_at DESC);
