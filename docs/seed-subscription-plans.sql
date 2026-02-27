-- 預設訂閱方案（後台「方案設定」有資料可編輯；前台 subscription-plans.html 會依此顯示）
-- 表無 plan_key 也相容。若表已有資料請略過。若方案出現重複，請執行 docs/dedupe-subscription-plans.sql 去重。

INSERT INTO public.subscription_plans (name, price, duration_months, credits_monthly, sort_order, is_active)
VALUES
  ('免費會員', 0, 1, 150, 0, true),
  ('方案二', 300, 1, 330, 1, true),
  ('方案三', 900, 1, 1100, 2, true),
  ('方案四', 1800, 1, 2400, 3, true);
