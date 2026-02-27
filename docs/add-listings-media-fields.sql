-- =============================================
-- 報價單：5 張圖片 / YouTube 連結 / 媒體嵌入碼
-- 執行：Supabase SQL Editor
-- 說明：listings.images 若已存在（jsonb）可存最多 5 筆 URL；本檔僅新增 youtube_urls、media_embeds
-- =============================================

-- YouTube 連結（可多筆，存為陣列）
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS youtube_urls text[] DEFAULT '{}';

COMMENT ON COLUMN public.listings.youtube_urls IS 'YouTube 影片連結';

-- 媒體嵌入碼（例如 Sketchfab iframe），存為 JSON 陣列 [{ "html": "..." }, ...]
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS media_embeds jsonb DEFAULT '[]';

COMMENT ON COLUMN public.listings.media_embeds IS '媒體嵌入碼陣列，例：Sketchfab 嵌入碼';
