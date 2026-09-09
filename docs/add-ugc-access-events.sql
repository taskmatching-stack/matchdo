-- UGC 有效存取／點閱事件（稽核、後台查詢）— 見 docs/PLAN-free-tier-90d-retention.md §4.4
-- 不含靈感牆列表滑過；記錄詳情、lightbox、/inspiration、本人圖庫等

CREATE TABLE IF NOT EXISTS public.ugc_access_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type text NOT NULL,
    item_id uuid NOT NULL,
    access_path text NOT NULL,
    viewer_user_id uuid,
    accessed_at timestamptz NOT NULL DEFAULT now(),
    metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.ugc_access_events IS 'UGC 有效存取事件（user_design / promo_scene）';
COMMENT ON COLUMN public.ugc_access_events.access_path IS 'owner_library_detail | media_wall_item | inspiration 等';
COMMENT ON COLUMN public.ugc_access_events.viewer_user_id IS '登入觀看者；公開匿名為 NULL';

CREATE INDEX IF NOT EXISTS idx_ugc_access_events_item_time
    ON public.ugc_access_events (item_type, item_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_ugc_access_events_time
    ON public.ugc_access_events (accessed_at DESC);

ALTER TABLE public.ugc_access_events ENABLE ROW LEVEL SECURITY;
