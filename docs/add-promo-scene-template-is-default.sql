-- 情境圖／人像主題：可標記預設（同 audience 僅一筆）
-- 執行：Supabase SQL Editor 或後台「資料庫維護」

ALTER TABLE public.promo_scene_templates
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.promo_scene_templates.is_default IS
    '主題預設值：同一 audience（product / portrait）僅一筆為 true；場景 slot=scene 不使用';

CREATE INDEX IF NOT EXISTS idx_promo_scene_templates_default_audience
    ON public.promo_scene_templates (slot, audience, is_default)
    WHERE slot = 'theme' AND is_default = TRUE;
