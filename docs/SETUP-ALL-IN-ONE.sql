-- ============================================================
-- MATCHDO 完整資料庫初始化 — 一次執行全部到位
-- 在 Supabase SQL Editor 貼入整段執行
-- ============================================================

-- ── 1. 媒體牆收藏 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.media_wall_favorites (
    id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id    text        NOT NULL,
    item_data  jsonb       DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    UNIQUE (user_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_mwf_user ON public.media_wall_favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_mwf_item ON public.media_wall_favorites (item_id);
ALTER TABLE public.media_wall_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can read own favorites"   ON public.media_wall_favorites;
DROP POLICY IF EXISTS "users can insert own favorites" ON public.media_wall_favorites;
DROP POLICY IF EXISTS "users can delete own favorites" ON public.media_wall_favorites;
DROP POLICY IF EXISTS "users can update own favorites" ON public.media_wall_favorites;
CREATE POLICY "users can read own favorites"   ON public.media_wall_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users can insert own favorites" ON public.media_wall_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users can delete own favorites" ON public.media_wall_favorites FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "users can update own favorites" ON public.media_wall_favorites FOR UPDATE USING (auth.uid() = user_id);

-- ── 2. 聯絡清單 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_list (
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    saved_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, saved_user_id),
    CONSTRAINT contact_list_no_self CHECK (user_id != saved_user_id)
);
CREATE INDEX IF NOT EXISTS idx_contact_list_user_id ON public.contact_list(user_id);
ALTER TABLE public.contact_list ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own contact list" ON public.contact_list;
CREATE POLICY "Users manage own contact list" ON public.contact_list FOR ALL USING (auth.uid() = user_id);

-- ── 3. 1:1 直接對話 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.direct_conversations (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_b_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT direct_conversations_ordered CHECK (user_a_id < user_b_id),
    CONSTRAINT direct_conversations_no_self CHECK (user_a_id != user_b_id),
    UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX IF NOT EXISTS idx_direct_conversations_user_a    ON public.direct_conversations(user_a_id);
CREATE INDEX IF NOT EXISTS idx_direct_conversations_user_b    ON public.direct_conversations(user_b_id);
CREATE INDEX IF NOT EXISTS idx_direct_conversations_updated_at ON public.direct_conversations(updated_at DESC);
ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own direct conversations" ON public.direct_conversations;
CREATE POLICY "Users see own direct conversations" ON public.direct_conversations FOR ALL
    USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- ── 4. 直接對話訊息 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
    sender_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body            text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_id ON public.direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at      ON public.direct_messages(created_at ASC);
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants see direct messages" ON public.direct_messages;
CREATE POLICY "Participants see direct messages" ON public.direct_messages FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.direct_conversations c
        WHERE c.id = conversation_id AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    ));

-- 觸發：新訊息時更新 updated_at
CREATE OR REPLACE FUNCTION update_direct_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.direct_conversations SET updated_at = now() WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_direct_messages_updated_at ON public.direct_messages;
CREATE TRIGGER trigger_direct_messages_updated_at
    AFTER INSERT ON public.direct_messages
    FOR EACH ROW EXECUTE PROCEDURE update_direct_conversation_updated_at();

-- ── 5. media_collections 加 manufacturer_id 欄位 ──────────
ALTER TABLE public.media_collections
    ADD COLUMN IF NOT EXISTS manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_media_collections_manufacturer_id
    ON public.media_collections(manufacturer_id);

-- ── 6. 為所有沒有 user_id 的廠商建立 auth 帳號 ────────────
DO $$
DECLARE
    mfr        RECORD;
    new_uid    uuid;
    clean_name text;
    fake_email text;
BEGIN
    FOR mfr IN
        SELECT id, name FROM public.manufacturers WHERE user_id IS NULL
    LOOP
        new_uid    := gen_random_uuid();
        clean_name := lower(regexp_replace(mfr.name, '[^a-zA-Z0-9]', '', 'g'));
        IF clean_name = '' THEN clean_name := 'vendor'; END IF;
        fake_email := 'mfr.' || clean_name || '.' || substr(new_uid::text, 1, 6) || '@matchdo.test';

        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password,
            email_confirmed_at, created_at, updated_at,
            raw_user_meta_data, role, aud
        ) VALUES (
            new_uid,
            '00000000-0000-0000-0000-000000000000',
            fake_email,
            crypt('MatchDO_' || substr(new_uid::text, 1, 8), gen_salt('bf')),
            now(), now(), now(),
            jsonb_build_object('full_name', mfr.name, 'role', 'manufacturer'),
            'authenticated', 'authenticated'
        )
        ON CONFLICT (email) DO NOTHING;

        UPDATE public.manufacturers SET user_id = new_uid WHERE id = mfr.id AND user_id IS NULL;
    END LOOP;
END $$;

-- ── 確認結果 ───────────────────────────────────────────────
SELECT
    (SELECT count(*) FROM public.media_wall_favorites)    AS "收藏表筆數",
    (SELECT count(*) FROM public.contact_list)            AS "聯絡清單筆數",
    (SELECT count(*) FROM public.direct_conversations)    AS "對話筆數",
    (SELECT count(*) FROM public.direct_messages)         AS "訊息筆數",
    (SELECT count(*) FROM public.manufacturers WHERE user_id IS NOT NULL) AS "廠商已綁定帳號",
    (SELECT count(*) FROM public.manufacturers WHERE user_id IS NULL)     AS "廠商未綁定（應為0）";
