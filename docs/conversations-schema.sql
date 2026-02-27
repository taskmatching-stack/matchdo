-- =============================================
-- 線上訊息對話：conversations + messages
-- 發案者與媒合專家之間的站內訊息（不鎖聯絡方式，僅提供站內對話）
-- =============================================
-- 注意：若專案中曾用 db/schema.sql 建立過舊版 conversations（只有 match_id），
-- 本腳本會先刪除舊表再建立新結構（含 client_id, expert_id, project_id），舊對話資料會遺失。
-- 先刪表（messages 依賴 conversations 的 FK，故先刪 messages；不先 DROP TRIGGER 以免 messages 不存在時報錯）
DROP TABLE IF EXISTS public.messages;
DROP TABLE IF EXISTS public.conversations;

CREATE TABLE public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid,
    client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expert_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    match_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(project_id, expert_id)
);

CREATE INDEX idx_conversations_client_id ON public.conversations(client_id);
CREATE INDEX idx_conversations_expert_id ON public.conversations(expert_id);
CREATE INDEX idx_conversations_project_id ON public.conversations(project_id);
CREATE INDEX idx_conversations_updated_at ON public.conversations(updated_at DESC);

COMMENT ON TABLE public.conversations IS '發案者與專家的對話串（一站內訊息）';

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);

COMMENT ON TABLE public.messages IS '對話內的單則訊息';

-- 更新 conversation 的 updated_at（可選，由應用層或 trigger 更新）
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_messages_update_conversation ON public.messages;
CREATE TRIGGER trigger_messages_update_conversation
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_updated_at();

SELECT 'conversations 與 messages 表已建立' AS message;
