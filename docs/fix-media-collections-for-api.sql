-- 一次性修正：讓首頁媒體牆「資料夾」一定讀得到
-- 在 Supabase SQL Editor 貼上整段執行一次即可。

-- 1) 若表只有 name 沒有 title：補上 title 並從 name 填值（若你的表是 title 沒有 name 可略過此段）
ALTER TABLE public.media_collections ADD COLUMN IF NOT EXISTS title text;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'media_collections' AND column_name = 'name') THEN
    UPDATE public.media_collections SET title = COALESCE(title, name) WHERE title IS NULL AND name IS NOT NULL;
  END IF;
END $$;

-- 2) 關閉 RLS，避免查詢回傳空陣列
ALTER TABLE public.media_collections DISABLE ROW LEVEL SECURITY;

-- 完成後重啟後端、重整首頁即可。
