-- 廠商 LOGO：供廠商自己上傳/設定，顯示於廠商詳情頁 (vendor-profile) 頭像與 og:image
ALTER TABLE manufacturers
ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN manufacturers.logo_url IS '廠商自訂 LOGO 圖片網址，顯示於廠商頁面頭像與分享預覽';
