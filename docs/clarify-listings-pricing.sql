-- =============================================
-- Listings 表價格欄位定義釐清
-- 用途：明確定義 price_min/max 為單價
-- 更新：2026-02-06
-- =============================================

-- ========================================
-- 1. 明確定義欄位（添加註解）
-- ========================================

COMMENT ON COLUMN public.listings.price_min IS '單價下限（每單位價格，例：$2,500/坪、$8,000/組、$150/m²）';
COMMENT ON COLUMN public.listings.price_max IS '單價上限（每單位價格，例：$3,500/坪、$12,000/組、$250/m²）';
COMMENT ON COLUMN public.listings.unit IS '計價單位（坪、組、公尺、m²、次、式等）- 必須與 project_items.unit 一致才能媒合';

-- ========================================
-- 2. 驗證現有數據（檢查單價合理性）
-- ========================================

-- 查看各子分類的價格分佈
SELECT 
    subcategory,
    unit,
    COUNT(*) as listings_count,
    MIN(price_min) as min_unit_price,
    MAX(price_max) as max_unit_price,
    ROUND(AVG(price_min), 0) as avg_unit_price_min,
    ROUND(AVG(price_max), 0) as avg_unit_price_max,
    CASE 
        WHEN subcategory LIKE 'home__interior_design' AND AVG(price_min) > 10000 THEN '⚠️ 可能是總價而非單價'
        WHEN subcategory LIKE 'home__system_cabinet' AND unit = '組' AND AVG(price_min) > 30000 THEN '⚠️ 可能是總價而非單價'
        ELSE '✓ 單價合理'
    END as data_check
FROM public.listings
WHERE status = 'active'
  AND price_min > 0
GROUP BY subcategory, unit
ORDER BY subcategory;

-- ========================================
-- 3. 檢查異常數據
-- ========================================

-- 找出可能填錯的數據（單價過高，疑似是總價）
SELECT 
    id,
    title,
    subcategory,
    unit,
    price_min,
    price_max,
    '⚠️ 單價過高，可能填成總價' as warning
FROM public.listings
WHERE status = 'active'
  AND (
      (subcategory LIKE 'home__interior_design' AND unit = '坪' AND price_min > 10000) OR
      (subcategory LIKE 'home__system_cabinet' AND unit = '組' AND price_min > 30000) OR
      (subcategory LIKE 'home__painting' AND unit = 'm²' AND price_min > 500) OR
      (subcategory LIKE 'home__plumbing' AND unit = '次' AND price_min > 50000)
  )
LIMIT 10;

-- ========================================
-- 4. 數據修正範例（如果需要）
-- ========================================

/*
如果發現數據混亂（有些是總價，有些是單價），有兩種處理方式：

方案 A：保留現有數據，視為「接案價格範圍」
- 適合：如果數據量少，且都是測試數據
- 缺點：無法精確按單價媒合

方案 B：重新生成測試數據（推薦）
- 清除所有測試 listings
- 修改 generate-test-data-100experts.js
- 重新生成（確保 price_min/max 都是單價）

執行：
node docs/clear-test-data.js
node docs/generate-test-data-100experts.js
*/

-- ========================================
-- 5. 驗證結果
-- ========================================

SELECT '✅ Listings 價格欄位定義已明確' as status;

SELECT 
    '提醒：請確保所有 listings 的 price_min/max 都是「單價」而非「總價」' as reminder,
    '如有疑問，請查看上方的數據驗證結果' as next_step;
