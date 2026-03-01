-- 為 direct_messages 資料表新增 image_url 欄位（訊息圖片）
-- 執行時機：部署含圖片訊息功能的版本後，在 Supabase SQL Editor 執行一次

ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- （選做）為 custom-products bucket 加入 messages/ 路徑的 public 讀取政策
-- 若 bucket 已設為 public，此步驟可略過
-- INSERT INTO storage.policies (name, bucket_id, operation, definition)
-- VALUES ('messages-public-read', 'custom-products', 'SELECT', 'true')
-- ON CONFLICT DO NOTHING;
