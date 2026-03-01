-- 儲存「直接對話」訊息的翻譯結果，每位使用者每則訊息只存一筆（同一則再按翻譯不重複扣點、不覆寫）
CREATE TABLE IF NOT EXISTS public.direct_message_translations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    translated_text text NOT NULL,
    target_lang text,
    source_lang text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_direct_message_translations_message_id ON public.direct_message_translations(message_id);
CREATE INDEX IF NOT EXISTS idx_direct_message_translations_user_id ON public.direct_message_translations(user_id);
COMMENT ON TABLE public.direct_message_translations IS '直接對話訊息翻譯快取，依使用者儲存，跳開再回來仍可顯示';
