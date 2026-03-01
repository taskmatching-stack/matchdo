-- 為 contact_info 資料表新增 Threads 和 X（Twitter）欄位
-- 執行時機：部署含有 Threads/X 社群連結功能的版本之後

ALTER TABLE contact_info
  ADD COLUMN IF NOT EXISTS threads_url       TEXT,
  ADD COLUMN IF NOT EXISTS threads_visible   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS twitter_url       TEXT,
  ADD COLUMN IF NOT EXISTS twitter_visible   BOOLEAN DEFAULT FALSE;
