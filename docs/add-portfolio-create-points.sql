-- 廠商作品首次建立點數（系列／對照；編輯不扣）
-- Supabase SQL Editor 執行一次（或於 /admin/membership.html 設定）

INSERT INTO payment_config (key, value, updated_at)
VALUES
    ('points_portfolio_series_create', '30', now()),
    ('points_portfolio_comparison_create', '20', now())
ON CONFLICT (key) DO NOTHING;
