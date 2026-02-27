-- 聯絡清單 + 訂製者/製作方 1:1 對話（與專案對話並存）
-- 執行：Supabase SQL Editor

-- 1. 聯絡清單（儲存的對象）
CREATE TABLE IF NOT EXISTS public.contact_list (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    saved_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, saved_user_id),
    CONSTRAINT contact_list_no_self CHECK (user_id != saved_user_id)
);
CREATE INDEX IF NOT EXISTS idx_contact_list_user_id ON public.contact_list(user_id);
COMMENT ON TABLE public.contact_list IS '使用者儲存的聯絡對象（訂製者/製作方 對話用）';

-- 2. 直接對話（1:1，不綁專案）
CREATE TABLE IF NOT EXISTS public.direct_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_b_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT direct_conversations_ordered CHECK (user_a_id < user_b_id),
    CONSTRAINT direct_conversations_no_self CHECK (user_a_id != user_b_id),
    UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX IF NOT EXISTS idx_direct_conversations_user_a ON public.direct_conversations(user_a_id);
CREATE INDEX IF NOT EXISTS idx_direct_conversations_user_b ON public.direct_conversations(user_b_id);
CREATE INDEX IF NOT EXISTS idx_direct_conversations_updated_at ON public.direct_conversations(updated_at DESC);
COMMENT ON TABLE public.direct_conversations IS '訂製者與製作方 1:1 對話串（不綁專案）';

-- 3. 直接對話訊息
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_id ON public.direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON public.direct_messages(created_at ASC);
COMMENT ON TABLE public.direct_messages IS '直接對話內的單則訊息';

-- 觸發：新訊息時更新 direct_conversations.updated_at
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

-- RLS
ALTER TABLE public.contact_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own contact list" ON public.contact_list;
CREATE POLICY "Users manage own contact list" ON public.contact_list FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own direct conversations" ON public.direct_conversations;
CREATE POLICY "Users see own direct conversations" ON public.direct_conversations FOR ALL
    USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "Participants see direct messages" ON public.direct_messages;
CREATE POLICY "Participants see direct messages" ON public.direct_messages FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.direct_conversations c
            WHERE c.id = conversation_id AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
        )
    );
