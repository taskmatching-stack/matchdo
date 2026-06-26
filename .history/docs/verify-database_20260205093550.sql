-- =============================================
-- 資料庫完整驗證腳本
-- 執行此腳本來檢查 Stage 1 是否完成
-- =============================================

-- 1. 檢查所有資料表是否建立
SELECT 
    '📋 資料表檢查' as category,
    table_name,
    '✅' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'profiles',
    'contact_info',
    'matches',
    'project_items',
    'contact_unlocks',
    'notifications',
    'subscription_plans',
    'user_subscriptions',
    'user_usage_stats',
    'user_credits',
    'credit_transactions'
)
ORDER BY table_name;

-- 2. 檢查缺少的資料表
WITH expected_tables AS (
    SELECT unnest(ARRAY[
        'profiles',
        'contact_info',
        'matches',
        'project_items',
        'contact_unlocks',
        'notifications',
        'subscription_plans',
        'user_subscriptions',
        'user_usage_stats',
        'user_credits',
        'credit_transactions'
    ]) AS table_name
),
existing_tables AS (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
)
SELECT 
    '❌ 缺少的資料表' as category,
    e.table_name,
    '需要建立' as status
FROM expected_tables e
LEFT JOIN existing_tables ex ON e.table_name = ex.table_name
WHERE ex.table_name IS NULL;

-- 3. 檢查函數是否建立
SELECT 
    '⚙️ 函數檢查' as category,
    routine_name,
    '✅' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'create_package_group',
    'ungroup_package',
    'publish_project_items',
    'get_unread_notification_count',
    'mark_notifications_as_read'
)
ORDER BY routine_name;

-- 4. 檢查缺少的函數
WITH expected_functions AS (
    SELECT unnest(ARRAY[
        'create_package_group',
        'ungroup_package',
        'publish_project_items',
        'get_unread_notification_count',
        'mark_notifications_as_read'
    ]) AS routine_name
),
existing_functions AS (
    SELECT routine_name
    FROM information_schema.routines
    WHERE routine_schema = 'public'
)
SELECT 
    '❌ 缺少的函數' as category,
    e.routine_name,
    '需要建立' as status
FROM expected_functions e
LEFT JOIN existing_functions ex ON e.routine_name = ex.routine_name
WHERE ex.routine_name IS NULL;

-- 5. 檢查 Views 是否建立
SELECT 
    '👁️ Views 檢查' as category,
    table_name,
    '✅' as status
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN (
    'project_items_summary',
    'package_groups_detail'
)
ORDER BY table_name;

-- 6. 檢查缺少的 Views
WITH expected_views AS (
    SELECT unnest(ARRAY[
        'project_items_summary',
        'package_groups_detail'
    ]) AS table_name
),
existing_views AS (
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
)
SELECT 
    '❌ 缺少的 Views' as category,
    e.table_name,
    '需要建立' as status
FROM expected_views e
LEFT JOIN existing_views ex ON e.table_name = ex.table_name
WHERE ex.table_name IS NULL;

-- 7. 檢查關鍵欄位
SELECT 
    '🔍 profiles 表欄位' as category,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('id', 'email', 'role', 'full_name', 'avatar_url', 'email_verified')
ORDER BY ordinal_position;

-- 8. 檢查外鍵約束
SELECT 
    '🔗 外鍵約束檢查' as category,
    tc.table_name,
    tc.constraint_name,
    '✅' as status
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
AND tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN (
    'project_items',
    'matches',
    'notifications',
    'contact_unlocks',
    'user_subscriptions',
    'user_usage_stats',
    'user_credits',
    'credit_transactions'
)
ORDER BY tc.table_name, tc.constraint_name;

-- 9. 檢查索引
SELECT 
    '📇 索引檢查' as category,
    tablename,
    indexname,
    '✅' as status
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
    'notifications',
    'project_items',
    'matches',
    'contact_unlocks'
)
ORDER BY tablename, indexname;

-- 10. 統計摘要
SELECT 
    '📊 建立統計' as report_type,
    '資料表' as item_type,
    COUNT(*)::text as total,
    '預期: 11' as expected
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'profiles', 'contact_info', 'matches', 'project_items',
    'contact_unlocks', 'notifications', 'subscription_plans',
    'user_subscriptions', 'user_usage_stats', 'user_credits',
    'credit_transactions'
)
UNION ALL
SELECT 
    '📊 建立統計',
    '函數',
    COUNT(*)::text,
    '預期: 5'
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'create_package_group', 'ungroup_package', 'publish_project_items',
    'get_unread_notification_count', 'mark_notifications_as_read'
)
UNION ALL
SELECT 
    '📊 建立統計',
    'Views',
    COUNT(*)::text,
    '預期: 2'
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN ('project_items_summary', 'package_groups_detail');

-- 11. 檢查 RLS 是否啟用
SELECT 
    '🔒 RLS 啟用檢查' as category,
    tablename,
    CASE WHEN rowsecurity THEN '✅ 已啟用' ELSE '❌ 未啟用' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'profiles',
    'contact_info',
    'matches',
    'project_items',
    'contact_unlocks',
    'notifications',
    'subscription_plans',
    'user_subscriptions',
    'user_usage_stats',
    'user_credits',
    'credit_transactions'
)
ORDER BY tablename;

-- 12. 檢查你的管理員權限
SELECT 
    '👤 管理員權限檢查' as category,
    id,
    email,
    role,
    CASE 
        WHEN role = 'admin' THEN '✅ 已設為管理員'
        ELSE '❌ 尚未設為管理員'
    END as admin_status
FROM profiles
WHERE email = 'liutsaiiu@gmail.com';

-- 13. 最終檢查結果
DO $$
DECLARE
    table_count integer;
    function_count integer;
    view_count integer;
    result_message text;
BEGIN
    -- 計算數量
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
        'profiles', 'contact_info', 'matches', 'project_items',
        'contact_unlocks', 'notifications', 'subscription_plans',
        'user_subscriptions', 'user_usage_stats', 'user_credits',
        'credit_transactions'
    );
    
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name IN (
        'create_package_group', 'ungroup_package', 'publish_project_items',
        'get_unread_notification_count', 'mark_notifications_as_read'
    );
    
    SELECT COUNT(*) INTO view_count
    FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name IN ('project_items_summary', 'package_groups_detail');
    
    -- 產生結果訊息
    IF table_count = 11 AND function_count = 5 AND view_count = 2 THEN
        result_message := '🎉 恭喜！Stage 1 資料庫建立完成！';
    ELSE
        result_message := '⚠️ 尚未完成，請檢查缺少的項目：';
        IF table_count < 11 THEN
            result_message := result_message || format(' 資料表 %s/11', table_count);
        END IF;
        IF function_count < 5 THEN
            result_message := result_message || format(' 函數 %s/5', function_count);
        END IF;
        IF view_count < 2 THEN
            result_message := result_message || format(' Views %s/2', view_count);
        END IF;
    END IF;
    
    RAISE NOTICE '%', result_message;
    RAISE NOTICE '資料表: %/11', table_count;
    RAISE NOTICE '函數: %/5', function_count;
    RAISE NOTICE 'Views: %/2', view_count;
END $$;
