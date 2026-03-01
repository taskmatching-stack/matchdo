-- 媒體牆收藏功能：用戶收藏的媒體牆項目
-- 執行前請確認已在 Supabase SQL Editor 執行此腳本

CREATE TABLE IF NOT EXISTS public.media_wall_favorites (
    id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id     text        NOT NULL,           -- 媒體牆項目 ID
    item_data   jsonb       DEFAULT '{}',       -- 快照：title, image_url, type, link 等
    created_at  timestamptz DEFAULT now(),
    UNIQUE (user_id, item_id)
);

-- 查詢效能索引
CREATE INDEX IF NOT EXISTS idx_mwf_user   ON public.media_wall_favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_mwf_item   ON public.media_wall_favorites (item_id);

-- RLS：只允許本人讀寫自己的收藏
ALTER TABLE public.media_wall_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can read own favorites"   ON public.media_wall_favorites;
DROP POLICY IF EXISTS "users can insert own favorites" ON public.media_wall_favorites;
DROP POLICY IF EXISTS "users can delete own favorites" ON public.media_wall_favorites;
DROP POLICY IF EXISTS "users can update own favorites" ON public.media_wall_favorites;

CREATE POLICY "users can read own favorites"
    ON public.media_wall_favorites FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "users can insert own favorites"
    ON public.media_wall_favorites FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete own favorites"
    ON public.media_wall_favorites FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "users can update own favorites"
    ON public.media_wall_favorites FOR UPDATE
    USING (auth.uid() = user_id);
