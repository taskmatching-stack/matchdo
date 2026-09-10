-- 情境圖／人像主題：可標記預設（同 audience 僅一筆）
-- 執行：Supabase SQL Editor 或後台「資料庫維護」／情境圖主題頁「套用預設欄位」

ALTER TABLE public.promo_scene_templates
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.promo_scene_templates.is_default IS
    '主題預設值：同一 audience（product / portrait）僅一筆為 true；場景 slot=scene 不使用';

-- audience 欄位可能尚未建立（需先跑 add-promo-shoot-modes.sql）；索引僅在 audience 存在時建立
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'promo_scene_templates'
          AND column_name = 'audience'
    ) THEN
        EXECUTE $idx$
            CREATE INDEX IF NOT EXISTS idx_promo_scene_templates_default_audience
            ON public.promo_scene_templates (slot, audience, is_default)
            WHERE slot = 'theme' AND is_default = TRUE
        $idx$;
    END IF;
END $$;
