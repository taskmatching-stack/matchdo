-- 印花資產 AI 重繪點數（僅重繪扣點；僅存原圖不扣點）
-- Supabase SQL Editor 執行一次（或於 /admin/membership.html 設定）

INSERT INTO payment_config (key, value, updated_at)
VALUES ('points_print_asset_flux', '5', now())
ON CONFLICT (key) DO NOTHING;
