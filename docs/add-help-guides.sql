-- 操作介紹 CMS：資料夾（大功能）＋單篇（獨立網址）
CREATE TABLE IF NOT EXISTS public.help_guide_folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    title_en text NOT NULL DEFAULT '',
    sort_order int NOT NULL DEFAULT 0,
    is_published boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.help_guide_pages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id uuid NOT NULL REFERENCES public.help_guide_folders(id) ON DELETE CASCADE,
    slug text NOT NULL,
    title text NOT NULL,
    title_en text NOT NULL DEFAULT '',
    summary text NOT NULL DEFAULT '',
    summary_en text NOT NULL DEFAULT '',
    blocks_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    sort_order int NOT NULL DEFAULT 0,
    is_published boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (folder_id, slug)
);

CREATE INDEX IF NOT EXISTS help_guide_pages_folder_sort_idx
    ON public.help_guide_pages (folder_id, sort_order);

ALTER TABLE public.help_guide_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_guide_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS help_guide_folders_service ON public.help_guide_folders;
CREATE POLICY help_guide_folders_service ON public.help_guide_folders
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS help_guide_pages_service ON public.help_guide_pages;
CREATE POLICY help_guide_pages_service ON public.help_guide_pages
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
