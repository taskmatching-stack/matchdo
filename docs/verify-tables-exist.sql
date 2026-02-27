-- ============================================
-- 驗證資料表實際存在狀態
-- 執行日期：2026-02-06
-- ============================================

-- 查詢所有 public schema 的資料表
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('users', 'experts_profile', 'listings', 'projects') THEN '✅ 核心表'
        WHEN table_name IN ('contact_info', 'contact_unlocks', 'matches', 'notifications', 
                           'subscription_plans', 'user_subscriptions', 'user_usage_stats', 
                           'user_credits', 'credit_transactions') THEN '❓ 待驗證'
        ELSE '⚠️ 其他表'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY 
    CASE 
        WHEN table_name IN ('users', 'experts_profile', 'listings', 'projects') THEN 1
        WHEN table_name IN ('contact_info', 'contact_unlocks', 'matches', 'notifications') THEN 2
        ELSE 3
    END,
    table_name;

-- 檢查特定表是否存在
SELECT 
    'contact_info' as table_name,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_info' AND table_schema = 'public') as exists
UNION ALL
SELECT 
    'contact_unlocks',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_unlocks' AND table_schema = 'public')
UNION ALL
SELECT 
    'matches',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matches' AND table_schema = 'public')
UNION ALL
SELECT 
    'notifications',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public')
UNION ALL
SELECT 
    'subscription_plans',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_plans' AND table_schema = 'public')
UNION ALL
SELECT 
    'user_subscriptions',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subscriptions' AND table_schema = 'public');
