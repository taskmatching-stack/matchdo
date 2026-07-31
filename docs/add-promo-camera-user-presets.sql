-- 攝影模擬：使用者帳號攝影參數預設（跨裝置同步）
-- 執行前請確認已在 Supabase SQL Editor 執行

CREATE TABLE IF NOT EXISTS public.promo_camera_user_presets (
    id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        text        NOT NULL,
    snapshot    jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_camera_user_presets_user
    ON public.promo_camera_user_presets (user_id, updated_at DESC);

COMMENT ON TABLE public.promo_camera_user_presets IS '攝影模擬：使用者自訂參數預設（主題／場景／相機／輸出；不含產品圖）';
COMMENT ON COLUMN public.promo_camera_user_presets.snapshot IS 'toPresetSnapshot JSON（v=1）';

ALTER TABLE public.promo_camera_user_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own promo camera presets" ON public.promo_camera_user_presets;
DROP POLICY IF EXISTS "users insert own promo camera presets" ON public.promo_camera_user_presets;
DROP POLICY IF EXISTS "users delete own promo camera presets" ON public.promo_camera_user_presets;
DROP POLICY IF EXISTS "users update own promo camera presets" ON public.promo_camera_user_presets;

CREATE POLICY "users read own promo camera presets"
    ON public.promo_camera_user_presets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "users insert own promo camera presets"
    ON public.promo_camera_user_presets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own promo camera presets"
    ON public.promo_camera_user_presets FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "users update own promo camera presets"
    ON public.promo_camera_user_presets FOR UPDATE
    USING (auth.uid() = user_id);
