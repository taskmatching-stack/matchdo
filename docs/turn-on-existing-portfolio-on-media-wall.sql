-- ============================================================
-- 把「已上傳的對照圖」改為在靈感牆顯示（不用重傳）
-- 在 Supabase SQL Editor 執行一次即可。
-- ============================================================

-- 先確保欄位存在（若已執行過媒體牆說明文件的 SQL 可略過）
ALTER TABLE public.manufacturer_portfolio
ADD COLUMN IF NOT EXISTS show_on_media_wall BOOLEAN NOT NULL DEFAULT false;

-- 將「已有前、後圖」的作品設為在靈感牆顯示
UPDATE public.manufacturer_portfolio
SET show_on_media_wall = true
WHERE image_url IS NOT NULL
  AND image_url_before IS NOT NULL
  AND (show_on_media_wall IS NULL OR show_on_media_wall = false);
