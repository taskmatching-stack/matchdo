-- =============================================
-- Project Items 表新增數量與單位欄位
-- 用途：支援單價計算和精確媒合
-- 更新：2026-02-06
-- =============================================

-- ========================================
-- 1. 新增欄位
-- ========================================

ALTER TABLE public.project_items 
ADD COLUMN IF NOT EXISTS quantity DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS unit TEXT;

-- ========================================
-- 2. 索引
-- ========================================

CREATE INDEX IF NOT EXISTS idx_project_items_unit ON public.project_items(unit);

-- ========================================
-- 3. 註解（明確定義）
-- ========================================

COMMENT ON COLUMN public.project_items.quantity IS '數量（例：30、5、100.5）';
COMMENT ON COLUMN public.project_items.unit IS '單位（例：坪、組、公尺、m²、次、式）';
COMMENT ON COLUMN public.project_items.budget_min IS '總預算下限（quantity × 單價下限，例：30坪 × $2,333 = $70,000）';
COMMENT ON COLUMN public.project_items.budget_max IS '總預算上限（quantity × 單價上限，例：30坪 × $3,000 = $90,000）';

-- ========================================
-- 4. 驗證
-- ========================================

SELECT 
    '✅ project_items 已新增 quantity 和 unit 欄位' as message,
    COUNT(*) as total_items,
    COUNT(quantity) as items_with_quantity,
    COUNT(unit) as items_with_unit,
    COUNT(CASE WHEN quantity IS NOT NULL AND unit IS NOT NULL THEN 1 END) as complete_items
FROM public.project_items;

-- ========================================
-- 5. 查看範例數據
-- ========================================

SELECT 
    item_name,
    quantity,
    unit,
    budget_min,
    budget_max,
    CASE 
        WHEN quantity > 0 THEN ROUND(budget_min / quantity, 0)
        ELSE NULL
    END as unit_price_min_calculated,
    CASE 
        WHEN quantity > 0 THEN ROUND(budget_max / quantity, 0)
        ELSE NULL
    END as unit_price_max_calculated
FROM public.project_items
WHERE quantity IS NOT NULL AND unit IS NOT NULL
LIMIT 5;

-- ========================================
-- 說明
-- ========================================

/*
重要定義：
- quantity：客戶需求的數量（例：30坪、5組）
- unit：計價單位（必須與 listings.unit 一致才能媒合）
- budget_min/max：客戶的總預算（用於過濾和評分）

媒合邏輯：
1. 檢查單位一致：listing.unit = item.unit
2. 計算承包商總價：listing.price_min × item.quantity
3. 過濾：承包商均價在客戶預算內
4. 評分：承包商單價 vs 市場單價（偏差率）
*/
