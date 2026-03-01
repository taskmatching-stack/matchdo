-- 服務地區：加入多語系名稱欄位
-- 在 Supabase SQL Editor 執行（可重複執行）
ALTER TABLE public.service_areas
    ADD COLUMN IF NOT EXISTS name_i18n JSONB DEFAULT '{}';

-- 說明：name_i18n 儲存格式為 JSON，例如：
-- { "ja": "東京都", "ko": "도쿄", "fr": "Tokyo", "de": "Tokio" }
-- 目前 Admin 介面預留「日文」和「韓文」欄位

COMMENT ON COLUMN public.service_areas.name_i18n IS '多語系名稱，格式 {"ja":"...","ko":"...","fr":"..."}';
