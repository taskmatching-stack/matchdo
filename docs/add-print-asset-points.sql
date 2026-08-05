-- 印花資產 AI 重繪點數（僅重繪／生成扣點；僅存原圖不扣點）
-- Supabase SQL Editor 執行一次（或於 /admin/membership.html 設定）
-- 未寫入時程式預設 10 點

INSERT INTO payment_config (key, value, updated_at)
VALUES ('points_print_asset_flux', '10', now())
ON CONFLICT (key) DO NOTHING;
