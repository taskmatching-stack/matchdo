-- 視覺語意事件表：累積供搜尋與趨勢分析（§6 T0）
-- 執行：Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.visual_semantics_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type text NOT NULL,
    source_id uuid,
    image_url text,
    text_input text,
    semantics_kind text NOT NULL,
    ai_tags text[] DEFAULT '{}',
    semantics_json jsonb,
    model text,
    prompt_version text,
    owner_id uuid,
    category_key text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vse_source ON public.visual_semantics_events (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_vse_created ON public.visual_semantics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vse_ai_tags ON public.visual_semantics_events USING GIN (ai_tags);
CREATE INDEX IF NOT EXISTS idx_vse_kind ON public.visual_semantics_events (semantics_kind);

COMMENT ON TABLE public.visual_semantics_events IS '每次 Gemini 語意解析一筆；供聚合與流行趨勢分析';

ALTER TABLE public.visual_semantics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages visual semantics events" ON public.visual_semantics_events;
CREATE POLICY "Service role manages visual semantics events"
    ON public.visual_semantics_events FOR ALL
    USING (true)
    WITH CHECK (true);
