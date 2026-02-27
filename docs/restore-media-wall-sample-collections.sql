-- 還原首頁「範例資料夾」（系列一、系列二）
-- 若跑完 seed 或 ON CONFLICT DO UPDATE 仍看不到，請在 Supabase SQL Editor 執行本檔整段。
-- 說明：先刪除再插入；並讓 API 能讀到（RLS 政策或關閉 RLS）。

-- 1) 讓 API 能讀到 media_collections（二選一）
-- 作法 A：若已啟用 RLS，加上「所有人可讀」
DO $$
BEGIN
  IF (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.media_collections'::regclass) THEN
    DROP POLICY IF EXISTS "Public can view media collections" ON public.media_collections;
    CREATE POLICY "Public can view media collections"
      ON public.media_collections FOR SELECT
      USING (true);
  END IF;
END $$;
-- 作法 B（若仍讀不到）：關閉 RLS，讓後端一定能讀
-- ALTER TABLE public.media_collections DISABLE ROW LEVEL SECURITY;

-- 2) 刪掉舊的範例 slug，再插回兩筆
DELETE FROM public.media_collections WHERE slug IN ('collection-1', 'collection-2');

-- 3) 插入：依表是 title 或 name 欄位擇一執行（若表為「名稱」則用下面 name 版）
INSERT INTO public.media_collections (title, slug, cover_image_url, description, sort_order, is_active)
VALUES
  ('系列一', 'collection-1', 'https://placehold.co/600x400/555/aaa?text=1', NULL, 0, true),
  ('系列二', 'collection-2', 'https://placehold.co/600x400/666/bbb?text=2', NULL, 1, true)
ON CONFLICT (slug) DO UPDATE SET is_active = true;
-- 若上面報錯「column title does not exist」，改執行下面（表欄位為 name 時）：
-- INSERT INTO public.media_collections (name, slug, cover_image_url, description, sort_order, is_active)
-- VALUES
--   ('系列一', 'collection-1', 'https://placehold.co/600x400/555/aaa?text=1', NULL, 0, true),
--   ('系列二', 'collection-2', 'https://placehold.co/600x400/666/bbb?text=2', NULL, 1, true)
-- ON CONFLICT (slug) DO UPDATE SET is_active = true;

-- 4) 檢查：執行後可在 Table Editor 或再跑下面確認
-- SELECT id, title, slug, is_active FROM public.media_collections ORDER BY sort_order;
-- 若表是 name 欄位：SELECT id, name, slug, is_active FROM public.media_collections ORDER BY sort_order;
