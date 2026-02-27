-- ============================================
-- 測試數據生成與清除腳本
-- 用途：為媒合功能提供完整的測試數據
-- 執行日期：2026-02-06
-- ============================================

-- ==================== 清除測試數據 ====================
-- 執行順序：由依賴關係決定，從子表到父表

-- 1. 清除媒合記錄（最後生成，最先清除）
DELETE FROM public.matches 
WHERE expert_id IN (
    SELECT id FROM auth.users WHERE email LIKE 'test_%@matchdo.test'
);

-- 2. 清除專家報價
DELETE FROM public.listings 
WHERE expert_id IN (
    SELECT id FROM auth.users WHERE email LIKE 'test_%@matchdo.test'
);

-- 3. 清除專案
DELETE FROM public.projects 
WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email LIKE 'test_%@matchdo.test'
);

-- 4. 清除專家檔案
DELETE FROM public.experts_profile 
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE 'test_%@matchdo.test'
);

-- 5. 清除聯絡資訊
DELETE FROM public.contact_info 
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE 'test_%@matchdo.test'
);

-- 6. 清除用戶資料
DELETE FROM public.users 
WHERE email LIKE 'test_%@matchdo.test';

-- 7. 清除 auth.users（最後清除）
-- 注意：需要在 Supabase Dashboard 的 Authentication 頁面手動刪除
-- 或使用 service_role key 通過 API 刪除

-- ==================== 驗證清除結果 ====================
SELECT 
    'users' as table_name, 
    COUNT(*) as test_records 
FROM public.users 
WHERE email LIKE 'test_%@matchdo.test'
UNION ALL
SELECT 
    'experts_profile', 
    COUNT(*) 
FROM public.experts_profile 
WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'test_%@matchdo.test')
UNION ALL
SELECT 
    'listings', 
    COUNT(*) 
FROM public.listings 
WHERE expert_id IN (SELECT id FROM auth.users WHERE email LIKE 'test_%@matchdo.test')
UNION ALL
SELECT 
    'projects', 
    COUNT(*) 
FROM public.projects 
WHERE owner_id IN (SELECT id FROM auth.users WHERE email LIKE 'test_%@matchdo.test')
UNION ALL
SELECT 
    'matches', 
    COUNT(*) 
FROM public.matches 
WHERE expert_id IN (SELECT id FROM auth.users WHERE email LIKE 'test_%@matchdo.test');

-- ==================== 測試數據插入 ====================
-- 注意：實際用戶需要通過 Supabase Auth 註冊才能建立
-- 以下為參考結構，實際執行需要使用腳本或手動註冊

-- ========== 測試用戶列表 ==========
/*
發案者（Clients）：5 位
- test_client1@matchdo.test - 李大明（居家裝潢需求）
- test_client2@matchdo.test - 王小美（設計需求）
- test_client3@matchdo.test - 張三豐（大型統包需求）
- test_client4@matchdo.test - 陳小華（小型清潔需求）
- test_client5@matchdo.test - 林美玲（多樣化需求）

專家（Experts）：10 位
- test_expert1@matchdo.test - 陳師傅（室內設計，台北市）
- test_expert2@matchdo.test - 林木工（木工訂製，新北市）
- test_expert3@matchdo.test - 黃油漆（油漆工程，台北市+新北市）
- test_expert4@matchdo.test - 趙水電（水電工程，台北市，可遠端）
- test_expert5@matchdo.test - 劉清潔（清潔服務，全台灣）
- test_expert6@matchdo.test - 吳設計（平面設計，遠端工作）
- test_expert7@matchdo.test - 周泥作（泥作工程，桃園市）
- test_expert8@matchdo.test - 鄭鐵工（鐵工，台中市）
- test_expert9@matchdo.test - 孫園藝（園藝景觀，台北市+新北市+桃園市）
- test_expert10@matchdo.test - 馬裝潢（統包工程，台北市，高價位）
*/

-- ========== 測試專案範例 ==========
/*
專案 1：台北市公寓全室裝潢（預算 80-120 萬）
- 子分類：室內設計、木工、油漆、水電
- 地點：台北市
- 預期媒合：expert1, expert2, expert3, expert4, expert10

專案 2：新北市小套房清潔（預算 2000-4000）
- 子分類：清潔服務
- 地點：新北市
- 預期媒合：expert5

專案 3：遠端平面設計（預算 1-3 萬）
- 子分類：平面設計
- 地點：遠端專案
- 預期媒合：expert6

專案 4：桃園透天厝園藝（預算 5-10 萬）
- 子分類：園藝景觀
- 地點：桃園市
- 預期媒合：expert9
*/

-- ========== 測試報價範例 ==========
/*
Listing 1：室內設計規劃（陳師傅）
- 價格：60,000 - 200,000
- 服務區域：台北市
- 可遠端：否

Listing 2：木工訂製（林木工）
- 價格：30,000 - 150,000
- 服務區域：新北市
- 可遠端：否

Listing 3：全室油漆（黃油漆）
- 價格：20,000 - 80,000
- 服務區域：台北市、新北市
- 可遠端：否

Listing 4：水電維修（趙水電）
- 價格：5,000 - 50,000
- 服務區域：台北市
- 可遠端：是

Listing 5：居家清潔（劉清潔）
- 價格：2,000 - 5,000
- 服務區域：全台灣
- 可遠端：否

Listing 6：平面設計（吳設計）
- 價格：8,000 - 50,000
- 服務區域：不限
- 可遠端：是

Listing 10：統包工程（馬裝潢）
- 價格：500,000 - 2,000,000
- 服務區域：台北市
- 可遠端：否
*/

-- ==================== 使用說明 ====================
/*
1. 清除測試數據：
   - 執行「清除測試數據」區段
   - 驗證清除結果（所有計數應為 0）

2. 建立測試數據：
   - 方式 A：使用 Node.js 腳本自動建立（推薦）
   - 方式 B：手動在前端註冊並建立

3. 測試流程：
   a. 建立測試數據
   b. 測試預媒合功能
   c. 測試正式媒合功能
   d. 測試結果顯示
   e. 清除測試數據

4. 命名規則：
   - 測試用戶 email：test_[role][number]@matchdo.test
   - 測試用戶名稱：使用中文名稱，易於識別
   - 所有測試數據都包含 'test_' 前綴
*/
